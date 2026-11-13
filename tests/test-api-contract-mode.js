import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareArtifacts} from '../src/prepare-artifacts.js';
const cli=resolve('plugin/lib/build-manifest.js'), dirs=[];
try {
  for (const [subject,kind,next] of [
    ['fix: revise internal helper','patch','v1.0.1'],
    ['feat: extend internal helper','minor','v1.1.0'],
    ['docs: describe internal helper','none','v1.0.0'],
    ['fix!: retire internal helper\n\nBREAKING CHANGE: Call the replacement helper.','major','v2.0.0'],
  ]) {
    const cwd=mkdtempSync(join(tmpdir(),'release-csharp-na-'));dirs.push(cwd);
    const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
    git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');
    writeFileSync(join(cwd,'Internal.cs'),'namespace Internal { public class Helper { public void Before() {} } }\n');
    git('add','.');git('commit','-qm','chore: establish baseline');const baseline=git('rev-parse','HEAD');git('tag','v1.0.0');
    writeFileSync(join(cwd,'Internal.cs'),'namespace Internal { public class Helper {} }\n');
    git('add','.');git('commit','-qm',subject);const target=git('rev-parse','HEAD');
    const args=['--baseline','v1.0.0','--target',target,'--compatibility-base',baseline,'--api-mode','not_applicable'];
    const result=JSON.parse(execFileSync(process.execPath,[cli,...args],{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}));
    assert.equal(result.bump_kind,kind);assert.equal(result.next_version,next);
    for(const name of ['api_analysis','compatibility_analysis']) {
      assert.equal(result[name].status,'unavailable');assert.equal(result[name].mode,'not_applicable');
      assert.equal(result[name].source_fingerprints,null);assert.equal(result[name].bump_kind,null);
      assert.match(result[name].reason,/not run.*not.applicable/i);
    }
    assert.equal(result.api_diff,null);assert.equal(result.compatibility_diff,null);
    assert.equal(result.compatibility_analysis.base_revision,baseline);assert.equal(result.compatibility_analysis.target_revision,target);
    if(kind==='patch') {
      const request={manifest:result,surfaces:[{path:'VERSION',kind:'text',content:'1.0.0\n'}],changelog:{path:'CHANGELOG.md',content:'# Changelog\n'}};
      assert.throws(()=>prepareArtifacts(request),/authenticated not-applicable policy/);
      const accepted=prepareArtifacts(request,{verifyNotApplicable:()=>({api_analysis:'No supported published C# API.',compatibility_analysis:'No supported published C# API.'})});
      assert.equal(accepted.VERSION,'1.0.1\n');
      assert.throws(()=>execFileSync(process.execPath,[cli,...args.slice(0,-1),'compatible'],{cwd,stdio:['ignore','pipe','pipe']}));
    }
  }
  console.log('explicit C# not-applicable mode retains missing evidence and commit impact');
} finally {for(const dir of dirs)rmSync(dir,{recursive:true,force:true});}
