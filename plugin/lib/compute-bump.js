#!/usr/bin/env node
// Pure-script bump computation. No LLM. Emits the release manifest to stdout.
// `--apply` writes VERSION at the repo root.

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import semver from 'semver';
import { parseCommit } from './parse-commits.js';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function lastTag() {
  try {
    return git('describe', '--tags', '--abbrev=0');
  } catch {
    return null;
  }
}

// Pretty-format includes a hash sentinel and a commit sentinel so we can split full multi-line
// messages back out reliably. Sentinels are unlikely to appear in real commit text.
const HSEP = '<<<H>>>';
const CSEP = '<<<COMMIT-SEP>>>';

function commitsInRange(range) {
  // execFileSync passes the format arg literally; no shell sees the sentinels so '<<<H>>>'
  // is safe. (Earlier execSync version was broken on cmd.exe/bash.)
  let out;
  try {
    out = git('log', range, `--pretty=format:%H${HSEP}%B${CSEP}`);
  } catch {
    return [];
  }
  if (!out) return [];
  return out
    .split(CSEP)
    .map(c => c.trim())
    .filter(Boolean)
    .map(chunk => {
      const idx = chunk.indexOf(HSEP);
      const fullHash = chunk.slice(0, idx);
      const message = chunk.slice(idx + HSEP.length).trim();
      const parsed = parseCommit(message);
      return {
        hash: fullHash.slice(0, 7),
        full_hash: fullHash,
        ...parsed,
      };
    });
}

// Apply strict-SemVer increment with optional pre-release identifier.
// - kind: 'major' | 'minor' | 'patch'
// - prereleaseId: e.g. 'rc', 'alpha', 'beta' — when present, produces a pre-release version.
// Behaviour:
//   prev is stable, prereleaseId set        → premajor/preminor/prepatch with id (e.g. v0.3.0 + premajor rc → v1.0.0-rc.0)
//   prev is pre-release, prereleaseId set   → prerelease bump, optionally renaming the id (e.g. v1.0.0-rc.0 → v1.0.0-rc.1; v1.0.0-rc.0 + beta → v1.0.0-beta.0)
//   prev is pre-release, no prereleaseId    → graduate to stable: kind is ignored; the target stable version is whatever the pre-release encodes (e.g. v1.0.0-rc.5 → v1.0.0)
//   prev is stable, no prereleaseId         → plain kind increment (the original path)
export function applyBump(prev, kind, prereleaseId) {
  const base = prev ? prev.replace(/^v/, '') : '0.0.0';
  const coerced = semver.coerce(base);
  const source = semver.parse(base) ?? semver.parse(coerced?.version) ?? semver.parse('0.0.0');
  const sourceStr = source.version;
  const isPrev_Prerelease = source.prerelease.length > 0;

  let nextRaw;
  if (prereleaseId) {
    if (isPrev_Prerelease) {
      nextRaw = semver.inc(sourceStr, 'prerelease', prereleaseId);
    } else {
      nextRaw = semver.inc(sourceStr, `pre${kind}`, prereleaseId);
    }
  } else if (isPrev_Prerelease) {
    // Graduate: drop the pre-release identifier; the stable target is the X.Y.Z that the pre-release encodes.
    nextRaw = `${source.major}.${source.minor}.${source.patch}`;
  } else {
    nextRaw = semver.inc(sourceStr, kind);
  }
  return `v${nextRaw}`;
}

export function computeBump(options = {}) {
  const prereleaseId = options.prereleaseId || null;
  const bumpOverride = options.bumpOverride || null;
  if (bumpOverride && !['major', 'minor', 'patch'].includes(bumpOverride)) {
    throw new Error(`bumpOverride must be one of major|minor|patch (got "${bumpOverride}")`);
  }
  const prev = lastTag();
  const range = prev ? `${prev}..HEAD` : 'HEAD';
  const commits = commitsInRange(range);
  const today = new Date().toISOString().slice(0, 10);
  const prevIsPrerelease = prev ? (semver.prerelease(prev.replace(/^v/, '')) || []).length > 0 : false;

  if (commits.length === 0) {
    if (bumpOverride) {
      const next = applyBump(prev, bumpOverride, prereleaseId);
      return {
        previous_version: prev,
        next_version: next,
        bump_kind: bumpOverride,
        bump_reason: `no commits since last tag; explicit --bump ${bumpOverride}`,
        release_date: today,
        commits: [],
        api_diff: { added: [], removed: [], changed: [] },
        breaking_changes: [],
        prerelease_id: prereleaseId,
        previous_is_prerelease: prevIsPrerelease,
        bump_override: bumpOverride,
      };
    }
    return {
      previous_version: prev,
      next_version: prev,
      bump_kind: 'none',
      bump_reason: 'no commits since last tag',
      release_date: today,
      commits: [],
      api_diff: { added: [], removed: [], changed: [] },
      breaking_changes: [],
      prerelease_id: prereleaseId,
      previous_is_prerelease: prevIsPrerelease,
    };
  }

  // Reverts cancel their target. We strip both from the manifest so they don't appear in the
  // changelog as a doubled non-event.
  const revertTargets = new Set(
    commits.filter(c => c.revert).map(c => {
      const m = /This reverts commit (\w+)\.?/i.exec(c.raw || '');
      return m ? m[1].slice(0, 7) : null;
    }).filter(Boolean)
  );
  const filtered = commits.filter(c => !c.revert && !revertTargets.has(c.hash));

  const breaking = filtered.filter(c => c.breaking);
  const feats = filtered.filter(c => c.type === 'feat' && !c.breaking);

  let kind, reason;
  if (bumpOverride) {
    kind = bumpOverride;
    reason = `explicit --bump ${bumpOverride}`;
  } else if (breaking.length > 0) {
    kind = 'major';
    reason = `${breaking.length} breaking change${breaking.length > 1 ? 's' : ''}`;
  } else if (feats.length > 0) {
    kind = 'minor';
    reason = `${feats.length} feat commit${feats.length > 1 ? 's' : ''}, no breaking changes`;
  } else {
    kind = 'patch';
    reason = `${filtered.length} non-breaking, non-feat commit${filtered.length > 1 ? 's' : ''}`;
  }

  const next = applyBump(prev, kind, prereleaseId);
  if (prereleaseId) {
    reason = `${reason}; pre-release id "${prereleaseId}"${prevIsPrerelease ? ' (incremented)' : ' (entered)'}`;
  } else if (prevIsPrerelease) {
    reason = `${reason}; graduating ${prev} → stable (commit signal "${kind}" is informational only)`;
    kind = 'graduate';
  }

  return {
    previous_version: prev,
    next_version: next,
    bump_kind: kind,
    bump_reason: reason,
    release_date: today,
    commits: filtered,
    api_diff: { added: [], removed: [], changed: [] },
    breaking_changes: breaking.map(c => ({
      hash: c.hash,
      subject: c.subject,
      description: c.breaking_description,
    })),
    prerelease_id: prereleaseId,
    previous_is_prerelease: prevIsPrerelease,
  };
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

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('compute-bump.js');
if (isMain) {
  const cli = parseCliOptions(process.argv.slice(2));
  const manifest = computeBump(cli);
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify(manifest, null, 2));
  if (apply && manifest.next_version && manifest.bump_kind !== 'none') {
    writeFileSync('VERSION', `${manifest.next_version}\n`, 'utf8');
    process.stderr.write(`Wrote VERSION <- ${manifest.next_version}\n`);
  }
}
