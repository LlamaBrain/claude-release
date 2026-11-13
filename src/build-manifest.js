#!/usr/bin/env node
// Build the full release manifest: bump output + API diff (when available). Emits JSON to stdout.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { applyBump, computeBump } from './compute-bump.js';
import { tryApiDiff, fingerprintGitSources } from './api-diff.js';
import { classifyApiEvidence } from './release-classification.js';
import { applyCandidateState } from './candidate-state.js';

function hasStagedWork() {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], { stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
}

function parseCliOptions(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prerelease' || a === '--pre') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        process.stderr.write(`error: ${a} requires an identifier (e.g. ${a} rc)\n`);
        process.exit(2);
      }
      out.prereleaseId = next;
      i++;
    } else if (['--baseline', '--target', '--compatibility-base', '--baseline-ref', '--baseline-version', '--baseline-surface', '--baseline-pointer', '--candidate-ref', '--candidate-head', '--candidate-version-surface', '--candidate-changelog', '--candidate-pointer', '--preview-wrapper'].includes(a)) {
      const next = argv[++i];
      if (!next || next.startsWith('--')) throw new Error(a + ' requires a value');
      const keys = {'--baseline':'baseline', '--target':'target', '--compatibility-base':'compatibilityBase', '--baseline-ref':'baselineRef', '--baseline-version':'baselineVersion', '--baseline-surface':'baselineSurface', '--baseline-pointer':'baselinePointer', '--candidate-ref':'candidateRef', '--candidate-head':'candidateHead', '--candidate-version-surface':'candidateVersionSurface', '--candidate-changelog':'candidateChangelog', '--candidate-pointer':'candidatePointer', '--preview-wrapper':'previewWrapper'};
      out[keys[a]] = next;
    } else if (a === '--type-map') {
      const path = argv[++i];
      if (!path || path.startsWith('--')) throw new Error('--type-map requires a JSON file');
      out.typeMap = JSON.parse(readFileSync(path, 'utf8'));
    } else if (a === '--api-posture') {
      const next = argv[++i];
      if (!['source', 'binary'].includes(next)) throw new Error('--api-posture requires source or binary');
      out.apiPosture = next;
    } else if (a === '--bump') {
      const next = argv[i + 1];
      if (!next || !['major', 'minor', 'patch'].includes(next)) {
        process.stderr.write(`error: --bump requires major|minor|patch (got "${next ?? ''}")\n`);
        process.exit(2);
      }
      out.bumpOverride = next;
      i++;
    }
  }
  return out;
}

const cli = parseCliOptions(process.argv.slice(2));
let manifest = computeBump(cli);

// Exact revision requests compare committed trees. Legacy calls compare the
// previous tag against the release-in-flight working tree.
const apiDiff = await tryApiDiff(manifest.baseline_revision || manifest.previous_version, cli.target ? manifest.target_revision : 'WORKTREE');
manifest.api_diff = apiDiff;
let compatibilityDiff = null;
let compatibilityBase = null;
if (cli.compatibilityBase) {
  if (!cli.target || cli.compatibilityBase.startsWith('-')) throw new Error('--compatibility-base requires a pinned target');
  compatibilityBase = execFileSync('git', ['rev-parse', '--verify', cli.compatibilityBase + '^{commit}'], { encoding: 'utf8' }).trim();
  try { execFileSync('git', ['merge-base', '--is-ancestor', compatibilityBase, manifest.target_revision], { stdio: 'ignore' }); } catch { throw new Error('compatibility base is not an ancestor of target'); }
  compatibilityDiff = await tryApiDiff(compatibilityBase, manifest.target_revision);
}

// Preserve absence of analysis explicitly; an unavailable analyzer is not an
// analyzed empty diff. Classify using the strongest commit or API evidence.
function sourceFingerprints(base, target, diff) {
  if (!diff || !base || !target || !cli.target) return null;
  try { return {algorithm:'sha256',base:fingerprintGitSources(base),target:fingerprintGitSources(target)}; }
  catch (error) { process.stderr.write(`[claude-release] source fingerprint unavailable: ${error.message}\n`); return null; }
}
const apiEvidence = classifyApiEvidence(manifest.bump_kind, apiDiff, cli.apiPosture || 'binary');
manifest.api_analysis = {
  status: apiEvidence.status,
  posture: cli.apiPosture || 'binary',
  bump_kind: apiEvidence.apiKind ?? null,
  reason: apiEvidence.reason ?? null,
  requires_stable_baseline: apiEvidence.requiresBaseline ?? false,
  source_fingerprints: sourceFingerprints(manifest.baseline_revision, manifest.target_revision, apiDiff),
};
if (manifest.bump_kind === 'graduate' && (apiEvidence.status !== 'analyzed' || apiEvidence.requiresBaseline)) {
  process.stderr.write('error: prerelease graduation requires an explicit stable baseline and resolved API compatibility evidence\n');
  process.exit(2);
}
if (cli.compatibilityBase) {
  const featureEvidence = classifyApiEvidence(apiEvidence.bumpKind, compatibilityDiff, cli.apiPosture || 'binary');
  manifest.compatibility_diff = compatibilityDiff;
  manifest.compatibility_analysis = { status: featureEvidence.status, posture: cli.apiPosture || 'binary', bump_kind: featureEvidence.apiKind ?? null, base_revision: compatibilityBase, target_revision: manifest.target_revision, reason: featureEvidence.reason ?? null, source_fingerprints: sourceFingerprints(compatibilityBase, manifest.target_revision, compatibilityDiff) };
  apiEvidence.bumpKind = featureEvidence.bumpKind;
}
if (apiEvidence.bumpKind !== manifest.bump_kind) {
  manifest.bump_kind = apiEvidence.bumpKind;
  manifest.next_version = applyBump(manifest.previous_version, apiEvidence.bumpKind, cli.prereleaseId || null);
  manifest.bump_reason = `${manifest.bump_reason}; ${apiEvidence.reason}`;
}
// Staged work with no commit signal and no api-diff signal (e.g. art/asset/scene-only release,
// internal refactor below the public API line) still represents a real release. Promote to patch
// so VERSION/CHANGELOG can land in the release commit. Strict semver: patch = backwards-compatible
// change that doesn't add to the public API.
if (!cli.target && manifest.bump_kind === 'none' && hasStagedWork()) {
  manifest.bump_kind = 'patch';
  manifest.next_version = applyBump(manifest.previous_version, 'patch', cli.prereleaseId || null);
  manifest.bump_reason = `${manifest.bump_reason}; staged work present without an API classification; assuming patch`;
  if (cli.prereleaseId) {
    manifest.bump_reason = `${manifest.bump_reason}; pre-release id "${cli.prereleaseId}"`;
    manifest.prerelease_id = cli.prereleaseId;
  }
}

if ([cli.candidateRef, cli.candidateHead, cli.candidateVersionSurface, cli.candidateChangelog, cli.candidatePointer].some(value => value !== undefined)) {
  if (!cli.target || !cli.prereleaseId || !cli.candidateRef || !cli.candidateHead || !cli.candidateVersionSurface || !cli.candidateChangelog) throw new Error('candidate state requires target, prerelease identifier, ref, head, version surface and changelog');
  manifest = applyCandidateState(manifest,{branchRef:cli.candidateRef,expectedHead:cli.candidateHead,versionPath:cli.candidateVersionSurface,changelogPath:cli.candidateChangelog,...(cli.candidatePointer !== undefined ? {pointer:cli.candidatePointer} : {})});
}
console.log(JSON.stringify(manifest, null, 2));
