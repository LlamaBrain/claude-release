import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Run from the claude-release worktree. This exercises release manufacturing
// independently; it is not evidence that Captain authorized or merged a PR.
const releaseRoot = process.cwd();
const { prepareArtifacts } = await import(pathToFileURL(resolve(releaseRoot, 'src/prepare-artifacts.js')).href);
const { finalizeRelease } = await import(pathToFileURL(resolve(releaseRoot, 'src/finalize-release.js')).href);
const cli = resolve(releaseRoot, 'plugin/lib/build-manifest.js');
const tmp = mkdtempSync(join(tmpdir(), 'captain-release-demo-'));
const repo = join(tmp, 'repo');
mkdirSync(repo);
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function manifest(...args) {
  return JSON.parse(execFileSync(process.execPath, [cli, '--baseline', 'v1.0.0', '--target', target, ...args],
    { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
function surfaceFiles(cwd) {
  return [
    { path: 'VERSION', kind: 'text', content: readFileSync(join(cwd, 'VERSION'), 'utf8') },
    { path: 'ProjectSettings/ProjectSettings.asset', kind: 'unity', content: readFileSync(join(cwd, 'ProjectSettings/ProjectSettings.asset'), 'utf8') },
    { path: 'doxygen/dirigible.Doxyfile', kind: 'doxygen', content: readFileSync(join(cwd, 'doxygen/dirigible.Doxyfile'), 'utf8') },
  ];
}
let target;
try {
  git(repo, 'init', '-q', '-b', 'dev');
  git(repo, 'config', 'user.email', 'demo@example.invalid');
  git(repo, 'config', 'user.name', 'Disposable Demo');
  git(repo, 'config', 'core.autocrlf', 'false');
  mkdirSync(join(repo, 'ProjectSettings')); mkdirSync(join(repo, 'doxygen'));
  writeFileSync(join(repo, 'VERSION'), '1.0.0\n');
  writeFileSync(join(repo, 'ProjectSettings/ProjectSettings.asset'), '  bundleVersion: 1.0.0\n');
  writeFileSync(join(repo, 'doxygen/dirigible.Doxyfile'), 'PROJECT_NUMBER = 1.0.0\n');
  writeFileSync(join(repo, 'Api.cs'), 'namespace Example { public class Stable {} }\n');
  git(repo, 'add', 'VERSION', 'ProjectSettings', 'doxygen', 'Api.cs');
  git(repo, 'commit', '-qm', 'chore: initialize');
  git(repo, 'tag', '-a', 'v1.0.0', '-m', 'fixture baseline');
  const base = git(repo, 'rev-parse', 'HEAD');
  const baselineSurfaces = surfaceFiles(repo);
  const tasks = [
    { name: 'menu', message: 'feat(ui): add menu\n\nImplements: TASK-1\nCaptain-Run: run-1' },
    { name: 'save', message: 'fix(save): repair loading\n\nCompletes: TASK-2\nNeeds-QA: TASK-2' },
  ];
  for (const task of tasks) {
    const wt = join(tmp, task.name);
    git(repo, 'worktree', 'add', '-qb', 'feat/' + task.name, wt, 'v1.0.0');
    writeFileSync(join(wt, task.name + '.txt'), task.name);
    git(wt, 'add', task.name + '.txt'); git(wt, 'commit', '-qm', task.message);
    assert.deepEqual(surfaceFiles(wt), baselineSurfaces);
    task.oid = git(wt, 'rev-parse', 'HEAD');
    task.message = git(wt, 'log', '-1', '--format=%B');
  }
  for (const task of tasks) {
    git(repo, 'merge', '--squash', 'feat/' + task.name);
    const payload = Buffer.from(JSON.stringify({ schema_version: 1, commits: [{ oid: task.oid, message: task.message }] })).toString('base64url');
    git(repo, 'commit', '-qm', 'chore: integrate ' + task.name + '\n\nCaptain-Changes: ' + payload);
  }
  assert.deepEqual(surfaceFiles(repo), baselineSurfaces);
  target = git(repo, 'rev-parse', 'HEAD');
  const rc = manifest('--prerelease', 'rc');
  assert.equal(rc.next_version, 'v1.1.0-rc.0');
  assert.equal(rc.api_analysis.status, 'analyzed');
  const leaves = rc.commits.filter(c => !c.squash_summary);
  assert.deepEqual(new Set(leaves.map(c => c.full_hash)), new Set(tasks.map(t => t.oid)));
  assert.equal(rc.commits.filter(c => c.squash_summary).length, 2);
  const changelog = { path: 'Changelog/M01_CHANGELOG.md', content: '# Changelog\n' };
  const rcOutput = prepareArtifacts({ manifest: rc, surfaces: baselineSurfaces, changelog });
  assert.match(rcOutput.VERSION, /1\.1\.0-rc\.0/);
  assert.match(rcOutput['ProjectSettings/ProjectSettings.asset'], /bundleVersion: 1\.1\.0-rc\.0/);
  assert.match(rcOutput['doxygen/dirigible.Doxyfile'], /PROJECT_NUMBER = 1\.1\.0-rc\.0/);
  assert.ok(rcOutput[changelog.path].includes('add menu'));
  assert.ok(rcOutput[changelog.path].includes('repair loading'));
  for (const commit of leaves) {
    assert.ok(rcOutput[changelog.path].includes(commit.squash_hash.slice(0, 7)), 'changelog must reference the durable squash commit');
  }
  const rcSurfaces = baselineSurfaces.map(s => ({ ...s, content: rcOutput[s.path] }));
  assert.deepEqual(prepareArtifacts({ manifest: rc, surfaces: rcSurfaces, changelog: { ...changelog, content: rcOutput[changelog.path] } }), rcOutput);
  git(repo, 'switch', '-qc', 'stage');
  mkdirSync(join(repo, 'Changelog'));
  for (const [path, content] of Object.entries(rcOutput)) writeFileSync(join(repo, path), content);
  git(repo, 'add', 'VERSION', 'ProjectSettings', 'doxygen', 'Changelog');
  git(repo, 'commit', '-qm', 'chore(release): prepare candidate');
  target = git(repo, 'rev-parse', 'HEAD');
  const stable = manifest();
  assert.equal(stable.next_version, 'v1.1.0');
  const stableOutput = prepareArtifacts({ manifest: stable, surfaces: rcSurfaces, changelog: { ...changelog, content: rcOutput[changelog.path] } });
  assert.match(stableOutput.VERSION, /^1\.1\.0\s*$/);
  assert.match(stableOutput['ProjectSettings/ProjectSettings.asset'], /bundleVersion: 1\.1\.0\s*$/);
  assert.match(stableOutput['doxygen/dirigible.Doxyfile'], /PROJECT_NUMBER = 1\.1\.0\s*$/);
  const stableSurfaces = baselineSurfaces.map(s => ({ ...s, content: stableOutput[s.path] }));
  assert.deepEqual(prepareArtifacts({ manifest: stable, surfaces: stableSurfaces, changelog: { ...changelog, content: stableOutput[changelog.path] } }), stableOutput);
  git(repo, 'switch', '-qc', 'main');
  for (const [path, content] of Object.entries(stableOutput)) writeFileSync(join(repo, path), content);
  git(repo, 'add', 'VERSION', 'ProjectSettings', 'doxygen', 'Changelog');
  git(repo, 'commit', '-qm', 'chore(release): prepare stable release');
  const releaseRevision = git(repo, 'rev-parse', 'HEAD');
  // The supplied verification OID is a test fixture, not an authenticated Captain receipt.
  const request = { repo, manifest: stable, releaseRevision, verifiedRevision: releaseRevision,
    branchRef: 'refs/heads/main', surfaces: baselineSurfaces.map(({path, kind}) => ({path, kind})),
    changelogPath: changelog.path, tag: true };
  assert.equal(finalizeRelease(request).tag_action, 'created');
  assert.equal(finalizeRelease(request).tag_action, 'existing');
  assert.equal(git(repo, 'cat-file', '-t', 'refs/tags/v1.1.0'), 'tag');
  assert.equal(git(repo, 'rev-parse', 'refs/tags/v1.1.0^{commit}'), releaseRevision);
  console.log('Partial demo passed: two worktrees, fixture-constructed squash transport, RC/stable artifacts and disposable tag. Captain promotion, authenticated verification, and human adjudication are not exercised.');
} finally { rmSync(tmp, { recursive: true, force: true }); }
