import assert from 'node:assert/strict';
import { prepareArtifacts } from '../src/prepare-artifacts.js';
const baseline = 'a'.repeat(40), target = 'b'.repeat(40);
const manifest = {previous_version:'v1.0.0', next_version:'v1.1.0-rc.0', bump_kind:'minor', baseline_revision:baseline, target_revision:target, release_date:'2026-11-12', api_analysis:{status:'analyzed'}, commits:[{hash:'1234567', squash_hash:'d'.repeat(40), type:'feat', subject:'add menu'}]};
const surfaces = [
  {path:'VERSION', kind:'text', content:'1.0.0\n'},
  {path:'ProjectSettings/ProjectSettings.asset', kind:'unity', content:'PlayerSettings:\n  bundleVersion: 1.0.0\n'},
  {path:'Doxyfile', kind:'doxygen', content:'PROJECT_NUMBER = 1.0.0\n'},
  {path:'src/server.ts', kind:'literal', prefix:'version: \"', suffix:'\"', content:'new Server({ version: \"1.0.0\" });\n'},
  {path:'package-lock.json', kind:'json', pointer:'/version', mirrors:['/packages//version'], content:'{\n  \"version\": \"1.0.0\",\n  \"packages\": {\"\": {\"version\": \"1.0.0\"}}\n}\n'},
];
const request = {manifest, surfaces, changelog:{path:'docs/milestone.md', content:'# Changelog\n'}};
const outputs = prepareArtifacts(request);
assert.equal(outputs['VERSION'], '1.1.0-rc.0\n');
assert.match(outputs['ProjectSettings/ProjectSettings.asset'], /bundleVersion: 1\.1\.0-rc\.0/);
assert.equal(JSON.parse(outputs['package-lock.json']).packages[''].version, '1.1.0-rc.0');
assert.equal(JSON.parse(outputs['package-lock.json']).version, '1.1.0-rc.0');
assert.match(outputs['src/server.ts'], /version: \"1\.1\.0-rc\.0\"/);
assert.match(outputs.Doxyfile, /PROJECT_NUMBER = 1\.1\.0-rc\.0/);
assert.match(outputs['docs/milestone.md'], /\[v1\.1\.0-rc\.0\]/);
assert.match(outputs['docs/milestone.md'], /add menu \(ddddddd\)/);
const repeated = prepareArtifacts({...request, surfaces:surfaces.map(s=>({...s,content:outputs[s.path]})), changelog:{...request.changelog,content:outputs['docs/milestone.md']}});
assert.deepEqual(repeated, outputs);
assert.throws(() => prepareArtifacts({...request, manifest:{...manifest,target_revision:'c'.repeat(40)}, changelog:{...request.changelog,content:outputs['docs/milestone.md']}}));
assert.throws(() => prepareArtifacts({...request, surfaces:[{path:'VERSION',kind:'text',content:'9.9.9\n'}]}));
assert.throws(() => prepareArtifacts({...request, surfaces:[{path:'../outside',kind:'text',content:'1.0.0\n'}]}));
assert.throws(() => prepareArtifacts({...request, manifest:{...manifest, api_analysis:{status:'unavailable'}}}));
const noApi = {...manifest,api_analysis:{status:'unavailable'},api_diff:null,compatibility_analysis:{status:'unavailable'},compatibility_diff:null,adjudication:{not_applicable:{api_analysis:'No C# contract.',compatibility_analysis:'No C# contract.'}}};
assert.throws(() => prepareArtifacts({...request,manifest:noApi}));
assert.equal(prepareArtifacts({...request,manifest:noApi},{verifyNotApplicable:m => m === noApi ? noApi.adjudication.not_applicable : null}).VERSION,'1.1.0-rc.0\n');
const routine = {...noApi,adjudication:undefined};
assert.equal(prepareArtifacts({...request,manifest:routine},{verifyNotApplicable:()=>noApi.adjudication.not_applicable}).VERSION,'1.1.0-rc.0\n');
assert.throws(()=>prepareArtifacts({...request,manifest:noApi},{verifyNotApplicable:()=>({api_analysis:'Different',compatibility_analysis:'Different'})}));
assert.throws(() => prepareArtifacts({...request, manifest:{...manifest, next_version:'v1.1.0-00'}}));
const stable = prepareArtifacts({...request, manifest:{...manifest,next_version:'v1.1.0'}, surfaces:surfaces.map(s=>({...s,content:outputs[s.path]})), changelog:{...request.changelog,content:outputs['docs/milestone.md']}});
assert.equal(stable.VERSION, '1.1.0\n');
assert.match(stable['docs/milestone.md'], /\[v1\.1\.0\]/);
// Doxygen page titles are valid milestone-changelog headers. Historic prose and
// even duplicate legacy Unreleased headings must survive byte-for-byte.
for (const title of ['@page milestone_changes Milestone change history', '\\page milestone_changes Milestone change history']) {
  const tail = '\r\nHistorical introduction.\r\n\r\n## [Unreleased]\r\n\r\n- Retained pending item.\r\n\r\n## [v0.9.0] - 2025-01-01\r\n\r\n- Older release.\r\n\r\n## [Unreleased]\r\n\r\n- Legacy section.\r\n';
  const content = title + '\r\n' + tail;
  const doxygenRequest = {...request, changelog:{path:'docs/milestone.md',content}};
  const generated = prepareArtifacts(doxygenRequest);
  const result = generated['docs/milestone.md'];
  assert.ok(result.startsWith(title + '\r\n'));
  assert.ok(result.startsWith(title + '\r\n\r\nHistorical introduction.\r\n\r\n'), 'Doxygen introduction is preserved');
  const historicalSections = tail.slice(tail.indexOf('## [Unreleased]'));
  assert.ok(result.endsWith(historicalSections), 'existing Doxygen changelog sections are preserved');
  assert.equal(result.split('## [Unreleased]').length - 1, 2);
  assert.equal(result.split('## [v1.1.0-rc.0]').length - 1, 1);
  assert.deepEqual(prepareArtifacts({...doxygenRequest,
    surfaces:surfaces.map(surface=>({...surface,content:generated[surface.path]})),
    changelog:{...doxygenRequest.changelog,content:result}}), generated);
  const promoted = prepareArtifacts({...doxygenRequest,
    manifest:{...manifest,next_version:'v1.1.0'},
    surfaces:surfaces.map(surface=>({...surface,content:generated[surface.path]})),
    changelog:{...doxygenRequest.changelog,content:result}});
  assert.ok(promoted['docs/milestone.md'].endsWith(historicalSections));
  assert.equal(promoted['docs/milestone.md'].split('## [v1.1.0]').length - 1, 1);
}
for (const content of ['@page milestone_changes\n', '@page\n', '@other title\n', '## Changelog\n']) {
  assert.throws(()=>prepareArtifacts({...request,changelog:{...request.changelog,content}}), /changelog must start with a title/);
}
console.log('release artifact preparation passed');
