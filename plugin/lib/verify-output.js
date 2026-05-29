#!/usr/bin/env node
// claude-release bundled output — DO NOT EDIT. Source in src/.
import { createRequire as __cr } from 'node:module';
const require = __cr(import.meta.url);

// src/verify-output.js
import { readFileSync } from "node:fs";
var KEEP_A_CHANGELOG_HEADERS = /* @__PURE__ */ new Set([
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security"
]);
var EDITORIALIZE_PATTERNS = [
  /\bsignificantly\b/i,
  /\bdramatically\b/i,
  /\bmassively\b/i,
  /\bworld[-\s]?class\b/i,
  /\bbest[-\s]?in[-\s]?class\b/i,
  /\bblazingly\b/i,
  /\bTODO\b/,
  /\bFIXME\b/
];
function parseArgs(argv) {
  const args = { coverage: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--manifest") args.manifest = argv[++i];
    else if (argv[i] === "--section") args.section = argv[++i];
    else if (argv[i] === "--coverage") args.coverage = true;
  }
  return args;
}
function hashMatches(reference, knownHashes) {
  if (knownHashes.has(reference)) return true;
  for (const h of knownHashes) {
    if (h.startsWith(reference) || reference.startsWith(h)) return true;
  }
  return false;
}
function isValidRef(token, knownHashes, nextVersion) {
  if (nextVersion && token === nextVersion) return true;
  if (/^[0-9a-f]{7,40}$/.test(token)) return hashMatches(token, knownHashes);
  return false;
}
function checkCoverage(manifest, section) {
  const sectionLower = section.toLowerCase();
  const hashRefs = new Set(
    [...section.matchAll(/\(([0-9a-f]{7,40})\)/g)].map((m) => m[1].toLowerCase())
  );
  function commitCovered(c) {
    const hash = (c.hash ?? "").toLowerCase();
    if (hash) {
      for (const t of hashRefs) {
        if (t === hash || t.startsWith(hash) || hash.startsWith(t)) return true;
      }
    }
    const keywords = (c.subject ?? "").toLowerCase().split(/\W+/).filter((w) => w.length >= 5);
    return keywords.some((w) => sectionLower.includes(w));
  }
  const byScope = /* @__PURE__ */ new Map();
  for (const c of manifest.commits ?? []) {
    const key = c.scope || "(no scope)";
    if (!byScope.has(key)) byScope.set(key, []);
    byScope.get(key).push(c);
  }
  const errors = [];
  for (const [scope, commits] of byScope) {
    if (commits.some(commitCovered)) continue;
    const examples = commits.slice(0, 3).map((c) => `${c.hash} ${c.subject ?? ""}`.trim()).join("; ");
    const n = commits.length;
    errors.push(`Coverage: scope "${scope}" (${n} commit${n === 1 ? "" : "s"}) not surfaced \u2014 e.g. ${examples}`);
  }
  return errors;
}
function verify(manifest, section, { coverage = false } = {}) {
  const errors = [];
  const knownHashes = new Set(manifest.commits.map((c) => c.hash));
  const nextVersion = manifest.next_version;
  const refPattern = /\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)/g;
  const refTokens = [...section.matchAll(refPattern)];
  for (const m of refTokens) {
    if (!isValidRef(m[1], knownHashes, nextVersion)) {
      errors.push(`Reference (${m[1]}) is not a known commit hash and does not equal next_version (${nextVersion}).`);
    }
  }
  for (const line of section.split("\n")) {
    if (/^\s*[-*]\s/.test(line) && !/\(([0-9a-f]{7,40}|v\d+\.\d+\.\d+[\w.\-+]*)\)\s*$/.test(line)) {
      errors.push(`Bullet missing trailing reference: "${line.trim()}"`);
    }
  }
  for (const line of section.split("\n")) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m && !KEEP_A_CHANGELOG_HEADERS.has(m[1])) {
      errors.push(`Header "${m[1]}" is not a Keep-a-Changelog v1.1.0 group.`);
    }
  }
  const allBodies = manifest.commits.map((c) => `${c.subject || ""}
${c.body || ""}`).join("\n");
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
var isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("verify-output.js");
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.manifest || !args.section) {
    console.error("Usage: verify-output.js --manifest <manifest.json> --section <section.md> [--coverage]");
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(args.manifest, "utf8"));
  const section = readFileSync(args.section, "utf8");
  const errors = verify(manifest, section, { coverage: args.coverage });
  if (errors.length === 0) {
    console.log("OK");
    process.exit(0);
  }
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
export {
  verify
};
