#!/usr/bin/env node
// Build the full release manifest: bump output + API diff (when available). Emits JSON to stdout.

import { execFileSync } from 'node:child_process';
import { applyBump, computeBump } from './compute-bump.js';
import { tryApiDiff } from './api-diff.js';
import { classifyRemovedAddedPairs } from './classify-api-diff.js';

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
const manifest = computeBump(cli);

// API diff inspects the previous tag vs the current release-in-flight workspace, not HEAD.
// /changelog and /release run BEFORE the release commit is created, so HEAD would miss the
// staged work this manifest is meant to describe.
const apiDiff = await tryApiDiff(manifest.previous_version, 'WORKTREE');
if (apiDiff) manifest.api_diff = apiDiff;

// If compute-bump said "none" (no commits since last tag) but api-diff surfaced staged API
// changes, version references in the changelog would point at the previous tag — wrong.
// Promote per strict semver (semver.org spec 2.0.0) based on api-diff content:
//   - real removed entries (after additive-pair reclassification) → major (breaking)
//   - changed entries     → major (signature changes are breaking by default; conservative call)
//   - added entries only  → minor (new public API is a backwards-compatible feature addition)
// This plugin applies strict semver everywhere — pre-release is expressed via semver pre-release
// identifiers (e.g. `1.0.0-rc.1`), not by sitting at 0.x.y forever. Projects that want
// "minor=breaking, patch=everything-else" should not use this plugin's manifest at face value;
// that's a different (non-strict) convention this plugin does not support.
//
// Additive-pair reclassification: adding a defaulted parameter to `Foo(int)` produces
// `Foo(int, bool = false)`. Because the param-type tuple is baked into the FQN, this surfaces
// as 1 removed (`Foo(int)`) + 1 added (`Foo(int,bool)`). It is source-compatible — existing
// callers still compile. `classifyRemovedAddedPairs` detects this shape (added's tuple is a
// strict prefix-superset of removed's tuple) and excludes the removed entry from the
// breaking-change tally, leaving the added entry as a normal minor-bump-worthy addition.
//
// Known remaining over-call — "changed" → major:
// A "changed" entry has the same FQN in both versions but differing signature text
// (return type, type-param constraints, default-value tweaks, adding `virtual`/`sealed`).
// We still classify the whole bucket as major: real breaks dominate the population, and
// over-bumping when minor would suffice surprises consumers less than under-bumping a real
// break. Refine here if a project's reality drifts.
if (
  manifest.bump_kind === 'none' &&
  apiDiff &&
  (apiDiff.added.length > 0 || apiDiff.removed.length > 0 || apiDiff.changed.length > 0)
) {
  const { realRemoved, effectiveAdded, additivePairs } = classifyRemovedAddedPairs(apiDiff);
  let promoted;
  let why;
  if (realRemoved.length > 0 || apiDiff.changed.length > 0) {
    promoted = 'major';
    const pairNote = additivePairs.length > 0
      ? ` (excluding ${additivePairs.length} additive-param pair(s))`
      : '';
    why = `api-diff has ${realRemoved.length} removal(s)${pairNote} and ${apiDiff.changed.length} change(s) — likely breaking`;
  } else if (effectiveAdded.length > 0) {
    promoted = 'minor';
    const pairNote = additivePairs.length > 0
      ? `, ${additivePairs.length} of which extend(s) an existing signature with default-valued param(s)`
      : '';
    why = `api-diff has ${effectiveAdded.length} addition(s)${pairNote}, no real removals/changes — backwards-compatible feature`;
  } else {
    // Pathological: all removed entries were paired off as additive but no actual added.
    // Can't happen in practice (additive pair always has its added partner) but guard anyway.
    promoted = 'minor';
    why = `api-diff produced only additive-param pair(s) (${additivePairs.length}) — backwards-compatible`;
  }
  manifest.bump_kind = promoted;
  manifest.next_version = applyBump(manifest.previous_version, promoted, cli.prereleaseId || null);
  manifest.bump_reason = `${manifest.bump_reason}; + staged API changes detected by api-diff (${why})`;
  if (cli.prereleaseId) {
    manifest.bump_reason = `${manifest.bump_reason}; pre-release id "${cli.prereleaseId}"`;
    manifest.prerelease_id = cli.prereleaseId;
  }
}

// Staged work with no commit signal and no api-diff signal (e.g. art/asset/scene-only release,
// internal refactor below the public API line) still represents a real release. Promote to patch
// so VERSION/CHANGELOG can land in the release commit. Strict semver: patch = backwards-compatible
// change that doesn't add to the public API.
if (manifest.bump_kind === 'none' && hasStagedWork()) {
  manifest.bump_kind = 'patch';
  manifest.next_version = applyBump(manifest.previous_version, 'patch', cli.prereleaseId || null);
  manifest.bump_reason = `${manifest.bump_reason}; + staged work present but api-diff is empty — non-API change (patch)`;
  if (cli.prereleaseId) {
    manifest.bump_reason = `${manifest.bump_reason}; pre-release id "${cli.prereleaseId}"`;
    manifest.prerelease_id = cli.prereleaseId;
  }
}

console.log(JSON.stringify(manifest, null, 2));
