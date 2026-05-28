#!/usr/bin/env node
// Build the full release manifest: bump output + API diff (when available). Emits JSON to stdout.

import semver from 'semver';
import { computeBump } from './compute-bump.js';
import { tryApiDiff } from './api-diff.js';

const manifest = computeBump();

// API diff inspects the previous tag vs the current release-in-flight workspace, not HEAD.
// /changelog and /release run BEFORE the release commit is created, so HEAD would miss the
// staged work this manifest is meant to describe.
const apiDiff = await tryApiDiff(manifest.previous_version, 'WORKTREE');
if (apiDiff) manifest.api_diff = apiDiff;

// If compute-bump said "none" (no commits since last tag) but api-diff surfaced staged API
// changes, version references in the changelog would point at the previous tag — wrong.
// Promote to at least patch so API-derived bullets carry the correct ({next_version}) ref.
// Breaking vs minor is left to the LLM with commit context; api-diff alone doesn't override
// the deterministic bump rules.
if (
  manifest.bump_kind === 'none' &&
  apiDiff &&
  (apiDiff.added.length > 0 || apiDiff.removed.length > 0 || apiDiff.changed.length > 0)
) {
  const base = manifest.previous_version ? manifest.previous_version.replace(/^v/, '') : '0.0.0';
  const coerced = semver.coerce(base);
  const nextRaw = semver.inc(coerced ? coerced.version : '0.0.0', 'patch');
  manifest.bump_kind = 'patch';
  manifest.next_version = `v${nextRaw}`;
  manifest.bump_reason = `${manifest.bump_reason}; + staged API changes detected by api-diff`;
}

console.log(JSON.stringify(manifest, null, 2));
