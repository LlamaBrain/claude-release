import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const root = mkdtempSync(join(tmpdir(), 'claude-release-two-worktrees-'));
const repo = join(root, 'repo'); mkdirSync(repo);
const cli = resolve('plugin/lib/build-manifest.js');
function git(cwd, ...args) { return execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim(); }
try {
  git(repo, 'init', '-q', '-b', 'dev');
  git(repo, 'config', 'user.email', 'fixture@example.invalid'); git(repo, 'config', 'user.name', 'Fixture');
  writeFileSync(join(repo, 'Api.cs'), 'namespace Example { public class Stable {} }\n');
  writeFileSync(join(repo, 'VERSION'), '1.0.0\n');
  git(repo, 'add', 'Api.cs', 'VERSION'); git(repo, 'commit', '-qm', 'chore: initialize'); git(repo, 'tag', 'v1.0.0');
  const tasks = [
    {id:'one', msg:'feat(ui): add menu\n\nImplements: TASK-1\nCaptain-Run: run-1'},
    {id:'two', msg:'fix(core): repair loading\n\nCompletes: TASK-2\nNeeds-QA: yes'}
  ];
  for (const task of tasks) {
    const wt = join(root, task.id); git(repo, 'worktree', 'add', '-qb', 'feature/' + task.id, wt, 'v1.0.0');
    writeFileSync(join(wt, task.id + '.txt'), task.id); git(wt, 'add', task.id + '.txt'); git(wt, 'commit', '-qm', task.msg);
    task.oid = git(wt, 'rev-parse', 'HEAD'); task.msg = git(wt, 'log', '-1', '--format=%B');
    assert.equal(git(wt, 'show', 'HEAD:VERSION'), '1.0.0');
  }
  for (const task of tasks) {
    git(repo, 'merge', '--squash', 'feature/' + task.id);
    const payload = Buffer.from(JSON.stringify({schema_version:1, commits:[{oid:task.oid, message:task.msg}]})).toString('base64url');
    git(repo, 'commit', '-qm', 'chore: integrate ' + task.id + '\n\nCaptain-Changes: ' + payload);
  }
  assert.equal(git(repo, 'show', 'HEAD:VERSION'), '1.0.0');
  const target = git(repo, 'rev-parse', 'HEAD');
  function manifest(args) { return JSON.parse(execFileSync(process.execPath, [cli, '--baseline', 'v1.0.0', '--target', target, ...args], {cwd:repo, encoding:'utf8', stdio:['ignore','pipe','pipe']})); }
  const rc = manifest(['--prerelease','rc']);
  assert.equal(rc.next_version, 'v1.1.0-rc.0'); assert.equal(rc.bump_kind, 'minor');
  const children = rc.commits.filter(c => !c.squash_summary);
  assert.deepEqual(new Set(children.map(c => c.full_hash)), new Set(tasks.map(t => t.oid)));
  assert.ok(children.every(c => c.squash_hash));
  assert.equal(rc.commits.filter(c => c.squash_summary).length, 2);
  assert.ok(rc.commits.some(c => c.raw.includes('Captain-Run: run-1')));
  assert.ok(rc.commits.some(c => c.raw.includes('Needs-QA: yes')));
  assert.equal(manifest([]).next_version, 'v1.1.0');
  assert.equal(manifest(['--prerelease','rc']).next_version, rc.next_version);
  console.log('two feature worktrees and squash classification passed');
} finally { rmSync(root, {recursive:true, force:true}); }
