#!/usr/bin/env node
// Cross-check an LLM-generated changelog section against the manifest.
// Usage: verify-output.js --manifest <manifest.json> --section <section.md> [--coverage]
// Exit 0 if clean, 1 if any check fails. Failures printed to stderr.

import { readFileSync } from 'node:fs';

const KEEP_A_CHANGELOG_HEADERS = new Set([
  'Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security',
]);

// Words that imply impact/judgement. Allowed only if a commit body literally contains them —
// i.e. the human authored that claim, not the model.
const EDITORIALIZE_PATTERNS = [
  /\bsignificantly\b/i,
  /\bdramatically\b/i,
  /\bmassively\b/i,
  /\bworld[-\s]?class\b/i,
  /\bbest[-\s]?in[-\s]?class\b/i,
  /\bblazingly\b/i,
  /\bTODO\b/,
  /\bFIXME\b/,
];

function parseArgs(argv) {
  const args = { coverage: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--manifest') args.manifest = argv[++i];
    else if (argv[i] === '--section') args.section = argv[++i];
    else if (argv[i] === '--coverage') args.coverage = true;
  }
  return args;
}

function hashMatches(reference, knownHashes) {
  if (knownHashes.has(reference)) return true;
  // Allow shortened/lengthened forms — common when git rewrites or model truncates.
  for (const h of knownHashes) {
    if (h.startsWith(reference) || reference.startsWith(h)) return true;
  }
  return false;
}

// A bullet may reference either a known commit hash OR the release version itself.
// The version-reference path covers single-commit releases where work and CHANGELOG land
// together — the to-be-made commit's hash isn't knowable at write time, so `(v0.1.0)` stands in.
function isValidRef(token, knownHashes, nextVersion) {
  if (nextVersion && token === nextVersion) return true;
  if (/^[0-9a-f]{7,40}$/.test(token)) return hashMatches(token, knownHashes);
  return false;
}

// Coverage check: every Conventional-Commit scope in the manifest should be represented by at least
// one bullet — either via a hash reference or a subject-keyword match in the section text. Heuristic.
// Commits with no scope are bucketed under "(no scope)" and treated as a single group.
function checkCoverage(manifest, section) {
  const sectionLower = section.toLowerCase();
  const hashRefs = new Set(
    [...section.matchAll(/\(([0-9a-f]{7,40})\)/g)].map(m => m[1].toLowerCase())
  );

  function commitCovered(c) {
    const hash = (c.hash ?? '').toLowerCase();
    if (hash) {
      for (const t of hashRefs) {
        if (t === hash || t.startsWith(hash) || hash.startsWith(t)) return true;
      }
    }
    const keywords = (c.subject ?? '').toLowerCase().split(/\W+/).filter(w => w.length >= 5);
    return keywords.some(w => sectionLower.includes(w));
  }

  const byScope = new Map();
  for (const c of manifest.commits ?? []) {
    const key = c.scope || '(no scope)';
    if (!byScope.has(key)) byScope.set(key, []);
    byScope.get(key).push(c);
  }

  const errors = [];
  for (const [scope, commits] of byScope) {
    if (commits.some(commitCovered)) continue;
    const examples = commits.slice(0, 3)
      .map(c => `${c.hash} ${c.subject ?? ''}`.trim())
      .join('; ');
    const n = commits.length;
    errors.push(`Coverage: scope "${scope}" (${n} commit${n === 1 ? '' : 's'}) not surfaced — e.g. ${examples}`);
  }
  return errors;
}

export function verify(manifest, section, { coverage = false } = {}) {
  const errors = [];
  const knownHashes = new Set(manifest.commits.map(c => c.hash));
  const nextVersion = manifest.next_version;
  const refPattern = /\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)/g;

  // Every reference token must be either a real commit hash or the next version.
  const refTokens = [...section.matchAll(refPattern)];
  for (const m of refTokens) {
    if (!isValidRef(m[1], knownHashes, nextVersion)) {
      errors.push(`Reference (${m[1]}) is not a known commit hash and does not equal next_version (${nextVersion}).`);
    }
  }

  // Every bullet must end with a hash-or-version reference.
  for (const line of section.split('\n')) {
    if (/^\s*[-*]\s/.test(line) && !/\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)\s*$/.test(line)) {
      errors.push(`Bullet missing trailing reference: "${line.trim()}"`);
    }
  }

  // Headers must be Keep-a-Changelog v1.1.0 groups.
  for (const line of section.split('\n')) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m && !KEEP_A_CHANGELOG_HEADERS.has(m[1])) {
      errors.push(`Header "${m[1]}" is not a Keep-a-Changelog v1.1.0 group.`);
    }
  }

  // Editorializing language allowed only if a commit body literally contains it.
  const allBodies = manifest.commits
    .map(c => `${c.subject || ''}\n${c.body || ''}`)
    .join('\n');
  for (const pat of EDITORIALIZE_PATTERNS) {
    if (pat.test(section) && !pat.test(allBodies)) {
      errors.push(`Editorializing match (${pat}) not supported by any commit body.`);
    }
  }

  if (coverage) {
    errors.push(...checkCoverage(manifest, section));
  }

  return errors;
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('verify-output.js');
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.section) {
    console.error('Usage: verify-output.js --manifest <manifest.json> --section <section.md> [--coverage]');
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(args.manifest, 'utf8'));
  const section = readFileSync(args.section, 'utf8');
  const errors = verify(manifest, section, { coverage: args.coverage });
  if (errors.length === 0) {
    console.log('OK');
    process.exit(0);
  }
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
