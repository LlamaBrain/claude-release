#!/usr/bin/env node
// Pure-script bump computation. No LLM. Emits the release manifest to stdout.
// `--apply` writes VERSION at the repo root.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import semver from 'semver';
import { parseCommit } from './parse-commits.js';
import { expandSquashCommit } from './squash-changes.js';
import { resolveJsonPointer } from './json-pointer.js';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }).trim();
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
const PSEP = '<<<PARENTS>>>';

function commitsInRange(range, additionalTypes = [], strictPolicy = false) {
  // execFileSync passes the format arg literally; no shell sees the sentinels so '<<<H>>>'
  // is safe. (Earlier execSync version was broken on cmd.exe/bash.)
  const out = git('log', range, `--pretty=format:%H${HSEP}%P${PSEP}%B${CSEP}`);
  if (!out) return [];
  return out
    .split(CSEP)
    .map(c => c.trim())
    .filter(Boolean)
    .map(chunk => {
      const idx = chunk.indexOf(HSEP);
      const fullHash = chunk.slice(0, idx);
      const parentEnd = chunk.indexOf(PSEP, idx + HSEP.length);
      if (idx < 0 || parentEnd < 0) throw new Error('malformed Git history record');
      const parents = chunk.slice(idx + HSEP.length,parentEnd).trim().split(/\s+/).filter(Boolean);
      const message = chunk.slice(parentEnd + PSEP.length).trim();
      if (parents.length > 1 && /^Merge (?:branch|remote-tracking branch|tag) /.test(message.split(/\r?\n/,1)[0])) {
        const tree = git('rev-parse', fullHash + '^{tree}');
        if (parents.some(parent => git('rev-parse', parent + '^{tree}') === tree)) return null;
      }
      const parsed = parseCommit(message, { additionalTypes, strictPolicy });
      return {
        hash: fullHash.slice(0, 7),
        full_hash: fullHash,
        ...parsed,
      };
    }).filter(Boolean).flatMap(commit => expandSquashCommit(commit, { additionalTypes, strictPolicy }));
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
  const defaults = {feat:'minor', fix:'patch', perf:'patch', docs:'none', style:'none', refactor:'none', test:'none', chore:'none', ci:'none', build:'none', revert:'none'};
  const custom = options.typeMap || {};
  if (typeof custom !== 'object' || Array.isArray(custom)) throw new Error('typeMap must be an object');
  for (const [type, impact] of Object.entries(custom)) if (!/^[a-z][a-z0-9-]*$/.test(type) || !['none','patch','minor'].includes(impact)) throw new Error('invalid typeMap entry');
  const typeMap = Object.assign(Object.create(null), defaults, custom);
  if (bumpOverride && !['major', 'minor', 'patch'].includes(bumpOverride)) {
    throw new Error(`bumpOverride must be one of major|minor|patch (got "${bumpOverride}")`);
  }
  const explicitBaseline = Boolean(options.baseline || options.baselineRef);
  if (Boolean(explicitBaseline) !== Boolean(options.target) || (options.baseline && options.baselineRef)) throw new Error('one baseline and target must be supplied together');
  if (!options.baselineRef && (options.baselineVersion || options.baselineSurface || options.baselinePointer)) throw new Error('initial baseline version and surface require baselineRef');
  let prev = lastTag();
  let baselineRevision = null;
  let baselineKind = null;
  let targetRevision = git('rev-parse', '--verify', 'HEAD^{commit}');
  let range;
  if (options.baselineRef) {
    if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(options.baselineRef) || typeof options.baselineVersion !== 'string' || !/^v?\d+\.\d+\.\d+$/.test(options.baselineVersion) || !semver.valid(options.baselineVersion)) throw new Error('initial baseline requires an exact OID and stable version');
    if (typeof options.baselineSurface !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(options.baselineSurface) || options.baselineSurface.startsWith('/') || options.baselineSurface.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('invalid initial baseline surface');
    if (typeof options.target !== 'string' || options.target.startsWith('-')) throw new Error('invalid target revision');
    baselineRevision = git('rev-parse', '--verify', options.baselineRef + '^{commit}');
    const surface = git('show', baselineRevision + ':' + options.baselineSurface);
    let surfaceVersion = surface;
    if (options.baselinePointer) {
      const {parent, key} = resolveJsonPointer(JSON.parse(surface), options.baselinePointer);
      if (typeof parent[key] !== 'string') throw new Error('initial baseline JSON version must be a string');
      surfaceVersion = parent[key];
    }
    surfaceVersion = surfaceVersion.replace(/^v/, '');
    if (surfaceVersion !== options.baselineVersion.replace(/^v/, '')) throw new Error('initial baseline version does not match the committed surface');
    prev = options.baselineVersion;
    baselineKind = 'declared_initial';
    targetRevision = git('rev-parse', '--verify', options.target + '^{commit}');
    try { git('merge-base', '--is-ancestor', baselineRevision, targetRevision); } catch { throw new Error('baseline is not an ancestor of target'); }
    range = baselineRevision + '..' + targetRevision;
  } else if (options.baseline) {
    if (typeof options.target !== 'string' || options.target.startsWith('-')) throw new Error('invalid target revision');
    targetRevision = git('rev-parse', '--verify', options.target + '^{commit}');
    if (options.baseline === 'latest-stable') {
      const tags = git('tag', '--merged', targetRevision, '--list').split(/\r?\n/).filter(tag => semver.valid(tag) && !semver.prerelease(tag));
      if (!tags.length) throw new Error('no reachable stable SemVer tag; configure an explicit initial baseline');
      tags.sort((a,b) => semver.rcompare(a,b));
      if (tags.length > 1 && semver.compare(tags[0],tags[1]) === 0) throw new Error('ambiguous latest stable SemVer tags');
      prev = tags[0]; baselineKind = 'latest_stable';
    } else {
      if (typeof options.baseline !== 'string' || !semver.valid(options.baseline) || semver.prerelease(options.baseline)) throw new Error('baseline must be a stable SemVer tag');
      prev = options.baseline; baselineKind = 'stable_tag';
    }
    baselineRevision = git('rev-parse', '--verify', 'refs/tags/' + prev + '^{commit}');
    try { git('merge-base', '--is-ancestor', baselineRevision, targetRevision); } catch { throw new Error('baseline is not an ancestor of target'); }
    range = baselineRevision + '..' + targetRevision;
  } else {
    if (prev) baselineRevision = git('rev-parse', '--verify', prev + '^{commit}');
    range = prev ? prev + '..HEAD' : 'HEAD';
  }
  let commits = commitsInRange(range, Object.keys(typeMap), explicitBaseline);
  if (options.previewWrapper !== undefined) {
    const wrapper = options.previewWrapper;
    if (!explicitBaseline || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(wrapper || '') || wrapper !== targetRevision
        || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(options.compatibilityBase || '')) throw new Error('preview wrapper requires exact target and compatibility base');
    const object = git('cat-file', '-p', wrapper);
    const header = object.split('\n\n', 1)[0];
    const expected = `tree ${git('rev-parse', wrapper + '^{tree}')}\nparent ${options.compatibilityBase}\nauthor Captain Preview <captain-preview@invalid> 0 +0000\ncommitter Captain Preview <captain-preview@invalid> 0 +0000`;
    if (header !== expected || !object.startsWith(header + '\n\nchore(landing): refresh approved feature\n\n')) throw new Error('preview wrapper is not the deterministic Captain object');
    const lines = object.slice((header + '\n\nchore(landing): refresh approved feature\n\n').length).split('\n');
    if (lines.some(line => !/^(?:(?:Implements|Completes|Needs-QA|Captain-Run):[ \t]+\S(?:[^\r\n]*\S)?|Captain-Changes: [A-Za-z0-9_-]+)$/.test(line))) throw new Error('preview wrapper contains unexpected semantic content');
    const wrappers = commits.filter(commit => commit.full_hash === wrapper && commit.squash_summary);
    if (wrappers.length !== 1 || !commits.some(commit => commit.squash_hash === wrapper)) throw new Error('preview wrapper lacks validated semantic children');
    commits = commits.filter(commit => !(commit.full_hash === wrapper && commit.squash_summary));
  }
  if (explicitBaseline && baselineRevision) {
    const released = new Map();
    const normalize = value => (value || '').replace(/\r\n/g,'\n').split('\n').filter(line => !/^Captain-Changes:/i.test(line)).join('\n').trim();
    for (const entry of commitsInRange(baselineRevision, Object.keys(typeMap), false)) {
      const message = normalize(entry.raw), existing = released.get(entry.full_hash);
      if (existing !== undefined && existing !== message) throw new Error('conflicting released semantic commit ' + entry.full_hash);
      released.set(entry.full_hash,message);
    }
    commits = commits.filter(entry => {
      const existing = released.get(entry.full_hash);
      if (existing === undefined) return true;
      if (existing !== normalize(entry.raw)) throw new Error('semantic commit conflicts with released baseline ' + entry.full_hash);
      return false;
    });
  }
  const seenSource = new Set();
  for (const commit of commits) {
    if (explicitBaseline && (!commit.valid || (commit.breaking && !commit.breaking_description))) throw new Error('invalid Conventional Commit ' + commit.full_hash);
    if (seenSource.has(commit.full_hash)) throw new Error('duplicate semantic commit ' + commit.full_hash);
    seenSource.add(commit.full_hash);
  }
  const today = new Date().toISOString().slice(0, 10);
  const prevIsPrerelease = prev ? (semver.prerelease(prev.replace(/^v/, '')) || []).length > 0 : false;

  if (commits.length === 0) {
    if (bumpOverride) {
      const next = applyBump(prev, bumpOverride, prereleaseId);
      return {
        previous_version: prev,
        baseline_revision: baselineRevision,
        baseline_kind: baselineKind,
        type_map: typeMap,
        target_revision: targetRevision,
        ...(options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {}),
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
        baseline_revision: baselineRevision,
        baseline_kind: baselineKind,
        type_map: typeMap,
        target_revision: targetRevision,
        ...(options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {}),
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
  const ranks = { none: 0, patch: 1, minor: 2, major: 3 };
  let kind = breaking.length ? 'major' : 'none';
  let reason = breaking.length ? `${breaking.length} breaking change(s)` : 'non-breaking commit type mapping';
  for (const commit of filtered) {
    const impact = typeMap[commit.type] || 'none';
    if (ranks[impact] > ranks[kind]) kind = impact;
  }
  if (bumpOverride && ranks[bumpOverride] > ranks[kind]) {
    kind = bumpOverride;
    reason += `; raised by explicit --bump ${bumpOverride}`;
  }
  const next = kind === 'none' ? prev : applyBump(prev, kind, prereleaseId);
  if (prereleaseId) {
    reason = `${reason}; pre-release id "${prereleaseId}"${prevIsPrerelease ? ' (incremented)' : ' (entered)'}`;
  } else if (prevIsPrerelease && kind !== 'none') {
    reason = `${reason}; graduating ${prev} → stable (commit signal "${kind}" is informational only)`;
    kind = 'graduate';
  }

  return {
    previous_version: prev,
        baseline_revision: baselineRevision,
        baseline_kind: baselineKind,
        type_map: typeMap,
        target_revision: targetRevision,
        ...(options.previewWrapper ? { preview_wrapper: options.previewWrapper } : {}),
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
    ...(bumpOverride ? { bump_override: bumpOverride } : {}),
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
    } else if (['--baseline', '--target', '--baseline-ref', '--baseline-version', '--baseline-surface', '--baseline-pointer'].includes(a)) {
      const next = argv[++i];
      if (!next || next.startsWith('--')) throw new Error(a + ' requires a value');
      const keys = {'--baseline':'baseline', '--target':'target', '--baseline-ref':'baselineRef', '--baseline-version':'baselineVersion', '--baseline-surface':'baselineSurface', '--baseline-pointer':'baselinePointer'};
      out[keys[a]] = next;
    } else if (a === '--type-map') {
      const path = argv[++i];
      if (!path || path.startsWith('--')) throw new Error('--type-map requires a JSON file');
      out.typeMap = JSON.parse(readFileSync(path, 'utf8'));
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
