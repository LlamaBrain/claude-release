import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyCandidateState} from '../src/candidate-state.js';
import {adjudicateRelease} from '../src/adjudicate-release.js';
const root=mkdtempSync(join(tmpdir(),'captain-rc-state-')), old=process.cwd();
function git(...a){return execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
try {
  git('init','-q','-b','dev');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  writeFileSync(join(root,'VERSION'),'1.0.0\n');writeFileSync(join(root,'CHANGELOG.md'),'# Changelog\n');git('add','.');git('commit','-qm','chore: initialize'); const baseline=git('rev-parse','HEAD');
  git('branch','stage');writeFileSync(join(root,'one'),'one');git('add','.');git('commit','-qm','feat: add one');const first=git('rev-parse','HEAD');
  writeFileSync(join(root,'two'),'two');git('add','.');git('commit','-qm','fix: add two');const second=git('rev-parse','HEAD');
  process.chdir(root);
  const options={branchRef:'refs/heads/stage',expectedHead:baseline,versionPath:'VERSION',changelogPath:'CHANGELOG.md'};
  const manifest={previous_version:'v1.0.0',next_version:'v1.1.0-rc.0',bump_kind:'minor',baseline_revision:baseline,target_revision:first,prerelease_id:'rc'};
  const nothing=applyCandidateState({...manifest,bump_kind:'none',next_version:'v1.0.0'},options); assert.equal(nothing.candidate_state.action,'none'); assert.equal(nothing.next_version,'v1.0.0');
  const initial=applyCandidateState(manifest,options);assert.equal(initial.next_version,'v1.1.0-rc.0');assert.equal(initial.candidate_state.action,'first');
  git('checkout','stage');writeFileSync(join(root,'VERSION'),'1.1.0-rc.0\n');writeFileSync(join(root,'CHANGELOG.md'),`# Changelog\n\n## [v1.1.0-rc.0] - 2026-11-12\n\n<!-- captain-release baseline:${baseline} target:${first} -->\n`);git('add','.');git('commit','-qm','chore: prepare RC'); const stageHead=git('rev-parse','HEAD');
  assert.throws(()=>applyCandidateState(manifest,options),/stag.*changed/i);
  const fresh={...options,expectedHead:stageHead};const repeat=applyCandidateState(manifest,fresh);
  assert.equal(repeat.next_version,'v1.1.0-rc.0');assert.equal(repeat.candidate_state.action,'reuse');
  const next=applyCandidateState({...manifest,target_revision:second},fresh);
  assert.equal(next.next_version,'v1.1.0-rc.1');assert.equal(next.candidate_state.action,'increment');
  const higher=applyCandidateState({...manifest,target_revision:second,bump_kind:'major',next_version:'v2.0.0-rc.0'},fresh);
  assert.equal(higher.next_version,'v2.0.0-rc.0');assert.equal(higher.candidate_state.action,'new_series');
  const observed={...higher,type_map:{feat:'minor'},commits:[{type:'feat',breaking:true}],api_analysis:{status:'analyzed',bump_kind:'none'},api_diff:{added:[],removed:[],changed:[]},compatibility_analysis:{status:'analyzed',bump_kind:'none',base_revision:baseline,target_revision:second},compatibility_diff:{added:[],removed:[],changed:[]}};
  const verified={scope:'all_findings',base:baseline,head:second,finding_sha256:'f'.repeat(64),choice:'reject-major',actor:'Michael',justification:'Compatible.'};
  const reordered={...observed,candidate_state:Object.fromEntries(Object.entries(observed.candidate_state).reverse())};
  const effective=adjudicateRelease(reordered,'signed-ref',{verifyDecision:()=>verified}).manifest;
  assert.equal(effective.next_version,'v1.1.0-rc.1'); assert.equal(effective.candidate_state.action,'increment');
  console.log('candidate state and stale stage rejection passed');
} finally {process.chdir(old);rmSync(root,{recursive:true,force:true});}
