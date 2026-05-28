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

export function computeBump() {
  const prev = lastTag();
  const range = prev ? `${prev}..HEAD` : 'HEAD';
  const commits = commitsInRange(range);
  const today = new Date().toISOString().slice(0, 10);

  if (commits.length === 0) {
    return {
      previous_version: prev,
      next_version: prev,
      bump_kind: 'none',
      bump_reason: 'no commits since last tag',
      release_date: today,
      commits: [],
      api_diff: { added: [], removed: [], changed: [] },
      breaking_changes: [],
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
  if (breaking.length > 0) {
    kind = 'major';
    reason = `${breaking.length} breaking change${breaking.length > 1 ? 's' : ''}`;
  } else if (feats.length > 0) {
    kind = 'minor';
    reason = `${feats.length} feat commit${feats.length > 1 ? 's' : ''}, no breaking changes`;
  } else {
    kind = 'patch';
    reason = `${filtered.length} non-breaking, non-feat commit${filtered.length > 1 ? 's' : ''}`;
  }

  const base = prev ? prev.replace(/^v/, '') : '0.0.0';
  const coerced = semver.coerce(base);
  const nextRaw = semver.inc(coerced ? coerced.version : '0.0.0', kind);
  const next = `v${nextRaw}`;

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
  };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('compute-bump.js');
if (isMain) {
  const manifest = computeBump();
  const apply = process.argv.includes('--apply');
  console.log(JSON.stringify(manifest, null, 2));
  if (apply && manifest.next_version && manifest.bump_kind !== 'none') {
    writeFileSync('VERSION', `${manifest.next_version}\n`, 'utf8');
    process.stderr.write(`Wrote VERSION <- ${manifest.next_version}\n`);
  }
}
