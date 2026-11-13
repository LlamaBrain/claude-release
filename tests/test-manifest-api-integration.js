import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cli = resolve('plugin/lib/build-manifest.js');
const dirs = [];
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'claude-release-classification-'));
  dirs.push(cwd);
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'fixture@example.invalid');
  git(cwd, 'config', 'user.name', 'Fixture');
  return cwd;
}
function commit(cwd, message) {
  git(cwd, 'add', 'Api.cs');
  git(cwd, 'commit', '-qm', message);
}
function manifest(cwd, args = []) {
  return JSON.parse(execFileSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
try {
  for (const type of ['fix', 'feat']) {
    const cwd = repository();
    writeFileSync(join(cwd, 'Api.cs'), 'namespace Example { public class Thing { public void Before() {} } }\n');
    commit(cwd, 'feat: create API');
    git(cwd, 'tag', 'v1.0.0');
    writeFileSync(join(cwd, 'Api.cs'), 'namespace Example { public class Thing { } }\n');
    commit(cwd, `${type}: change API`);
    const result = manifest(cwd);
    assert.equal(result.api_analysis.status, 'analyzed');
    assert.equal(result.bump_kind, 'major', `${type} must be promoted by removed API`);
    assert.equal(result.next_version, 'v2.0.0');
    const target = git(cwd, 'rev-parse', 'HEAD');
    writeFileSync(join(cwd, 'Api.cs'), 'namespace Example { public class Thing { public void Before() {} } }\n');
    commit(cwd, 'fix: restore API');
    const exact = manifest(cwd, ['--baseline', 'v1.0.0', '--target', target]);
    assert.equal(exact.target_revision, target);
    assert.equal(exact.bump_kind, 'major');
    assert.equal(exact.api_analysis.status, 'analyzed');
    assert.equal(exact.api_analysis.source_fingerprints.algorithm, 'sha256');
    assert.match(exact.api_analysis.source_fingerprints.base, /^[0-9a-f]{64}$/);
    assert.match(exact.api_analysis.source_fingerprints.target, /^[0-9a-f]{64}$/);
    assert.notEqual(exact.api_analysis.source_fingerprints.base, exact.api_analysis.source_fingerprints.target);
    const current = git(cwd, 'rev-parse', 'HEAD');
    const feature = manifest(cwd, ['--baseline', 'v1.0.0', '--target', current, '--compatibility-base', target]);
    assert.equal(feature.compatibility_analysis.base_revision, target);
    assert.equal(feature.compatibility_analysis.target_revision, current);
    assert.ok(feature.compatibility_diff.added.length > 0);
    assert.equal(feature.compatibility_analysis.source_fingerprints.base, exact.api_analysis.source_fingerprints.target);
    assert.equal(feature.compatibility_analysis.source_fingerprints.target, exact.api_analysis.source_fingerprints.base);
  }
  const noBaseline = repository();
  writeFileSync(join(noBaseline, 'Api.cs'), 'namespace Example { public class Thing { } }\n');
  commit(noBaseline, 'fix: initialize');
  const unavailable = manifest(noBaseline);
  assert.equal(unavailable.api_analysis.status, 'unavailable');
  assert.equal(unavailable.api_diff, null);
  assert.equal(unavailable.api_analysis.source_fingerprints, null);
  writeFileSync(join(noBaseline, 'VERSION'), '1.0.0\n');
  git(noBaseline, 'add', 'VERSION'); git(noBaseline, 'commit', '-qm', 'chore: record baseline');
  const initialBase = git(noBaseline, 'rev-parse', 'HEAD');
  writeFileSync(join(noBaseline, 'Api.cs'), 'namespace Example { public class Thing { public void Run() {} } }\n');
  commit(noBaseline, 'feat: add method');
  const initialTarget = git(noBaseline, 'rev-parse', 'HEAD');
  const initial = manifest(noBaseline, ['--baseline-ref', initialBase, '--baseline-version', '1.0.0', '--baseline-surface', 'VERSION', '--target', initialTarget]);
  assert.equal(initial.baseline_kind, 'declared_initial');
  assert.equal(initial.bump_kind, 'minor');
  assert.throws(() => manifest(noBaseline, ['--baseline-ref', initialBase, '--baseline-version', '2.0.0', '--baseline-surface', 'VERSION', '--target', initialTarget]));
  writeFileSync(join(noBaseline, 'Api.cs'), 'namespace Example { public class Thing { public void Run() {} } } // metadata\n');
  commit(noBaseline, 'update: revise metadata');
  const customTarget = git(noBaseline, 'rev-parse', 'HEAD');
  const typeMap = join(noBaseline, 'type-map.json'); writeFileSync(typeMap, JSON.stringify({update:'none'}));
  const custom = manifest(noBaseline, ['--baseline-ref', initialTarget, '--baseline-version', '1.0.0', '--baseline-surface', 'VERSION', '--target', customTarget, '--type-map', typeMap]);
  assert.equal(custom.bump_kind, 'none'); assert.equal(custom.type_map.update, 'none');
  const graduation = repository();
  writeFileSync(join(graduation, 'Api.cs'), 'namespace Example { public class Thing { public void Before() {} } }\n');
  commit(graduation, 'feat: create API');
  git(graduation, 'tag', 'v1.0.0-rc.1');
  writeFileSync(join(graduation, 'Api.cs'), 'namespace Example { public class Thing { } }\n');
  commit(graduation, 'fix: remove API');
  assert.throws(() => manifest(graduation), /Command failed/);
  const rcRepo = repository();
  writeFileSync(join(rcRepo,'Api.cs'),'namespace Example { public class Thing {} }\n');
  writeFileSync(join(rcRepo,'VERSION'),'1.0.0\n'); writeFileSync(join(rcRepo,'CHANGELOG.md'),'# Changelog\n');
  git(rcRepo,'add','Api.cs','VERSION','CHANGELOG.md');git(rcRepo,'commit','-qm','chore: baseline');const rcBase=git(rcRepo,'rev-parse','HEAD');git(rcRepo,'tag','v1.0.0');git(rcRepo,'branch','stage');git(rcRepo,'checkout','-qb','dev');
  writeFileSync(join(rcRepo,'Api.cs'),'namespace Example { public class Thing { public void Run() {} } }\n');commit(rcRepo,'feat: add API');const rcTarget=git(rcRepo,'rev-parse','HEAD');
  const rcArgs=['--baseline','latest-stable','--target',rcTarget,'--prerelease','rc','--candidate-ref','refs/heads/stage','--candidate-head',rcBase,'--candidate-version-surface','VERSION','--candidate-changelog','CHANGELOG.md'];
  const firstRc=manifest(rcRepo,rcArgs);assert.equal(firstRc.next_version,'v1.1.0-rc.0');assert.equal(firstRc.candidate_state.action,'first');
  git(rcRepo,'checkout','stage');writeFileSync(join(rcRepo,'VERSION'),'1.1.0-rc.0\n');writeFileSync(join(rcRepo,'CHANGELOG.md'),`# Changelog\n\n## [v1.1.0-rc.0] - 2026-11-12\n\n<!-- captain-release baseline:${rcBase} target:${rcTarget} -->\n`);git(rcRepo,'add','VERSION','CHANGELOG.md');git(rcRepo,'commit','-qm','chore: prepare candidate');const rcStage=git(rcRepo,'rev-parse','HEAD');
  assert.throws(()=>manifest(rcRepo,rcArgs));
  const repeated=manifest(rcRepo,rcArgs.map(arg=>arg===rcBase?rcStage:arg));assert.equal(repeated.next_version,'v1.1.0-rc.0');assert.equal(repeated.candidate_state.action,'reuse');
  console.log('bundled manifest API evidence integration passed');
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}
