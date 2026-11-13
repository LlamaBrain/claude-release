import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,sep} from 'node:path';

const temp=resolve(mkdtempSync(join(tmpdir(),'release-cold-json-')));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
try {
  const engine=join(temp,'engine'),lib=join(engine,'plugin/lib'),tool=join(lib,'dotnet/ApiDiff'),repo=join(temp,'consumer');
  mkdirSync(tool,{recursive:true});mkdirSync(repo);
  writeFileSync(join(engine,'package.json'),JSON.stringify({type:'module'}));
  copyFileSync(resolve('plugin/lib/build-manifest.js'),join(lib,'build-manifest.js'));
  for(const name of ['ApiDiff.csproj','Program.cs']) copyFileSync(resolve('plugin/lib/dotnet/ApiDiff',name),join(tool,name));
  assert.equal(existsSync(join(tool,'bin/Release/net8.0/ApiDiff.dll')),false,'fixture must start without a built analyzer');
  git(repo,'init','-q','-b','main');git(repo,'config','user.name','Fixture');git(repo,'config','user.email','fixture@example.invalid');
  writeFileSync(join(repo,'Api.cs'),'namespace Fixture { public class Contract { public void Before() {} } }\n');
  git(repo,'add','Api.cs');git(repo,'commit','-qm','feat: introduce contract');git(repo,'tag','-a','v1.0.0','-m','Stable fixture baseline');
  const base=git(repo,'rev-parse','HEAD');
  writeFileSync(join(repo,'Api.cs'),'namespace Fixture { public class Contract {} }\n');
  git(repo,'add','Api.cs');git(repo,'commit','-qm','fix: change contract');const head=git(repo,'rev-parse','HEAD');
  const args=[join(lib,'build-manifest.js'),'--baseline','v1.0.0','--target',head,'--compatibility-base',base];
  const run=()=>execFileSync(process.execPath,args,{cwd:repo,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
  const stdout=run();let result;
  assert.doesNotThrow(()=>{result=JSON.parse(stdout);},'cold analyzer build must preserve the manifest stdout JSON protocol');
  assert.equal(result.api_analysis.status,'analyzed');assert.equal(result.compatibility_analysis.status,'analyzed');
  assert.equal(result.bump_kind,'major','real API removal overrides the fix label');assert.equal(result.next_version,'v2.0.0');
  assert.equal(result.baseline_revision,base);assert.equal(result.target_revision,head);
  assert.equal(existsSync(join(tool,'bin/Release/net8.0/ApiDiff.dll')),true,'test must exercise a real cold analyzer build');
  assert.deepEqual(JSON.parse(run()),result,'a warm repeat produces the same manifest');
  console.log('cold and warm Roslyn manifest stdout JSON passed');
} finally {
  assert.ok(temp.startsWith(resolve(tmpdir())+sep) && dirname(temp)===resolve(tmpdir()),'cleanup must remain inside the fixture temp root');
  rmSync(temp,{recursive:true,force:true});
}
