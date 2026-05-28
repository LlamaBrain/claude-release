// Smell-test library. Five v1 checks across commit message + staged diff + (optional) changelog.
// Pure logic — the CLI/wrapper passes in resolved inputs. Each check returns a warning object or
// null; the runner concatenates them.

import { execFileSync } from 'node:child_process';
import { parseCommit } from './parse-commits.js';
import { tryApiDiff } from './api-diff.js';
import { computeBump } from './compute-bump.js';

function gitOk(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    return '';
  }
}

function lastTag() {
  const out = gitOk('describe', '--tags', '--abbrev=0').trim();
  return out || null;
}

export function getStagedInputs() {
  const paths = gitOk('diff', '--cached', '--name-only').trim().split('\n').filter(Boolean);
  const shortstat = gitOk('diff', '--cached', '--shortstat').trim();
  const files = parseInt((/(\d+) files? changed/.exec(shortstat) ?? [])[1] ?? '0', 10);
  const insertions = parseInt((/(\d+) insertions?/.exec(shortstat) ?? [])[1] ?? '0', 10);
  const deletions = parseInt((/(\d+) deletions?/.exec(shortstat) ?? [])[1] ?? '0', 10);
  return {
    mode: 'staged',
    paths,
    stats: { files, insertions, deletions },
    prevRef: lastTag(),
    toRef: 'WORKTREE',
    addedLinesForPath: (p) => {
      const diff = gitOk('diff', '--cached', '--no-color', '--', p);
      return diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n');
    },
  };
}

export function getCommitInputs(ref) {
  const paths = gitOk('diff-tree', '--no-commit-id', '--name-only', '-r', ref).trim().split('\n').filter(Boolean);
  const shortstat = gitOk('show', '--shortstat', '--format=', ref).trim();
  const files = parseInt((/(\d+) files? changed/.exec(shortstat) ?? [])[1] ?? '0', 10);
  const insertions = parseInt((/(\d+) insertions?/.exec(shortstat) ?? [])[1] ?? '0', 10);
  const deletions = parseInt((/(\d+) deletions?/.exec(shortstat) ?? [])[1] ?? '0', 10);
  const prev = gitOk('rev-parse', `${ref}~1`).trim() || null;
  return {
    mode: 'commit',
    ref,
    paths,
    stats: { files, insertions, deletions },
    prevRef: prev,
    toRef: ref,
    addedLinesForPath: (p) => {
      const diff = gitOk('show', '--no-color', '--format=', ref, '--', p);
      return diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).map(l => l.slice(1)).join('\n');
    },
  };
}

export function getCommitMessage(ref) {
  return gitOk('show', '-s', '--format=%B', ref).trim();
}

// ---- Individual checks ----

async function checkApiBreakNoMarker({ message, inputs, runApiDiff }) {
  const parsed = parseCommit(message);
  if (parsed.breaking) return null;
  if (!inputs.prevRef) return null;
  const apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  if (!apiDiff) return null;
  const removed = apiDiff.removed?.length ?? 0;
  const changed = apiDiff.changed?.length ?? 0;
  if (removed === 0 && changed === 0) return null;
  return {
    check: 'api-break-no-marker',
    severity: 'warning',
    message: 'Diff modifies/removes public API but the commit message has no breaking-change marker.',
    details: {
      removed_count: removed,
      changed_count: changed,
      examples: [
        ...(apiDiff.removed ?? []).slice(0, 3).map(e => `removed: ${e.fqn}`),
        ...(apiDiff.changed ?? []).slice(0, 3).map(e => `changed: ${e.fqn}`),
      ],
      hint: 'Add `!` after the type/scope (e.g. `feat!:`) AND a body or `BREAKING CHANGE: <what changed and how to migrate>` footer.',
    },
  };
}

function checkBreakingMarkerNoDescription({ message }) {
  const parsed = parseCommit(message);
  if (!parsed.breaking) return null;
  const desc = (parsed.breaking_description ?? '').trim();
  const bodyMinusBreaking = (parsed.body ?? '')
    .replace(/^BREAKING[ -]CHANGE:.*$/im, '')
    .trim();
  const SUBSTANTIVE = 20; // chars
  if (desc.length >= SUBSTANTIVE) return null;
  if (bodyMinusBreaking.length >= SUBSTANTIVE) return null;
  return {
    check: 'breaking-marker-no-description',
    severity: 'warning',
    message: 'Breaking-change marker is present but no substantive description was provided.',
    details: {
      hint: 'Add a `BREAKING CHANGE: <description>` footer or a paragraph in the body explaining what broke and how to migrate.',
    },
  };
}

function checkThinSubjectOnSubstantiveDiff({ message, inputs, thresholdFiles, thresholdLoc }) {
  const parsed = parseCommit(message);
  const body = (parsed.body ?? '').trim();
  const SUBSTANTIVE = 20;
  if (body.length >= SUBSTANTIVE) return null;
  const loc = inputs.stats.insertions + inputs.stats.deletions;
  if (inputs.stats.files <= thresholdFiles && loc <= thresholdLoc) return null;
  return {
    check: 'thin-subject-on-substantive-diff',
    severity: 'warning',
    message: `Substantial diff (${inputs.stats.files} files, ${loc} LOC) but the commit message has no body.`,
    details: {
      files: inputs.stats.files,
      loc,
      threshold_files: thresholdFiles,
      threshold_loc: thresholdLoc,
      hint: 'Add a body explaining the why/what — one or two sentences is usually enough.',
    },
  };
}

function checkConventionalMalformed({ message }) {
  const parsed = parseCommit(message);
  if (parsed.valid) return null;
  return {
    check: 'conventional-malformed',
    severity: 'warning',
    message: 'Commit message is not a valid Conventional Commit.',
    details: {
      raw_subject: (parsed.raw ?? '').split('\n')[0],
      hint: 'Use the form `<type>(<scope>): <subject>` (e.g. `feat(ui): add pause panel`). Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.',
    },
  };
}

function checkScopeMismatch({ message, inputs }) {
  const parsed = parseCommit(message);
  if (!parsed.valid || !parsed.scope) return null;
  const scope = parsed.scope.toLowerCase();
  const matched = inputs.paths.some(p => p.toLowerCase().includes(scope));
  if (matched) return null;
  return {
    check: 'scope-mismatch',
    severity: 'warning',
    message: `Commit scope "${scope}" does not appear in any staged path.`,
    details: {
      scope,
      paths_sample: inputs.paths.slice(0, 5),
      hint: 'Either the scope is wrong, or the change is broader than the scope implies. Pick a scope that matches the most-touched area, or drop the scope.',
    },
  };
}

function checkUnrelatedAreaBundling({ inputs, thresholdTopLevelDirs }) {
  // Release-style commits naturally span many top-level dirs (CHANGELOG + VERSION + work).
  // Skip when CHANGELOG.md is in the staged set — that's the release-commit signal per the
  // releases-are-one-commit convention.
  if (inputs.paths.some(p => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return null;
  const topLevels = new Set();
  for (const p of inputs.paths) {
    const top = p.split('/')[0];
    if (top) topLevels.add(top);
  }
  if (topLevels.size <= thresholdTopLevelDirs) return null;
  const arr = [...topLevels];
  return {
    check: 'unrelated-area-bundling',
    severity: 'warning',
    message: `Commit spans ${topLevels.size} top-level directories: ${arr.slice(0, 5).join(', ')}${topLevels.size > 5 ? '…' : ''}.`,
    details: {
      top_level_count: topLevels.size,
      top_levels: arr,
      threshold: thresholdTopLevelDirs,
      hint: 'Consider splitting into focused commits per area. Genuinely cross-cutting changes are fine; unrelated changes piggybacking on each other are not.',
    },
  };
}

async function checkChangelogClaimsUnbacked({ inputs, runApiDiff, manifest }) {
  if (!inputs.paths.some(p => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return [];
  const changelogPath = inputs.paths.find(p => /(?:^|\/)CHANGELOG\.md$/i.test(p));
  const added = inputs.addedLinesForPath(changelogPath);
  if (!added.trim()) return [];

  // Build a keyword corpus from commit subjects/bodies + api-diff fqns.
  const corpus = new Set();
  for (const c of manifest?.commits ?? []) {
    for (const w of `${c.subject ?? ''} ${c.body ?? ''}`.toLowerCase().split(/\W+/)) {
      if (w.length >= 5) corpus.add(w);
    }
  }
  let apiDiff = null;
  if (inputs.prevRef) apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  if (apiDiff) {
    const entries = [
      ...(apiDiff.added ?? []),
      ...(apiDiff.removed ?? []),
      ...(apiDiff.changed ?? []),
    ];
    for (const e of entries) {
      for (const w of (e.fqn ?? '').toLowerCase().split(/\W+/)) {
        if (w.length >= 4) corpus.add(w);
      }
    }
  }

  const warnings = [];
  for (const raw of added.split('\n')) {
    if (!/^\s*[-*]\s/.test(raw)) continue;
    const text = raw
      .replace(/\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)\s*$/, '')
      .replace(/^\s*[-*]\s+/, '')
      .toLowerCase();
    const keywords = text.split(/\W+/).filter(w => w.length >= 5);
    if (keywords.length === 0) continue;
    if (keywords.some(w => corpus.has(w))) continue;
    warnings.push({
      check: 'changelog-claims-unbacked',
      severity: 'warning',
      message: `Changelog bullet not backed by any commit subject/body or api-diff entry: "${raw.trim().slice(0, 100)}"`,
      details: {
        bullet: raw.trim(),
        hint: 'Either rewrite the bullet using terms that appear in the underlying commit messages, or add a commit/api-diff entry that supports the claim.',
      },
    });
  }
  return warnings;
}

async function checkChangelogMissesBreakingChange({ inputs, runApiDiff, manifest }) {
  if (!inputs.paths.some(p => /(?:^|\/)CHANGELOG\.md$/i.test(p))) return [];

  const breakingCommits = (manifest?.commits ?? []).filter(c => c.breaking);
  let apiDiff = null;
  if (inputs.prevRef) apiDiff = await runApiDiff(inputs.prevRef, inputs.toRef);
  const apiBreaks = apiDiff
    ? [
        ...(apiDiff.removed ?? []).map(e => ({ source: 'removed', ...e })),
        ...(apiDiff.changed ?? []).map(e => ({ source: 'changed', ...e })),
      ]
    : [];

  if (breakingCommits.length === 0 && apiBreaks.length === 0) return [];

  const changelogPath = inputs.paths.find(p => /(?:^|\/)CHANGELOG\.md$/i.test(p));
  const added = inputs.addedLinesForPath(changelogPath).toLowerCase();

  if (!added.trim()) {
    return [{
      check: 'changelog-misses-breaking-change',
      severity: 'warning',
      message: 'CHANGELOG.md is staged but no new content was added — breaking changes cannot be surfaced.',
      details: {
        breaking_commits: breakingCommits.length,
        api_breaks: apiBreaks.length,
      },
    }];
  }

  const warnings = [];

  for (const c of breakingCommits) {
    const subject = (c.subject ?? '').toLowerCase();
    const hash = (c.hash ?? '').toLowerCase();
    const matchHash = hash && added.includes(hash);
    const subjectKeywords = subject.split(/\W+/).filter(w => w.length >= 5);
    const matchSubject = subjectKeywords.some(w => added.includes(w));
    if (!matchHash && !matchSubject) {
      warnings.push({
        check: 'changelog-misses-breaking-change',
        severity: 'warning',
        message: `Breaking-change commit not surfaced in CHANGELOG: ${c.hash} ${c.subject}`,
        details: {
          source: 'commit',
          commit: c.hash,
          subject: c.subject,
          breaking_description: c.breaking_description,
        },
      });
    }
  }

  for (const b of apiBreaks) {
    const fqn = (b.fqn ?? '').toLowerCase();
    const sigPart = fqn.split('(')[0];
    const parts = sigPart.split('.');
    const lastPart = parts[parts.length - 1] ?? '';
    const typePart = parts.length >= 2 ? parts[parts.length - 2] : '';
    let matched = false;
    if (lastPart && lastPart.length >= 3 && added.includes(lastPart)) matched = true;
    if (!matched && typePart && typePart.length >= 3 && added.includes(typePart)) matched = true;
    if (!matched) {
      warnings.push({
        check: 'changelog-misses-breaking-change',
        severity: 'warning',
        message: `API ${b.source} not surfaced in CHANGELOG: ${b.kind} ${b.fqn}`,
        details: {
          source: 'api_diff',
          kind: b.kind,
          fqn: b.fqn,
          api_source: b.source,
        },
      });
    }
  }

  return warnings;
}

// ---- Public runner ----

export async function runSmellChecks({
  message,
  inputs,
  thresholdFiles = 5,
  thresholdLoc = 100,
  thresholdTopLevelDirs = 5,
  runApiDiff = tryApiDiff,
  manifest = null,
} = {}) {
  if (!message) throw new Error('runSmellChecks: message is required');
  if (!inputs) throw new Error('runSmellChecks: inputs is required (use getStagedInputs() or getCommitInputs(ref))');

  // Build manifest lazily for the changelog checks; only needed when CHANGELOG.md is staged AND
  // we don't already have one passed in.
  let resolvedManifest = manifest;
  if (!resolvedManifest && inputs.paths.some(p => /(?:^|\/)CHANGELOG\.md$/i.test(p))) {
    try { resolvedManifest = computeBump(); } catch { resolvedManifest = null; }
  }

  const warnings = [];
  const add = (w) => { if (w) warnings.push(w); };
  const addAll = (ws) => { for (const w of ws ?? []) add(w); };

  add(await checkApiBreakNoMarker({ message, inputs, runApiDiff }));
  add(checkBreakingMarkerNoDescription({ message }));
  add(checkThinSubjectOnSubstantiveDiff({ message, inputs, thresholdFiles, thresholdLoc }));
  add(checkConventionalMalformed({ message }));
  add(checkScopeMismatch({ message, inputs }));
  add(checkUnrelatedAreaBundling({ inputs, thresholdTopLevelDirs }));
  addAll(await checkChangelogMissesBreakingChange({ inputs, runApiDiff, manifest: resolvedManifest }));
  addAll(await checkChangelogClaimsUnbacked({ inputs, runApiDiff, manifest: resolvedManifest }));

  return { warnings };
}
