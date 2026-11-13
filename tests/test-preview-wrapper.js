import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {computeBump} from '../src/compute-bump.js';
const manifestBundle = resolve('plugin/lib/build-manifest.js');
const old = process.cwd(), cwd = mkdtempSync(join(tmpdir(),'captain-preview-'));
function git(...args) { return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim(); }
try {
 git('init','-q'); git('config','user.name','Fixture'); git('config','user.email','fixture@example.invalid');
 writeFileSync(join(cwd,'VERSION'),'1.0.0\n'); git('add','VERSION'); git('commit','-qm','chore: initialize');
 const base=git('rev-parse','HEAD'); git('tag','v1.0.0'); const tree=git('rev-parse','HEAD^{tree}');
 const payload=Buffer.from(JSON.stringify({schema_version:1,commits:[{oid:'a'.repeat(40),message:'docs: clarify instructions'}]})).toString('base64url');
 function preview(subject, parent=base, author='Captain Preview <captain-preview@invalid>', extra='') {
   const object=`tree ${tree}\nparent ${parent}\nauthor ${author} 0 +0000\ncommitter Captain Preview <captain-preview@invalid> 0 +0000\n\n${subject}\n\n${extra}Captain-Changes: ${payload}\n`;
   return execFileSync('git',['hash-object','-t','commit','-w','--stdin'],{cwd,input:object,encoding:'utf8'}).trim();
 }
 const head=preview('chore(landing): refresh approved feature');
 process.chdir(cwd);
 const args={baseline:'v1.0.0',target:head,compatibilityBase:base,typeMap:{chore:'patch'}};
 assert.equal(computeBump(args).bump_kind,'patch');
 const selected=computeBump({...args,previewWrapper:head});
 assert.equal(selected.bump_kind,'none'); assert.equal(selected.preview_wrapper,head);
 assert.equal(selected.commits.length,1); assert.equal(selected.commits[0].type,'docs');
 const mapPath=join(cwd,'type-map.json'); writeFileSync(mapPath,JSON.stringify({chore:'patch'}));
 const cli=JSON.parse(execFileSync(process.execPath,[manifestBundle,'--baseline','v1.0.0','--target',head,'--compatibility-base',base,'--preview-wrapper',head,'--type-map',mapPath],{cwd,encoding:'utf8'}));
 assert.equal(cli.bump_kind,'none'); assert.equal(cli.preview_wrapper,head); assert.equal(cli.commits.length,1);
 assert.throws(()=>computeBump({...args,previewWrapper:'b'.repeat(40)}));
 assert.throws(()=>computeBump({...args,previewWrapper:head,compatibilityBase:'b'.repeat(40)}));
 const bad=preview('chore(landing): different');
 assert.throws(()=>computeBump({...args,target:bad,previewWrapper:bad}));
 const hidden=preview('chore(landing): refresh approved feature',base,undefined,'BREAKING CHANGE: hidden break\n');
 assert.throws(()=>computeBump({...args,target:hidden,previewWrapper:hidden}));
 const fake=preview('chore(landing): refresh approved feature',base,'Impostor <bad@example.invalid>');
 assert.throws(()=>computeBump({...args,target:fake,previewWrapper:fake}));
 console.log('trusted preview wrapper classification passed');
} finally {process.chdir(old);rmSync(cwd,{recursive:true,force:true});}
