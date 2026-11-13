import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareArtifacts } from '../src/prepare-artifacts.js';
import { finalizeRelease } from '../src/finalize-release.js';
const prepareCli = resolve('plugin/lib/prepare-artifacts.js');
const finalizeCli = resolve('plugin/lib/finalize-release.js');
const repo = mkdtempSync(join(tmpdir(),'claude-release-finalize-'));
function git(...args) { return execFileSync('git', args, {cwd:repo, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim(); }
try {
  git('init','-q','-b','main'); git('config','user.email','fixture@example.invalid'); git('config','user.name','Fixture');
  writeFileSync(join(repo,'VERSION'),'1.0.0\n'); writeFileSync(join(repo,'CHANGELOG.md'),'# Changelog\n\n## [v1.0.0] - 2026-01-01\n\n### Fixed\n\n- historical behavior (abcdef1)\n');
  git('add','.'); git('commit','-qm','chore: initialize'); const baseline = git('rev-parse','HEAD'); git('tag','v1.0.0');
  writeFileSync(join(repo,'app.txt'),'feature\n'); git('add','.'); git('commit','-qm','feat: add feature'); const target = git('rev-parse','HEAD');
  const manifest = {previous_version:'v1.0.0', next_version:'v1.1.0', bump_kind:'minor', baseline_revision:baseline, target_revision:target, release_date:'2026-11-12', api_analysis:{status:'analyzed'}, commits:[{hash:target.slice(0,7),type:'feat',subject:'add feature'}]};
  const surface = {path:'VERSION',kind:'text',content:readFileSync(join(repo,'VERSION'),'utf8')};
  const request = {manifest,surfaces:[surface],changelog:{path:'CHANGELOG.md',content:readFileSync(join(repo,'CHANGELOG.md'),'utf8')}};
  const outputs = prepareArtifacts(request);
  const requestPath = join(repo, 'request.json');
  writeFileSync(requestPath, JSON.stringify(request));
  const bundled = JSON.parse(execFileSync(process.execPath,[prepareCli,'--request',requestPath],{cwd:repo,encoding:'utf8'}));
  assert.deepEqual(bundled, outputs);
  rmSync(requestPath);
  git('checkout','-qb','new-milestone',target);
  const newOutputs=prepareArtifacts({...request,changelog:{path:'NEW.md',content:'# Changelog\n'}});
  writeFileSync(join(repo,'VERSION'),newOutputs.VERSION);writeFileSync(join(repo,'NEW.md'),newOutputs['NEW.md']);
  git('add','VERSION','NEW.md');git('commit','-qm','chore: prepare new milestone');const newRevision=git('rev-parse','HEAD');
  assert.equal(finalizeRelease({repo,manifest,releaseRevision:newRevision,verifiedRevision:newRevision,branchRef:'refs/heads/new-milestone',surfaces:[{path:'VERSION',kind:'text'}],changelogPath:'NEW.md'}).tag_action,'none');
  git('checkout','main');
  git('checkout','-qb','forged-mode',target);
  writeFileSync(join(repo,'VERSION'),outputs.VERSION);writeFileSync(join(repo,'CHANGELOG.md'),outputs['CHANGELOG.md']);
  // Keep the Linux working-tree mode aligned with the deliberately forged index mode.
  if (process.platform !== 'win32') chmodSync(join(repo,'VERSION'),0o755);
  git('add','VERSION','CHANGELOG.md');git('update-index','--chmod=+x','VERSION');git('commit','-qm','chore: forge release mode');const modeRevision=git('rev-parse','HEAD');
  assert.throws(()=>finalizeRelease({repo,manifest,releaseRevision:modeRevision,verifiedRevision:modeRevision,branchRef:'refs/heads/forged-mode',surfaces:[{path:'VERSION',kind:'text'}],changelogPath:'CHANGELOG.md'}),/artifacts/);
  git('checkout','main');
  for (const [label, changelog] of [
    ['deleted', outputs['CHANGELOG.md'].slice(0,outputs['CHANGELOG.md'].indexOf('## [v1.0.0]'))],
    ['altered', outputs['CHANGELOG.md'].replace('historical behavior','forged history')],
  ]) {
    git('checkout','-qb','forged-'+label,target);
    writeFileSync(join(repo,'VERSION'),outputs.VERSION);writeFileSync(join(repo,'CHANGELOG.md'),changelog);
    git('add','VERSION','CHANGELOG.md');git('commit','-qm','chore: forge release history');
    const forgedRevision=git('rev-parse','HEAD');
    const forgedRequest={repo,manifest,releaseRevision:forgedRevision,verifiedRevision:forgedRevision,branchRef:'refs/heads/forged-'+label,surfaces:[{path:'VERSION',kind:'text'}],changelogPath:'CHANGELOG.md'};
    assert.throws(()=>finalizeRelease(forgedRequest),/artifacts/);
    writeFileSync(requestPath,JSON.stringify(forgedRequest));
    assert.throws(()=>execFileSync(process.execPath,[finalizeCli,'--request',requestPath],{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    rmSync(requestPath);
    git('checkout','main');
  }
  for (const [path,content] of Object.entries(outputs)) writeFileSync(join(repo,path),content);
  git('add','.'); git('commit','-qm','chore: prepare release'); const releaseRevision = git('rev-parse','HEAD');
  const args = {repo, manifest, releaseRevision, verifiedRevision:releaseRevision, branchRef:'refs/heads/main', surfaces:[{path:'VERSION',kind:'text'}], changelogPath:'CHANGELOG.md'};
  const tree = git('rev-parse', releaseRevision + '^{tree}');
  const unrelated = git('commit-tree', tree, '-p', baseline, '-m', 'chore: unrelated');
  git('update-ref', 'refs/heads/unrelated', unrelated);
  const unrelatedArgs = {...args, releaseRevision:unrelated, verifiedRevision:unrelated, branchRef:'refs/heads/unrelated'};
  assert.throws(() => finalizeRelease({...unrelatedArgs, squashVerified:true}));
  assert.throws(() => finalizeRelease(unrelatedArgs, {verifySquash:()=>false}));
  assert.equal(finalizeRelease(unrelatedArgs, {verifySquash:e => e.sourceHead === target && e.destination === unrelated && e.baselineRevision === baseline}).tag_action,'none');
  assert.equal(finalizeRelease(args).tag_action,'none');
  assert.throws(()=>git('rev-parse','--verify','refs/tags/v1.1.0'));
  assert.throws(()=>finalizeRelease({...args,verifiedRevision:target}));
  assert.throws(()=>finalizeRelease({...args,branchRef:'refs/heads/missing'}));
  git('tag','v1.1.0',target);
  assert.throws(() => finalizeRelease({...args,tag:true}));
  git('tag','-d','v1.1.0');
  assert.equal(finalizeRelease({...args,tag:true}).tag_action,'created');
  assert.equal(git('cat-file','-t','refs/tags/v1.1.0'),'tag');
  assert.equal(git('rev-parse','v1.1.0^{commit}'),releaseRevision);
  assert.equal(finalizeRelease({...args,tag:true}).tag_action,'existing');
  writeFileSync(requestPath, JSON.stringify(args));
  const finalized = JSON.parse(execFileSync(process.execPath,[finalizeCli,'--request',requestPath,'--tag'],{cwd:repo,encoding:'utf8'}));
  assert.equal(finalized.tag_action, 'existing');
  console.log('verified release finalization passed');
} finally { rmSync(repo,{recursive:true,force:true}); }
