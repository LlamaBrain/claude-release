import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fingerprintGitSources} from '../src/api-diff.js';
const old=process.cwd(), cwd=mkdtempSync(join(tmpdir(),'api-source-fingerprint-'));
function git(...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
try {
 git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
 mkdirSync(join(cwd,'Tests')); writeFileSync(join(cwd,'Api.cs'),'public class Api {}\n');writeFileSync(join(cwd,'Tests','Excluded.cs'),'public class Test {}\n');
 git('add','.');git('commit','-qm','feat: baseline');const first=git('rev-parse','HEAD');
 writeFileSync(join(cwd,'VERSION'),'1.0.1\n');writeFileSync(join(cwd,'Tests','Excluded.cs'),'public class ChangedTest {}\n');git('add','.');git('commit','-qm','chore: metadata');const second=git('rev-parse','HEAD');
 writeFileSync(join(cwd,'Api.cs'),'public class Api { public void Added() {} }\n');git('add','.');git('commit','-qm','feat: add method');const third=git('rev-parse','HEAD');
 process.chdir(cwd); const a=fingerprintGitSources(first),b=fingerprintGitSources(second),c=fingerprintGitSources(third);
 assert.match(a,/^[0-9a-f]{64}$/);assert.equal(a,b);assert.notEqual(b,c);assert.throws(()=>fingerprintGitSources('invalid-ref'));
 console.log('Roslyn-selected source fingerprints passed');
} finally {process.chdir(old);rmSync(cwd,{recursive:true,force:true});}
