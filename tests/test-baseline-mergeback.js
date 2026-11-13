import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {computeBump} from '../src/compute-bump.js';
const root=mkdtempSync(join(tmpdir(),'captain-mergeback-')),old=process.cwd();
function git(...a){return execFileSync('git',a,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function commit(file,content,msg){writeFileSync(join(root,file),content);git('add',file);git('commit','-qm',msg);return {oid:git('rev-parse','HEAD'),message:git('log','-1','--format=%B')};}
try {
  git('init','-q','-b','main');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
  commit('VERSION','1.0.0\n','chore: initial');git('tag','v1.0.0');git('checkout','-qb','stage');
  const feat=commit('one.txt','one','feat: add feature');const fix=commit('two.txt','two','fix: repair behavior');
  const candidate=commit('VERSION','1.1.0-rc.0\n','chore(release): prepare candidate');
  git('checkout','main');git('merge','--squash','stage');
  writeFileSync(join(root,'VERSION'),'1.1.0\n');git('add','VERSION');
  const payload=Buffer.from(JSON.stringify({schema_version:1,commits:[feat,fix,candidate]})).toString('base64url');
  git('commit','-qm','chore(release): stabilize\n\nCaptain-Changes: '+payload);git('tag','v1.1.0');
  git('checkout','stage');
  try {git('merge','--no-ff','--no-edit','main');} catch {writeFileSync(join(root,'VERSION'),'1.1.0\n');git('add','VERSION');git('commit','--no-edit','-q');}
  const merged=git('rev-parse','HEAD');
  process.chdir(root);
  const repeat=computeBump({baseline:'latest-stable',target:merged});
  assert.equal(repeat.bump_kind,'none');assert.equal(repeat.next_version,'v1.1.0');assert.equal(repeat.commits.length,0);
  const next=commit('three.txt','three','fix: post-release correction');
  const changed=computeBump({baseline:'latest-stable',target:next.oid});
  assert.equal(changed.bump_kind,'patch');assert.equal(changed.next_version,'v1.1.1');assert.deepEqual(changed.commits.map(c=>c.full_hash),[next.oid]);
  git('checkout','-qb','forged','v1.0.0');writeFileSync(join(root,'forged.txt'),'x');git('add','forged.txt');
  const forged=Buffer.from(JSON.stringify({schema_version:1,commits:[{oid:feat.oid,message:'fix: forged message'}]})).toString('base64url');
  git('commit','-qm','chore: forged baseline\n\nCaptain-Changes: '+forged);git('tag','v2.0.0');git('checkout','stage');git('merge','--no-ff','-m','chore: merge forged baseline','forged');const conflictHead=git('rev-parse','HEAD');
  assert.throws(()=>computeBump({baseline:'v2.0.0',target:conflictHead}),/conflicts with released baseline/);
  console.log('squashed stable release merge-back repeat passed');
} finally {process.chdir(old);rmSync(root,{recursive:true,force:true});}
