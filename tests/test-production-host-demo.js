import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const cli = process.env.CAPTAIN_ORCHESTRATOR_CLI;
if (!cli) throw new Error('CAPTAIN_ORCHESTRATOR_CLI required');
const root = mkdtempSync(join(tmpdir(), 'captain-production-host-'));
const repo = join(root, 'repo'); mkdirSync(repo);
const releaseRoot = process.cwd();
const releaseCli = resolve('plugin/lib/build-manifest.js');
const releaseModule = resolve('plugin/lib/finalize-release.js');
const bridgeSource = resolve(dirname(cli), '../../../../../src/Captain.Orchestrator.Cli/Bridge/verified-finalizer.mjs');
const bridge = join(root, 'verified-finalizer.mjs');
writeFileSync(bridge, "if(process.env.CAPTAIN_SEQUENCE_AUTH_KEY)throw new Error('authority key leaked into bridge');\n" + readFileSync(bridgeSource, 'utf8'));
const { prepareArtifacts } = await import(pathToFileURL(resolve('src/prepare-artifacts.js')).href);
const env = { ...process.env, CAPTAIN_SEQUENCE_AUTH_KEY: randomBytes(32).toString('base64') };
const rejectMajor = process.env.CAPTAIN_FIXTURE_REJECT_MAJOR === '1';
let fixtureDecisions = 0;
const decisionFindings = new Map();
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex');
function run(file, args, cwd = repo) { return execFileSync(file, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function git(...args) { return run('git', args); }
function captain(...args) { return run('dotnet', [cli, ...args]); }
function decide(base, head, finding, report) {
  assert.ok(rejectMajor && /^[0-9a-f]{64}$/i.test(finding) && /^[0-9a-f]{64}$/i.test(report));
  const state = join(root, '.captain-sdlc-state');
  const reportPath = readdirSync(state).map(id => join(state, id, 'release-intents', report + '.json')).find(path => { try { readFileSync(path); return true; } catch { return false; } });
  assert.ok(reportPath, 'signed decision must point to a persisted report');
  const reportData = JSON.parse(readFileSync(reportPath, 'utf8'));
  const concrete = JSON.stringify([reportData.api_diff?.removed ?? [], reportData.api_diff?.changed ?? [], reportData.compatibility_diff?.removed ?? [], reportData.compatibility_diff?.changed ?? []]);
  assert.match(concrete, /OldApi/, 'fixture decision must cover the concrete removed API');
  const key = 'Example.Stable.OldApi removed';
  decisionFindings.set(key, (decisionFindings.get(key) ?? 0) + 1);
  assert.match(captain('compatibility', 'decide', '--project-root', repo, '--base', base, '--head', head, '--digest', finding,
    '--report-digest', report, '--choice', 'reject-major', '--actor', 'fixture-operator', '--reason', 'Fixture consumer compatibility was reviewed', '--all-findings'), /recorded/);
  fixtureDecisions++;
}
function promotionIntent(args, base, head) {
  try { return JSON.parse(captain(...args)); }
  catch (error) {
    if (!rejectMajor) throw error;
    const result = JSON.parse(String(error.stdout).trim());
    assert.equal(result.Status, 'needs_human');
    const humanReport = readFileSync(result.HumanReportPath, 'utf8');
    assert.ok(humanReport.includes(base) && humanReport.includes(head));
    assert.match(humanReport, /consumer impact and migration/i);
    decide(base, head, result.FindingDigest, result.ReportDigest);
    return JSON.parse(captain(...args));
  }
}
function landingPreview(targetBranch, targetHead, sourceBase, task) {
  const args = ['release', 'prepare-landing', '--project-root', repo, '--target-branch', targetBranch, '--target-head', targetHead,
    '--source-base', sourceBase, '--source-head', task.oid, '--source-run-id', task.id];
  try { return JSON.parse(captain(...args)); }
  catch (error) {
    if (!rejectMajor) throw error;
    const result = JSON.parse(String(error.stdout).trim()); assert.equal(result.Status, 'needs_human');
    decide(targetHead, result.PreviewHead, result.FindingDigest, result.ReportDigest);
    return JSON.parse(captain(...args));
  }
}
try {
  git('init', '-q', '-b', 'landing');
  git('config', 'user.email', 'fixture@example.invalid'); git('config', 'user.name', 'Fixture'); git('config', 'core.autocrlf', 'false');
  mkdirSync(join(repo, '.captain-sdlc', 'sequences'), { recursive: true });
  mkdirSync(join(repo, 'ProjectSettings')); mkdirSync(join(repo, 'doxygen'));
  const surfaces = [{ path: 'VERSION', kind: 'text' }, { path: 'ProjectSettings/ProjectSettings.asset', kind: 'unity' }, { path: 'doxygen/dirigible.Doxyfile', kind: 'doxygen' }];
  const changelogPath = 'Changelog/M01_CHANGELOG.md';
  writeFileSync(join(repo, '.gitignore'), '/.captain-sdlc/*\n!/.captain-sdlc/project-policy.json\n!/.captain-sdlc/sequences/\n/stage-build.txt\n/stage-smoke.txt\n');
  const sequence = { schema_version: 1, sequence_id: 'release-fixture', title: 'Release fixture', profile: 'pre-release', completion_kind: 'release', steps: [
    { id: 'implement', kind: 'implement', artifacts: [{ path: 'stage-build.txt', role: 'build' }, { path: 'stage-smoke.txt', role: 'smoke' }] },
    { id: 'commit', kind: 'commit_gate' }, { id: 'prove', kind: 'prove', proof_scopes: ['super-smoke'] } ] };
  const sequencePath = join(repo, '.captain-sdlc/sequences/release-fixture.md');
  writeFileSync(sequencePath, '# Release fixture\n\n```captain-sequence\n' + JSON.stringify(sequence) + '\n```\n');
  const policy = { schema_version: 1, commit: { mode: 'branch_driven', conventional: true, require_task_trailer: true,
    version_surfaces: surfaces.map(s => ({ path: s.path, pattern: String.raw`(?<version>[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)` })) },
    release: { auto_prepare_pr: true, branches: [{ pattern: 'captain/*', role: 'implementation' }, { pattern: 'dev', role: 'development' }, { pattern: 'bad/*', role: 'development' }, { pattern: 'stage', role: 'staging' }, { pattern: 'landing', role: 'production' }],
      transitions: [{ from: 'captain/*', to: 'dev' }, { from: 'captain/*', to: 'bad/*' }, { from: 'dev', to: 'stage' }, { from: 'bad/*', to: 'stage' }, { from: 'stage', to: 'landing' }], intent: { executable: process.execPath, script: releaseCli, script_sha256: hash(releaseCli), stable_baseline: 'latest-stable', contracts: ['csharp_public_api'], contracts_exhaustive: true, contracts_exhaustive_reason: 'The fixture exports only the analyzed C# public API.', candidate_version_surface: 'VERSION', candidate_changelog: changelogPath, prerelease_identifier: 'rc' },
      integration_verification: { executable: process.execPath, arguments: 'verify.cjs' },
      finalizer: { module: releaseModule, module_sha256: hash(releaseModule), bridge, bridge_sha256: hash(bridge), surfaces, changelog_path: changelogPath } } };
  writeFileSync(join(repo, '.captain-sdlc/project-policy.json'), JSON.stringify(policy));
  writeFileSync(join(repo, 'VERSION'), '1.0.0\n'); writeFileSync(join(repo, 'ProjectSettings/ProjectSettings.asset'), '  bundleVersion: 1.0.0\n');
  writeFileSync(join(repo, 'doxygen/dirigible.Doxyfile'), 'PROJECT_NUMBER = 1.0.0\n');
  writeFileSync(join(repo, 'Api.cs'), rejectMajor ? 'namespace Example { public class Stable { public void OldApi() {} } }\n' : 'namespace Example { public class Stable {} }\n');
  mkdirSync(join(repo, 'Changelog')); writeFileSync(join(repo, changelogPath), '# Changelog\n');
  writeFileSync(join(repo, 'verify.cjs'), "const f=require('fs'); if(process.env.CAPTAIN_SEQUENCE_AUTH_KEY||f.readFileSync('build.txt','utf8')!=='build-ok\\n'||f.readFileSync('smoke.txt','utf8')!=='smoke-ok\\n')process.exit(1);\n");
  writeFileSync(join(repo, 'stage-create.cjs'), "const f=require('fs');const n=f.existsSync('stage-build.txt')?parseInt(f.readFileSync('stage-build.txt','utf8'))+1:1;f.writeFileSync('stage-build.txt',n+'-build\\n');f.writeFileSync('stage-smoke.txt',n+'-smoke\\n');\n");
  writeFileSync(join(repo, 'worker.cjs'), "const f=require('fs'),p=require('child_process');if(process.env.CAPTAIN_SEQUENCE_AUTH_KEY)process.exit(1);const id=process.env.CAPTAIN_TASK_ID; f.writeFileSync('build.txt','build-ok\\n');f.writeFileSync('smoke.txt','smoke-ok\\n');f.writeFileSync(id.endsWith('one')?'one.txt':'two.txt',id);const paths=['build.txt','smoke.txt',id.endsWith('one')?'one.txt':'two.txt'];if(process.env.CAPTAIN_FIXTURE_REJECT_MAJOR==='1'&&id.endsWith('one')){f.writeFileSync('Api.cs','namespace Example { public class Stable {} }\\n');paths.push('Api.cs')}p.execFileSync('git',['add',...paths]);p.execFileSync('git',['commit','-qm','feat(core): prove fixture\\n\\nImplements: '+id]);\n");
  git('add', '.gitignore', '.captain-sdlc', 'VERSION', 'ProjectSettings', 'doxygen', 'Changelog', 'Api.cs', 'verify.cjs', 'stage-create.cjs', 'worker.cjs');
  git('commit', '-qm', 'chore: establish trusted fixture'); const base = git('rev-parse', 'HEAD'); git('tag', '-a', 'v1.0.0', '-m', 'fixture baseline'); git('branch', 'dev'); git('branch', 'stage');
  const task = join(root, 'task.json'), route = join(root, 'route.json');
  writeFileSync(route, JSON.stringify({ schema_version: 1, default_route: 'worker', routes: [{ name: 'worker', adapter: 'worker', when: {} }] }));
  const tasks = [];
  for (const suffix of ['one', 'two']) {
    writeFileSync(task, JSON.stringify({ schema_version: 1, task_id: 'fixture#' + suffix, title: 'Fixture task ' + suffix, source: 'fixture', status: 'open' }));
    const runOutput = captain('run', '--project-root', repo, '--task', task, '--policy', route, '--worker-command', 'worker=node worker.cjs', '--prove', 'node verify.cjs', '--keep-worktree');
    const id = runOutput.split(/\s+/)[0]; assert.match(runOutput, /success/);
    const worktree = join(repo, '.captain-sdlc/worktrees', id);
    for (const surface of surfaces) assert.equal(readFileSync(join(worktree, surface.path), 'utf8'), readFileSync(join(repo, surface.path), 'utf8'));
    const approveArgs = ['prepare-pr', '--project-root', repo, '--run-id', id, '--base', 'dev', '--title', 'feat(core): prove fixture', '--skip-push', '--skip-pr'];
    try { captain(...approveArgs); }
    catch (error) {
      if (!rejectMajor) throw error;
      const finding = /finding ([0-9a-f]{64}); report digest ([0-9a-f]{64})/i.exec(String(error.stderr));
      assert.ok(finding, String(error.stderr));
      const sourceHead = run('git', ['rev-parse', 'HEAD'], worktree);
      decide(base, sourceHead, finding[1], finding[2]);
      captain(...approveArgs);
    }
    tasks.push({ id, oid: git('rev-parse', `captain/${id}`) });
  }
  const runId = 'aggregate-promotion';
  git('switch', '-q', 'dev');
  let devProofBase;
  for (const [index, entry] of tasks.entries()) {
    let landingBase = base, landingHead = entry.oid, landingRun = entry.id;
    if (index === 1) {
      const preview = landingPreview('dev', devProofBase, base, entry);
      assert.equal(preview.Status, 'ready'); landingBase = devProofBase; landingHead = preview.PreviewHead; landingRun = preview.PreviewRunId;
      assert.equal(git('rev-parse', `captain/${entry.id}`), entry.oid, 'feature branch must remain unchanged');
    }
    const subject = 'chore: integrate feature';
    const footer = captain('squash', 'prepare', '--project-root', repo, '--base', landingBase, '--head', landingHead, '--run-id', landingRun, '--subject', subject);
    if (index === 0) {
      git('merge', '--squash', landingHead); git('commit', '-qm', subject + '\n\n' + footer);
      devProofBase = git('rev-parse', 'HEAD');
    } else {
      const msg = join(root, 'dev-message.txt'); writeFileSync(msg, subject + '\n\n' + footer + '\n');
      const devStep = `git merge --squash ${landingHead} && node stage-create.cjs && git commit -F "${msg}"`;
      assert.match(captain('sequence', 'run', '--project-root', repo, '--sequence', sequencePath, '--run-id', 'dev-proof', '--step-command', `implement=${devStep}`, '--proof-command', 'super-smoke=node verify.cjs'), /dev-proof green/);
    }
    assert.match(captain('squash', 'verify', '--project-root', repo, '--base', landingBase, '--head', landingHead, '--run-id', landingRun, '--destination', git('rev-parse', 'HEAD')), /metadata verified/);
  }
  const stageHead = git('rev-parse', 'HEAD');
  const devPromotion = promotionIntent(['release', 'prepare-intent', '--project-root', repo, '--source-branch', 'dev', '--target-branch', 'stage', '--source-head', stageHead, '--target-head', base, '--proof-base', devProofBase, '--sequence-run-id', 'dev-proof', '--run-id', 'dev-promotion'], base, stageHead);
  assert.equal(devPromotion.Status, 'ready');
  const rc = JSON.parse(readFileSync(devPromotion.ReportPath, 'utf8'));
  if (!rejectMajor) for (const mode of ['missing', 'tampered']) {
    const branch = 'bad/' + mode;
    git('switch', '-qc', branch, base);
    git('merge', '--squash', tasks[0].oid);
    const original = captain('squash', 'prepare', '--project-root', repo, '--base', base, '--head', tasks[0].oid, '--run-id', tasks[0].id, '--subject', 'chore: integrate feature');
    let firstMessage = 'chore: integrate feature';
    if (mode === 'tampered') {
      const lines = original.split('\n'); const index = lines.findIndex(line => line.startsWith('Captain-Changes: '));
      const data = JSON.parse(Buffer.from(lines[index].slice('Captain-Changes: '.length), 'base64url').toString('utf8'));
      data.commits[0].message = data.commits[0].message.replace('feat(core)', 'fix(core)');
      lines[index] = 'Captain-Changes: ' + Buffer.from(JSON.stringify(data)).toString('base64url');
      firstMessage += '\n\n' + lines.join('\n');
    }
    git('commit', '-qm', firstMessage); const badBase = git('rev-parse', 'HEAD');
    const badPreview = landingPreview(branch, badBase, base, tasks[1]);
    assert.equal(badPreview.Status, 'ready');
    const footer = captain('squash', 'prepare', '--project-root', repo, '--base', badBase, '--head', badPreview.PreviewHead, '--run-id', badPreview.PreviewRunId, '--subject', 'chore: integrate feature');
    const msg = join(root, 'bad-' + mode + '-message.txt'); writeFileSync(msg, 'chore: integrate feature\n\n' + footer + '\n');
    const command = `git merge --squash ${badPreview.PreviewHead} && node stage-create.cjs && git commit -F "${msg}"`;
    assert.match(captain('sequence', 'run', '--project-root', repo, '--sequence', sequencePath, '--run-id', 'bad-' + mode + '-proof', '--step-command', `implement=${command}`, '--proof-command', 'super-smoke=node verify.cjs'), /green/);
    const badHead = git('rev-parse', 'HEAD');
    assert.throws(() => captain('release', 'prepare-intent', '--project-root', repo, '--source-branch', branch, '--target-branch', 'stage', '--source-head', badHead, '--target-head', base, '--proof-base', badBase, '--sequence-run-id', 'bad-' + mode + '-proof', '--run-id', 'bad-' + mode + '-promotion'),
      error => /squash|metadata|semantic|transport/i.test(String(error.stdout) + String(error.stderr)));
  }
  git('switch', '-q', 'dev');
  git('switch', '-qc', 'candidate');
  assert.equal(rc.next_version, 'v1.1.0-rc.0');
  for (const entry of tasks) assert.ok(rc.commits.some(commit => commit.full_hash === entry.oid));
  const rcArtifacts = prepareArtifacts({ manifest: rc, surfaces: surfaces.map(s => ({ ...s, content: readFileSync(join(repo, s.path), 'utf8') })), changelog: { path: changelogPath, content: readFileSync(join(repo, changelogPath), 'utf8') } });
  const writer = join(root, 'write-artifacts.cjs'), rcPath = join(root, 'rc.json');
  writeFileSync(writer, "const f=require('fs'),p=require('path'); for(const [n,c] of Object.entries(JSON.parse(f.readFileSync(process.argv[2],'utf8')))){f.mkdirSync(p.dirname(n),{recursive:true});f.writeFileSync(n,c)}\n");
  writeFileSync(rcPath, JSON.stringify(rcArtifacts));
  for (const [path, content] of Object.entries(rcArtifacts)) { mkdirSync(dirname(join(repo, path)), { recursive: true }); writeFileSync(join(repo, path), content); }
  git('add', 'VERSION', 'ProjectSettings', 'doxygen', 'Changelog');
  const metadataArgs = ['release', 'authorize-metadata', '--project-root', repo, '--run-id', 'dev-promotion', '--report-digest', devPromotion.ReportDigest, '--subject', 'chore(release): prepare candidate'];
  if (!rejectMajor) {
    writeFileSync(join(repo, changelogPath), rcArtifacts[changelogPath] + '\nUnauthorized historical alteration\n'); git('add', changelogPath);
    assert.throws(() => captain(...metadataArgs));
    writeFileSync(join(repo, changelogPath), rcArtifacts[changelogPath]); git('add', changelogPath);
    writeFileSync(join(repo, 'unauthorized.txt'), 'unauthorized\n'); git('add', 'unauthorized.txt');
    assert.throws(() => captain(...metadataArgs)); git('rm', '--cached', '--quiet', 'unauthorized.txt'); unlinkSync(join(repo, 'unauthorized.txt'));
    git('update-index', '--chmod=+x', 'VERSION'); assert.throws(() => captain(...metadataArgs)); git('update-index', '--chmod=-x', 'VERSION');
  }
  const metadataFooter = captain(...metadataArgs); assert.match(metadataFooter, /^Captain-Release: /);
  const stageMessage = join(root, 'stage-message.txt'); writeFileSync(stageMessage, 'chore(release): prepare candidate\n\n' + metadataFooter + '\n');
  const stageStep = `node stage-create.cjs && git commit -F "${stageMessage}"`;
  assert.match(captain('sequence', 'run', '--project-root', repo, '--sequence', sequencePath, '--run-id', 'stage-proof', '--step-command', `implement=${stageStep}`, '--proof-command', 'super-smoke=node verify.cjs'), /stage-proof green/);
  git('switch', '-q', 'stage'); git('merge', '--ff-only', 'candidate');
  const source = git('rev-parse', 'HEAD');
  const promotion = promotionIntent(['release', 'prepare-intent', '--project-root', repo, '--source-branch', 'stage', '--target-branch', 'landing', '--source-head', source, '--target-head', base, '--proof-base', stageHead, '--sequence-run-id', 'stage-proof', '--run-id', runId], base, source);
  assert.equal(promotion.Status, 'ready');
  if (rejectMajor) {
    const prior = fixtureDecisions;
    const repeated = promotionIntent(['release', 'prepare-intent', '--project-root', repo, '--source-branch', 'stage', '--target-branch', 'landing', '--source-head', source, '--target-head', base, '--proof-base', stageHead, '--sequence-run-id', 'stage-proof', '--run-id', runId], base, source);
    assert.equal(repeated.Status, 'ready'); assert.equal(fixtureDecisions, prior, 'unchanged finding must reuse its decision');
  }
  const stateDir = join(root, '.captain-sdlc-state'); const identity = readdirSync(stateDir)[0]; const intents = join(stateDir, identity, 'release-intents');
  const reportDigest = promotion.ReportDigest; const manifest = JSON.parse(readFileSync(join(intents, reportDigest + '.json'), 'utf8'));
  for (const entry of tasks) assert.ok(manifest.commits.some(commit => commit.full_hash === entry.oid));
  const generated = prepareArtifacts({ manifest, surfaces: surfaces.map(s => ({ ...s, content: readFileSync(join(repo, s.path), 'utf8') })), changelog: { path: changelogPath, content: readFileSync(join(repo, changelogPath), 'utf8') } });
  const generatedPath = join(root, 'artifacts.json'), message = join(root, 'message.txt');
  writeFileSync(generatedPath, JSON.stringify(generated));
  const footer = captain('squash', 'prepare', '--project-root', repo, '--base', base, '--head', source, '--run-id', runId, '--subject', 'chore: land fixture');
  writeFileSync(message, 'chore: land fixture\n\n' + footer + '\n');
  git('switch', '-q', 'landing');
  const step = `git merge --squash ${source} && node "${writer}" "${generatedPath}" && node stage-create.cjs && git add VERSION ProjectSettings doxygen Changelog && git commit -F "${message}"`;
  const sequenceOutput = captain('sequence', 'run', '--project-root', repo, '--sequence', sequencePath, '--run-id', 'release-proof', '--step-command', `implement=${step}`, '--proof-command', 'super-smoke=node verify.cjs');
  assert.match(sequenceOutput, /release-proof green/); const destination = git('rev-parse', 'HEAD');
  const request = join(root, 'request.json');
  writeFileSync(request, JSON.stringify({ manifest, releaseRevision: destination, branchRef: 'refs/heads/landing', surfaces, changelogPath }));
  const args = ['release', 'finalize', '--project-root', repo, '--request', request, '--report-digest', reportDigest, '--source-branch', 'stage', '--target-branch', 'landing', '--source-base', base, '--source-head', source, '--destination', destination, '--landing-parent', base, '--proof-base', base, '--sequence-run-id', 'release-proof', '--run-id', runId, '--tag'];
  const result = () => JSON.parse(captain(...args).split(/\r?\n/).at(-1));
  assert.equal(result().tag_action, 'created');
  assert.equal(result().tag_action, 'existing');
  assert.equal(git('cat-file', '-t', 'v1.1.0'), 'tag'); assert.equal(git('rev-parse', 'v1.1.0^{commit}'), destination);
  if (rejectMajor) assert.equal(decisionFindings.get('Example.Stable.OldApi removed'), 1, 'the same removed API must need only one adjudication across feature, candidate and production');
  git('switch', '-q', 'stage');
  try { git('merge', '--no-ff', '--no-commit', 'landing'); } catch {
    const conflicts = git('diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);
    assert.ok(conflicts.length && conflicts.every(path => [...surfaces.map(s => s.path), changelogPath].includes(path)), 'merge-back has unexpected conflicts');
  }
  for (const path of [...surfaces.map(s => s.path), changelogPath]) writeFileSync(join(repo, path), execFileSync('git', ['show', `landing:${path}`], { cwd: repo }));
  git('add', ...surfaces.map(s => s.path), changelogPath); git('commit', '-qm', 'chore: merge production back into stage');
  const mergedBack = git('rev-parse', 'HEAD');
  assert.ok(git('rev-list', '--parents', '-n', '1', mergedBack).split(' ').includes(destination));
  assert.match(captain('release', 'verify-integration', '--project-root', repo, '--target-head', destination, '--proof-id', 'repeat-proof'), /verified/);
  const repeated = JSON.parse(captain('release', 'prepare-intent', '--project-root', repo, '--source-branch', 'stage', '--target-branch', 'landing', '--source-head', mergedBack, '--target-head', destination, '--proof-base', destination, '--integration-proof-id', 'repeat-proof', '--run-id', 'repeat-promotion'));
  assert.equal(repeated.Status, 'no_release');
  assert.equal(git('tag', '--list', 'v1.1.0').split('\n').length, 1);
  console.log('Two Captain feature runs, dev integration, signed candidate and production promotions, RC/stable artifacts, idempotent tag, real merge-back and post-release no-op passed in a disposable repository.');
} finally { if (process.env.CAPTAIN_KEEP_FIXTURE === '1') console.error('PRESERVED FIXTURE', root); else rmSync(root, { recursive: true, force: true }); }
