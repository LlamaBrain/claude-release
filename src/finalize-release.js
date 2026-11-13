import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { prepareArtifacts, safePath } from './prepare-artifacts.js';
export { prepareArtifacts } from './prepare-artifacts.js';
import semver from 'semver';
export { adjudicateRelease } from './adjudicate-release.js';

// Verification receipts and permission to tag are checked by the caller. The
// verifiedRevision argument binds the caller's evidence to this exact commit.
export function finalizeRelease({ repo = process.cwd(), manifest, releaseRevision, verifiedRevision, branchRef, surfaces, changelogPath, tag = false }, {verifySquash, verifyNotApplicable} = {}) {
  const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
  if (!oidPattern.test(releaseRevision || '') || verifiedRevision !== releaseRevision) throw new Error('verification must bind the exact release commit');
  if (typeof branchRef !== 'string' || !/^refs\/heads\/[A-Za-z0-9._/-]+$/.test(branchRef) || branchRef.includes('..')) throw new Error('invalid production branch ref');
  if (!manifest || typeof manifest.next_version !== 'string' || !/^v\d+\.\d+\.\d+$/.test(manifest.next_version) || !semver.valid(manifest.next_version)) throw new Error('stable release requires a v-prefixed SemVer');
  if (!oidPattern.test(manifest.target_revision || '') || !oidPattern.test(manifest.baseline_revision || '')) throw new Error('invalid release provenance');
  if (!Array.isArray(surfaces) || !surfaces.length || surfaces.some(surface => !safePath(surface.path)) || !safePath(changelogPath)) throw new Error('safe release surfaces required');
  const git = (...args) => execFileSync('git', args, { cwd:repo, encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
  if (git('rev-parse','--verify',releaseRevision + '^{commit}') !== releaseRevision || git('rev-parse','--verify',branchRef + '^{commit}') !== releaseRevision) throw new Error('release branch does not point to verified release commit');
  git('rev-parse','--verify',manifest.target_revision + '^{commit}');
  try { git('merge-base', '--is-ancestor', manifest.target_revision, releaseRevision); } catch {
    const context = Object.freeze({repo, sourceHead:manifest.target_revision, baselineRevision:manifest.baseline_revision, destination:releaseRevision, branchRef});
    if (typeof verifySquash !== 'function' || verifySquash(context) !== true) throw new Error('release target is not an ancestor; authenticated landed squash verification is required');
  }
  const paths = surfaces.map(s => s.path).concat(changelogPath);
  const changed = git('diff','--no-renames','--name-only','-z',manifest.target_revision,releaseRevision).split('\0').filter(Boolean);
  if (changed.some(path => !paths.includes(path))) throw new Error('release commit differs from target outside configured artifacts');
  const mode = (revision,path) => {
    const listing = git('ls-tree','-z',revision,'--',path);
    if (!listing) return null;
    const match = /^(100644|100755) blob [0-9a-f]{40,64}\t/.exec(listing);
    if (!match) throw new Error('release artifact is not a regular Git blob');
    return match[1];
  };
  const content = (revision,path,allowNewChangelog = false) => {
    const sourceMode = mode(revision,path);
    if (!sourceMode && allowNewChangelog) return '# Changelog\n';
    if (!sourceMode) throw new Error('configured release artifact is missing from source revision');
    const bytes = execFileSync('git',['show',revision + ':' + path],{cwd:repo,stdio:['ignore','pipe','pipe']});
    const text = bytes.toString('utf8');
    if (!Buffer.from(text,'utf8').equals(bytes)) throw new Error('release artifact is not valid UTF-8');
    return text;
  };
  const sourceSurfaces = surfaces.map(surface => ({...surface,content:content(manifest.target_revision,surface.path)}));
  const sourceChangelog = content(manifest.target_revision,changelogPath,true);
  const expected = prepareArtifacts({manifest, surfaces:sourceSurfaces, changelog:{path:changelogPath,content:sourceChangelog}}, {verifyNotApplicable});
  for (const [path, expectedContent] of Object.entries(expected)) {
    const sourceMode = mode(manifest.target_revision,path), releaseMode = mode(releaseRevision,path);
    if (releaseMode !== (sourceMode ?? '100644') || content(releaseRevision,path) !== expectedContent) throw new Error('release artifacts do not match the source-derived manifest');
  }
  const tagName = manifest.next_version;
  let tagAction = 'none';
  if (tag) {
    const ref = 'refs/tags/' + tagName;
    let existingOid = null;
    try { existingOid = git('rev-parse', '--verify', ref); } catch { /* absent */ }
    if (existingOid && (git('cat-file','-t',ref) !== 'tag' || git('rev-parse','--verify',ref + '^{commit}') !== releaseRevision)) throw new Error('release tag collision');
    let tagObject = existingOid;
    if (!tagObject) {
      const ident = git('var','GIT_COMMITTER_IDENT');
      const object = 'object ' + releaseRevision + '\ntype commit\ntag ' + tagName + '\ntagger ' + ident + '\n\nRelease ' + tagName + '\n';
      tagObject = execFileSync('git',['mktag'], {cwd:repo, encoding:'utf8', input:object, stdio:['pipe','pipe','pipe']}).trim();
    }
    const command = existingOid ? 'verify ' + ref + ' ' + existingOid : 'create ' + ref + ' ' + tagObject;
    const transaction = 'start\nverify ' + branchRef + ' ' + releaseRevision + '\n' + command + '\nprepare\ncommit\n';
    try { execFileSync('git',['update-ref','--stdin'],{cwd:repo,encoding:'utf8',input:transaction,stdio:['pipe','pipe','pipe']}); }
    catch { throw new Error('branch or tag changed during release finalization'); }
    tagAction = existingOid ? 'existing' : 'created';
  }
  return { release_revision:releaseRevision, branch_ref:branchRef, tag:tagName, tag_action:tagAction };
}
const invoked = process.argv[1] && basename(process.argv[1]) === 'finalize-release.js';
if (invoked) {
  const args = process.argv.slice(2);
  const makeTag = args.includes('--tag');
  const rest = args.filter(a => a !== '--tag');
  if (rest.length !== 2 || rest[0] !== '--request') throw new Error('usage: finalize-release.js --request <json-file> [--tag]');
  const request = JSON.parse(readFileSync(rest[1], 'utf8'));
  delete request.tag;
  process.stdout.write(JSON.stringify(finalizeRelease({...request,tag:makeTag}),null,2) + '\n');
}
