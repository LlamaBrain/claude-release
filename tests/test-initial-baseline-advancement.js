import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {computeBump} from '../src/compute-bump.js';
const engines=['src/compute-bump.js','plugin/lib/compute-bump.js','plugin/lib/build-manifest.js'].map(path=>resolve(path)), root=mkdtempSync(join(tmpdir(),'release-initial-advance-')), cwd=process.cwd();
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const commit=(subject,version)=>{
  if(version){writeFileSync(join(root,'VERSION'),version+'\n');writeFileSync(join(root,'plugin.json'),JSON.stringify({VersionName:version})+'\n');}
  git('add','.');git('commit','--allow-empty','-qm',subject);return git('rev-parse','HEAD');
};
try {
  git('init','-q','-b','dev');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  const old=commit('chore: initialize','1.0.0');git('tag','-a','v1.0.0','-m','Legacy stable');
  const initial=commit('chore: declare adoption baseline','2.0.0');
  const first=commit('fix: correct widget');
  process.chdir(root);
  const options={baselineRef:initial,baselineVersion:'2.0.0',baselineSurface:'VERSION',target:first,advanceBaseline:true};
  const fallback=computeBump(options);
  assert.equal(fallback.previous_version,'2.0.0');assert.equal(fallback.baseline_kind,'declared_initial');
  assert.deepEqual(fallback.initial_baseline,{revision:initial,version:'2.0.0',surface:'VERSION'});
  assert.equal(fallback.baseline_tag,null);assert.equal(fallback.baseline_tag_object,null);
  const release=commit('feat: prepare widget release','2.1.0');git('tag','-a','v2.1.0','-m','Stable');
  const after=commit('fix: correct released widget');
  git('tag','v8.0.0',after); // Lightweight tags never become manufactured release baselines.
  const advanced=computeBump({...options,target:after});
  assert.equal(advanced.previous_version,'v2.1.0');assert.equal(advanced.next_version,'v2.1.1');
  assert.equal(advanced.baseline_revision,release);assert.equal(advanced.baseline_kind,'latest_stable_after_initial');
  assert.equal(advanced.baseline_tag,'v2.1.0');assert.equal(advanced.baseline_tag_object,git('rev-parse','refs/tags/v2.1.0'));
  assert.deepEqual(advanced.initial_baseline,fallback.initial_baseline);assert.equal(advanced.commits.length,1);
  assert.equal(computeBump({...options,target:after,advanceBaseline:false}).previous_version,'2.0.0');
  const again=computeBump({...options,target:after});assert.deepEqual(again,advanced);
  const none=computeBump({...options,target:release});assert.equal(none.bump_kind,'none');assert.equal(none.baseline_tag,'v2.1.0');
  for (const engine of engines) {
    const cli=JSON.parse(execFileSync(process.execPath,[engine,'--baseline-ref',initial,'--baseline-version','2.0.0','--baseline-surface','VERSION','--target',after,'--advance-baseline'],{encoding:'utf8'}));
    assert.equal(cli.baseline_tag,'v2.1.0');assert.equal(cli.baseline_tag_object,advanced.baseline_tag_object);
  }
  const json=computeBump({...options,target:after,baselineVersion:'v2.0.0',baselineSurface:'plugin.json',baselinePointer:'/VersionName'});
  assert.deepEqual(json.initial_baseline,{revision:initial,version:'v2.0.0',surface:'plugin.json',pointer:'/VersionName'});
  assert.throws(()=>computeBump({baseline:'latest-stable',target:after,advanceBaseline:true}),/advanc.*initial baseline/i);
  assert.throws(()=>computeBump({...options,target:after,baselineVersion:'9.9.9'}),/does not match/);
  git('branch','legacy',old);git('checkout','-q','legacy');
  writeFileSync(join(root,'legacy'),'old contract\n');const unrelated=commit('fix: maintain older line');
  git('tag','-a','v9.0.0','-m','Unrelated higher stable');
  git('checkout','-q','dev');git('merge','--no-ff','-m','chore: integrate legacy fix','legacy');const merged=git('rev-parse','HEAD');
  assert.equal(computeBump({...options,target:merged}).baseline_tag,'v2.1.0','reachable tag outside initial ancestry is ignored');
  assert.throws(()=>computeBump({...options,target:unrelated}),/baseline is not an ancestor/);
  git('tag','-a','2.1.0','-m','Ambiguous stable alias',release);
  assert.throws(()=>computeBump({...options,target:merged}),/ambiguous.*stable.*tags/i);
  git('tag','-d','2.1.0');
  const release2=commit('feat: prepare subsequent release','2.2.0');git('tag','-a','v2.2.0','-m','Subsequent stable');
  const subsequent=commit('perf: optimize widget');
  const latest=computeBump({...options,target:subsequent});
  assert.equal(latest.baseline_revision,release2);assert.equal(latest.previous_version,'v2.2.0');assert.equal(latest.next_version,'v2.2.1');
  const malformed=git('rev-parse','refs/tags/v2.2.0');
  git('update-ref','refs/tags/v2.2.0',unrelated,malformed); // A moved/lightweight tag cannot retain its earlier identity.
  assert.equal(computeBump({...options,target:subsequent}).baseline_tag,'v2.1.0');
  console.log('initial baseline advancement, provenance, aliases and stale ancestry passed');
} finally {process.chdir(cwd);rmSync(root,{recursive:true,force:true});}
