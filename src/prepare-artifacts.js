import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { verify } from './verify-output.js';
import semver from 'semver';
import { resolveJsonPointer } from './json-pointer.js';

export function safePath(path) {
  return typeof path === 'string' && /^[A-Za-z0-9._/-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(x => !x || x === '.' || x === '..' || x.endsWith('.') || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x));
}
function version(value) {
  if (typeof value !== 'string' || !/^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/.test(value)) throw new Error('invalid SemVer');
  if (!semver.valid(value)) throw new Error('invalid SemVer');
  return value.replace(/^v/, '');
}
function replaceSurface(surface, next, previous) {
  if (!safePath(surface.path) || typeof surface.content !== 'string') throw new Error('invalid version surface');
  const allowed = current => {
    const normalized = version(current);
    const sameTargetPrerelease = normalized.includes('-') && normalized.split('-')[0] === next.split('-')[0];
    if (normalized !== previous && normalized !== next && !sameTargetPrerelease) throw new Error('version surface conflicts with release baseline');
    return (current.startsWith('v') ? 'v' : '') + next;
  };
  if (surface.kind === 'json') {
    const doc = JSON.parse(surface.content);
    const pointers = [surface.pointer, ...(surface.mirrors || [])];
    if (!pointers.length || new Set(pointers).size !== pointers.length) throw new Error('invalid JSON pointers');
    let changed = false;
    for (const pointer of pointers) {
      const {parent, key} = resolveJsonPointer(doc, pointer);
      if (typeof parent[key] !== 'string') throw new Error('missing JSON version');
      const nextValue = allowed(parent[key]);
      if (parent[key] !== nextValue) { parent[key] = nextValue; changed = true; }
    }
    if (!changed) return surface.content;
    const indent = /\n([ \t]+)\S/.exec(surface.content)?.[1] || '  ';
    const eol = surface.content.includes('\r\n') ? '\r\n' : '\n';
    return JSON.stringify(doc,null,indent).replace(/\n/g,eol) + (surface.content.endsWith('\n') ? eol : '');
  }
  if (surface.kind === 'literal') {
    if (typeof surface.prefix !== 'string' || !surface.prefix || typeof surface.suffix !== 'string' || !surface.suffix) throw new Error('literal surfaces require nonempty prefix and suffix');
    const matches = [];
    for (let start = surface.content.indexOf(surface.prefix); start >= 0; start = surface.content.indexOf(surface.prefix, start + 1)) {
      const valueStart = start + surface.prefix.length;
      const end = surface.content.indexOf(surface.suffix, valueStart);
      if (end < 0) continue;
      const old = surface.content.slice(valueStart, end);
      try { version(old); matches.push({valueStart, end, old}); } catch { /* not a version */ }
    }
    if (matches.length !== 1) throw new Error('literal surface must match exactly once');
    const match = matches[0];
    return surface.content.slice(0,match.valueStart) + allowed(match.old) + surface.content.slice(match.end);
  }
  const patterns = {
    text: /^(\s*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(\s*)$/g,
    unity: /^([ \t]*bundleVersion:[ \t]*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)([ \t]*)$/gm,
    doxygen: /^([ \t]*PROJECT_NUMBER[ \t]*=[ \t]*)(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)([ \t]*)$/gm,
  };
  const pattern = patterns[surface.kind];
  if (!pattern) throw new Error('unsupported version surface');
  const matches = [...surface.content.matchAll(pattern)];
  if (matches.length !== 1) throw new Error('version surface must match exactly once');
  return surface.content.replace(pattern, (_, prefix, old, suffix) => prefix + allowed(old) + suffix);
}
function releaseSection(manifest) {
  const groups = new Map();
  for (const commit of manifest.commits) {
    if (!/^[0-9a-f]{7,40}$/.test(commit.hash || '') || typeof commit.subject !== 'string' || /[\r\n]/.test(commit.subject)) throw new Error('invalid changelog commit');
    const group = commit.breaking ? 'Changed' : commit.type === 'feat' ? 'Added' : ['fix', 'perf'].includes(commit.type) ? 'Fixed' : 'Changed';
    if (!groups.has(group)) groups.set(group, []);
    const ref = commit.squash_hash ? commit.squash_hash.slice(0, 7) : commit.hash;
    if (!/^[0-9a-f]{7,40}$/.test(ref)) throw new Error('invalid durable commit reference');
    groups.get(group).push(`- ${commit.subject} (${ref})`);
  }
  const marker = `<!-- captain-release baseline:${manifest.baseline_revision} target:${manifest.target_revision} -->`;
  const lines = [`## [${manifest.next_version}] - ${manifest.release_date}`, '', marker, ''];
  for (const group of ['Added', 'Changed', 'Fixed']) if (groups.has(group)) lines.push(`### ${group}`, '', ...groups.get(group), '');
  return lines.join('\n').trimEnd() + '\n';
}
export function prepareArtifacts({ manifest, surfaces, changelog }, {verifyNotApplicable} = {}) {
  if (!manifest || !['patch','minor','major'].includes(manifest.bump_kind) || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.baseline_revision || '') || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.target_revision || '') || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.release_date || '') || !Array.isArray(manifest.commits) || !manifest.commits.length) throw new Error('release manifest requires a classified exact revision range');
  const missing = [['api_analysis',manifest.api_analysis,manifest.api_diff], ...(manifest.compatibility_analysis ? [['compatibility_analysis',manifest.compatibility_analysis,manifest.compatibility_diff]] : [])].filter(([,analysis]) => analysis?.status !== 'analyzed');
  if (missing.length) {
    const attest = typeof verifyNotApplicable === 'function' ? verifyNotApplicable(manifest) : null;
    if (missing.some(([name,analysis,diff]) => {
      const reason = attest?.[name], adjudicated = manifest.adjudication?.not_applicable?.[name];
      return analysis?.status !== 'unavailable' || diff !== null || typeof reason !== 'string' || !reason.trim() || reason.length > 2000 || (adjudicated !== undefined && adjudicated !== reason);
    })) throw new Error('compatibility analysis unavailable without authenticated not-applicable policy');
  }
  const next = version(manifest.next_version), previous = version(manifest.previous_version);
  if (!Array.isArray(surfaces) || !surfaces.length || !changelog || !safePath(changelog.path) || typeof changelog.content !== 'string') throw new Error('invalid artifact configuration');
  const section = releaseSection(manifest);
  const errors = verify(manifest, section, {coverage:true});
  if (errors.length) throw new Error('invalid changelog: ' + errors.join('; '));
  const output = Object.create(null), used = new Set([changelog.path]);
  for (const surface of surfaces) {
    if (used.has(surface.path)) throw new Error('duplicate artifact path');
    used.add(surface.path); output[surface.path] = replaceSurface(surface, next, previous);
  }
  const heading = `## [${manifest.next_version}]`;
  const occurrences = changelog.content.split('\n').filter(line => line.startsWith(heading));
  if (occurrences.length) {
    if (occurrences.length !== 1) throw new Error('duplicate release heading');
    const start = changelog.content.indexOf(heading);
    const end = changelog.content.indexOf('\n## ', start + heading.length);
    const existing = changelog.content.slice(start, end < 0 ? undefined : end).trim();
    const normalize = value => value.replace(/^(## \[[^\]]+\] - )\d{4}-\d{2}-\d{2}/, '$1DATE').trim();
    if (normalize(existing) !== normalize(section)) throw new Error('existing release version conflicts with this revision');
    output[changelog.path] = changelog.content;
  } else {
    const match = /^(# [^\r\n]+\r?\n)/.exec(changelog.content);
    if (!match) throw new Error('changelog must start with a title');
    output[changelog.path] = match[1] + '\n' + section + '\n' + changelog.content.slice(match[1].length).replace(/^\s*/, '');
  }
  return { ...output };
}
const invoked = process.argv[1] && basename(process.argv[1]) === 'prepare-artifacts.js';
if (invoked) {
  if (process.argv.length !== 4 || process.argv[2] !== '--request') throw new Error('usage: prepare-artifacts.js --request <json-file>');
  const request = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  process.stdout.write(JSON.stringify(prepareArtifacts(request), null, 2) + '\n');
}
