import {execFileSync} from 'node:child_process';
import semver from 'semver';
import {resolveJsonPointer} from './json-pointer.js';

const fullOid = value => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
const safePath = value => typeof value === 'string' && /^[A-Za-z0-9._/-]+$/.test(value) && !value.startsWith('/') && !value.split('/').some(part => !part || part === '.' || part === '..');
const git = (...args) => execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();

export function applyCandidateState(manifest,{branchRef,expectedHead,versionPath,changelogPath,pointer} = {}) {
  if (!manifest || !fullOid(manifest.baseline_revision) || !fullOid(manifest.target_revision) || !manifest.prerelease_id || !semver.valid(manifest.next_version) || !semver.valid(manifest.previous_version) || semver.prerelease(manifest.previous_version)) throw new Error('candidate requires exact stable baseline, target and prerelease version');
  if (typeof branchRef !== 'string' || !branchRef.startsWith('refs/heads/') || !fullOid(expectedHead) || !safePath(versionPath) || !safePath(changelogPath)) throw new Error('candidate requires a branch ref, exact head and configured surfaces');
  try { git('check-ref-format',branchRef); } catch { throw new Error('invalid staging branch ref'); }
  if (git('rev-parse','--verify',branchRef + '^{commit}') !== expectedHead) throw new Error('staging branch changed from pinned candidate head');
  if (manifest.bump_kind === 'none') return {...manifest,candidate_state:{branch_ref:branchRef,base_revision:expectedHead,version_path:versionPath,changelog_path:changelogPath,...(pointer !== undefined ? {pointer} : {}),previous_version:null,previous_target:null,previous_baseline:null,action:'none'}};
  if (!semver.prerelease(manifest.next_version)) throw new Error('candidate requires prerelease version');
  const versionContent = git('show',expectedHead + ':' + versionPath);
  let current = versionContent;
  if (pointer !== undefined) { const {parent,key}=resolveJsonPointer(JSON.parse(versionContent),pointer); current=parent[key]; }
  if (typeof current !== 'string' || !semver.valid(current.trim())) throw new Error('staging version surface is invalid');
  current=current.trim(); const previous=semver.parse(current), proposed=semver.parse(manifest.next_version), stable=semver.parse(manifest.previous_version);
  const previousCore = `${previous.major}.${previous.minor}.${previous.patch}`, proposedCore = `${proposed.major}.${proposed.minor}.${proposed.patch}`, stableCore = `${stable.major}.${stable.minor}.${stable.patch}`;
  if (semver.lt(previousCore,stableCore) || semver.gt(previousCore,proposedCore)) throw new Error('staging version is stale or exceeds proposed candidate');
  let priorTarget=null, priorBaseline=null, next=manifest.next_version, action='first';
  if (previous.prerelease.length) {
    const changelog=git('show',expectedHead + ':' + changelogPath);
    const normalized=previous.version, escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const sections=changelog.split(/(?=^## \[)/m).filter(part => new RegExp('^## \\[v?' + escape(normalized) + '\\](?:[ \\t]|$)','m').test(part));
    if (sections.length !== 1) throw new Error('staging candidate changelog entry is missing or ambiguous');
    const markers=[...sections[0].matchAll(/<!-- captain-release baseline:([0-9a-f]{40}(?:[0-9a-f]{24})?) target:([0-9a-f]{40}(?:[0-9a-f]{24})?) -->/g)];
    if (markers.length !== 1) throw new Error('staging candidate provenance is missing or ambiguous');
    priorBaseline=markers[0][1];priorTarget=markers[0][2];
    if (previousCore === proposedCore) {
      if (priorBaseline !== manifest.baseline_revision || previous.prerelease[0] !== manifest.prerelease_id) throw new Error('staging candidate baseline or identifier conflicts');
      if (priorTarget === manifest.target_revision) {next='v'+previous.version;action='reuse';}
      else {const incremented=semver.inc(previous.version,'prerelease',manifest.prerelease_id);if(!incremented)throw new Error('cannot increment candidate version');next='v'+incremented;action='increment';}
    } else action='new_series';
  } else if (previousCore !== stableCore) throw new Error('staging stable version does not match release baseline');
  return {...manifest,next_version:next,candidate_state:{branch_ref:branchRef,base_revision:expectedHead,version_path:versionPath,changelog_path:changelogPath,...(pointer !== undefined ? {pointer} : {}),previous_version:current,previous_target:priorTarget,previous_baseline:priorBaseline,action}};
}
