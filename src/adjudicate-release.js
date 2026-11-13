import semver from 'semver';
import { applyBump } from './compute-bump.js';
import { classifyApiEvidence } from './release-classification.js';
import { applyCandidateState } from './candidate-state.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const ranks = {none:0, patch:1, minor:2, major:3};
const oid = value => typeof value === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(value);

// verifyDecision is a trusted in-process capability, never data deserialized
// from a request. It authenticates the exact aggregate finding fingerprint and
// signed decision against the frozen report passed here.
export function adjudicateRelease(input, reference, {verifyDecision} = {}) {
  const manifest = freeze(structuredClone(input));
  if (!manifest || manifest.adjudication || manifest.observed_classification || manifest.bump_kind !== 'major' || !oid(manifest.baseline_revision) || !oid(manifest.target_revision) || !oid(manifest.compatibility_analysis?.base_revision) || manifest.compatibility_analysis.target_revision !== manifest.target_revision) throw new Error('exact unadjudicated major report required');
  if (!semver.valid(manifest.previous_version) || semver.prerelease(manifest.previous_version)) throw new Error('major report version does not match the stable baseline');
  const majorVersion = applyBump(manifest.previous_version, 'major', manifest.prerelease_id || null);
  let candidateOptions;
  if (manifest.candidate_state) {
    const state = manifest.candidate_state;
    candidateOptions = {branchRef:state.branch_ref,expectedHead:state.base_revision,versionPath:state.version_path,changelogPath:state.changelog_path,...(state.pointer !== undefined ? {pointer:state.pointer} : {})};
    const refreshed = applyCandidateState({...manifest,next_version:majorVersion},candidateOptions);
    const keys = Object.keys(refreshed.candidate_state).sort();
    if (refreshed.next_version !== manifest.next_version || keys.length !== Object.keys(state).length || keys.some(key => refreshed.candidate_state[key] !== state[key])) throw new Error('candidate state changed or is inconsistent with the major report');
  } else if (manifest.next_version !== majorVersion) throw new Error('major report version does not match the stable baseline');
  if (!Array.isArray(manifest.commits) || !manifest.type_map || typeof manifest.type_map !== 'object' || Array.isArray(manifest.type_map)) throw new Error('release classification evidence is incomplete');
  const analyses = [['api_analysis', manifest.api_analysis, manifest.api_diff], ['compatibility_analysis', manifest.compatibility_analysis, manifest.compatibility_diff]];
  if (typeof verifyDecision !== 'function') throw new Error('trusted decision verifier is required');
  const decision = verifyDecision(manifest, reference);
  if (!decision || decision.scope !== 'all_findings' || decision.base !== manifest.compatibility_analysis.base_revision || decision.head !== manifest.target_revision || !/^[0-9a-f]{64}$/.test(decision.finding_sha256 || '') || !['confirm-major','reject-major','revise'].includes(decision.choice) || typeof decision.actor !== 'string' || !decision.actor.trim() || typeof decision.justification !== 'string' || (decision.choice === 'reject-major' && !decision.justification.trim())) throw new Error('authenticated aggregate decision does not match this report');
  const notApplicable = {};
  for (const [name, analysis, diff] of analyses) {
    if (analysis?.status === 'unavailable' && diff === null) {
      const reason = decision.not_applicable?.[name];
      if (typeof reason !== 'string' || !reason.trim() || reason.length > 2000) throw new Error('compatibility analysis is unavailable without authenticated policy rationale');
      notApplicable[name] = reason;
      continue;
    }
    if (analysis?.status !== 'analyzed' || !diff || !['none','minor','major'].includes(analysis.bump_kind) || !Array.isArray(diff.added) || !Array.isArray(diff.removed) || !Array.isArray(diff.changed)) throw new Error('compatibility analysis is unavailable or incomplete');
    if (classifyApiEvidence('none', diff, analysis.posture || 'binary').apiKind !== analysis.bump_kind) throw new Error('compatibility analysis contradicts the concrete API diff');
  }
  if (!manifest.commits.some(commit => commit.breaking === true) && !analyses.some(([, analysis]) => analysis?.bump_kind === 'major') && manifest.bump_override !== 'major') throw new Error('major report has no supported breaking signal');
  const reviewedFields = ['reviewed_base','reviewed_head','reviewed_finding_sha256'];
  const associated = reviewedFields.some(name => decision[name] !== undefined);
  if (associated && (!oid(decision.reviewed_base) || !oid(decision.reviewed_head) || !/^[0-9a-f]{64}$/.test(decision.reviewed_finding_sha256 || ''))) throw new Error('authenticated original review provenance is incomplete');
  const evidence = {scope:decision.scope,base:decision.base,head:decision.head,finding_sha256:decision.finding_sha256,choice:decision.choice,actor:decision.actor,justification:decision.justification,...(associated ? {reviewed_base:decision.reviewed_base,reviewed_head:decision.reviewed_head,reviewed_finding_sha256:decision.reviewed_finding_sha256} : {}),...(Object.keys(notApplicable).length ? {not_applicable:notApplicable} : {})};
  if (decision.choice === 'revise') return {status:'needs_revision',manifest:null,decision:evidence};
  let effective = 'major';
  if (decision.choice === 'reject-major') {
    effective = 'none';
    for (const commit of manifest.commits) {
      const kind = manifest.type_map[commit.type];
      if (!['none','patch','minor'].includes(kind)) throw new Error('commit type mapping is incomplete');
      if (ranks[kind] > ranks[effective]) effective = kind;
    }
    if (analyses.some(([, , diff]) => diff?.added?.length > 0) && ranks[effective] < ranks.minor) effective = 'minor';
    if (manifest.bump_override) {
      if (!['patch','minor','major'].includes(manifest.bump_override)) throw new Error('invalid explicit bump override');
      if (ranks[manifest.bump_override] > ranks[effective]) effective = manifest.bump_override;
    }
  }
  let result = structuredClone(manifest);
  result.observed_classification = {bump_kind:manifest.bump_kind,next_version:manifest.next_version,bump_reason:manifest.bump_reason};
  result.adjudication = evidence;
  result.bump_kind = effective;
  result.next_version = effective === 'none' ? manifest.previous_version : applyBump(manifest.previous_version,effective,manifest.prerelease_id || null);
  result.bump_reason = `${manifest.bump_reason}; authenticated aggregate compatibility decision: ${decision.choice}`;
  if (candidateOptions) result = applyCandidateState(result,candidateOptions);
  return {status:'ready',manifest:result,decision:evidence};
}
