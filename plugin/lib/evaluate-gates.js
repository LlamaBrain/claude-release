#!/usr/bin/env node
// claude-release bundled output — DO NOT EDIT. Source in src/.
import { createRequire as __cr } from 'node:module';
const require = __cr(import.meta.url);

// src/evaluate-gates.js
import { execFileSync as execFileSync2 } from "node:child_process";

// src/gates/verdict.js
var GATE_SCHEMA_VERSION = 1;
var VERDICTS = /* @__PURE__ */ new Set(["pass", "fail", "warn", "not_applicable", "error"]);
var SEVERITIES = /* @__PURE__ */ new Set(["block", "warn", "log"]);
function makeVerdict({
  gate,
  verdict,
  severity = "block",
  required = true,
  reason = "",
  inputs = [],
  evaluatedAt
}) {
  if (!gate || typeof gate !== "string") throw new Error("makeVerdict: gate name is required");
  if (!VERDICTS.has(verdict)) throw new Error(`makeVerdict: unknown verdict "${verdict}"`);
  if (!SEVERITIES.has(severity)) throw new Error(`makeVerdict: unknown severity "${severity}"`);
  return {
    schema_version: GATE_SCHEMA_VERSION,
    gate,
    verdict,
    severity,
    required: Boolean(required),
    reason: String(reason ?? ""),
    inputs: Array.isArray(inputs) ? inputs : [],
    evaluated_at: evaluatedAt
  };
}
function effectiveVerdict(v) {
  if (v.verdict === "not_applicable") return v.required ? "error" : "pass";
  return v.verdict;
}
function composeAggregate(verdicts, { gate = "release_gates", evaluatedAt } = {}) {
  let hardFail = false;
  let softWarn = false;
  const failing = [];
  const warning = [];
  for (const v of verdicts) {
    if (v.severity === "log") continue;
    const eff = effectiveVerdict(v);
    const bad = eff === "fail" || eff === "error";
    if (bad && v.severity === "block") {
      hardFail = true;
      failing.push(v.gate);
    } else if (bad && v.severity === "warn") {
      softWarn = true;
      warning.push(v.gate);
    } else if (eff === "warn") {
      softWarn = true;
      warning.push(v.gate);
    }
  }
  const verdict = hardFail ? "fail" : softWarn ? "warn" : "pass";
  const reason = verdict === "fail" ? `blocking gate(s) failed: ${failing.join(", ")}` : verdict === "warn" ? `non-blocking gate(s) flagged: ${warning.join(", ")}` : `all ${verdicts.length} gate(s) passed`;
  return {
    schema_version: GATE_SCHEMA_VERSION,
    gate,
    verdict,
    severity: "block",
    required: true,
    reason,
    inputs: verdicts.map((v) => v.gate),
    evaluated_at: evaluatedAt
  };
}

// src/gates/config.js
import { readFileSync } from "node:fs";
import path from "node:path";
var GATE_DEFAULTS = { enabled: true, severity: "block", required: true };
function stripComment(line) {
  let inS = false;
  let inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === "#" && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}
function parseScalar(raw) {
  const s = raw.trim();
  if (s.startsWith('"') && s.endsWith('"') || s.startsWith("'") && s.endsWith("'")) {
    return s.slice(1, -1);
  }
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~" || s === "") return null;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+$/.test(s)) return Number(s);
  return s;
}
function parseMiniYaml(text) {
  const root = {};
  let mapKey = null;
  let gateKey = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);
    if (line.trim() === "") continue;
    const indent = line.length - line.trimStart().length;
    const body = line.trim();
    const colon = body.indexOf(":");
    if (colon === -1) throw new Error(`release-gates.yaml: expected "key: value" near "${body}"`);
    const key = body.slice(0, colon).trim();
    const value = body.slice(colon + 1).trim();
    if (indent === 0) {
      gateKey = null;
      if (value === "") {
        root[key] = {};
        mapKey = key;
      } else {
        root[key] = parseScalar(value);
        mapKey = null;
      }
    } else if (indent === 2) {
      if (mapKey == null) throw new Error(`release-gates.yaml: unexpected indent near "${body}"`);
      if (value !== "") throw new Error(`release-gates.yaml: expected a nested map for "${key}"`);
      root[mapKey][key] = {};
      gateKey = key;
    } else {
      if (mapKey == null || gateKey == null) {
        throw new Error(`release-gates.yaml: unexpected indent near "${body}"`);
      }
      root[mapKey][gateKey][key] = parseScalar(value);
    }
  }
  return root;
}
function loadGateConfig(repoRoot, { fileText } = {}) {
  let text;
  if (fileText !== void 0) {
    text = fileText;
  } else {
    try {
      text = readFileSync(path.join(repoRoot, ".captain-sdlc", "release-gates.yaml"), "utf8");
    } catch {
      text = null;
    }
  }
  if (text == null) {
    return { schema_version: 1, gates: {}, source: "defaults (no release-gates.yaml)" };
  }
  const parsed = parseMiniYaml(text);
  const gates = {};
  for (const [name, cfg] of Object.entries(parsed.gates || {})) {
    gates[name] = { ...GATE_DEFAULTS, ...cfg };
  }
  return { schema_version: parsed.schema_version ?? 1, gates, source: "release-gates.yaml" };
}

// src/gates/smoke-results.js
import { readdirSync, readFileSync as readFileSync2, existsSync } from "node:fs";
import path2 from "node:path";
var GATE = "smoke_results_pass";
function commitsMatch(a, b) {
  if (!a || !b) return false;
  const x = String(a);
  const y = String(b);
  const n = Math.min(x.length, y.length);
  if (n < 7) return false;
  return x.slice(0, n) === y.slice(0, n);
}
function selectSmokeResult(events, commit) {
  const matches = events.filter((e) => e && e.kind === "ath.smoke.completed" && commitsMatch(e.refs && e.refs.commit, commit)).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (matches.length === 0) return { result: "none", event: null };
  const latest = matches[matches.length - 1];
  return { result: latest.payload && latest.payload.result === "pass" ? "pass" : "fail", event: latest };
}
function readTraceEvents(repoRoot) {
  const dir = path2.join(repoRoot, ".captain-sdlc", "trace");
  if (!existsSync(dir)) return { events: [], files: [] };
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  const events = [];
  for (const f of files) {
    const text = readFileSync2(path2.join(dir, f), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        events.push(JSON.parse(t));
      } catch {
      }
    }
  }
  return { events, files: files.map((f) => path2.posix.join(".captain-sdlc", "trace", f)) };
}
function evaluateSmokeResults({ repoRoot, commit, config = {}, evaluatedAt, deps = {} }) {
  const severity = config.severity || "block";
  const required = config.required != null ? config.required : true;
  const read = deps.readTraceEvents || readTraceEvents;
  const { events, files } = read(repoRoot);
  if (!commit) {
    return makeVerdict({
      gate: GATE,
      verdict: "error",
      severity,
      required,
      reason: "no target commit supplied to the smoke gate",
      inputs: files,
      evaluatedAt
    });
  }
  const { result, event } = selectSmokeResult(events, commit);
  if (result === "none") {
    return makeVerdict({
      gate: GATE,
      verdict: "error",
      severity,
      required,
      reason: `no ath.smoke.completed event found for commit ${commit} in the trace`,
      inputs: files,
      evaluatedAt
    });
  }
  if (result === "pass") {
    const skill = event.payload && event.payload.skill || "";
    return makeVerdict({
      gate: GATE,
      verdict: "pass",
      severity,
      required,
      reason: `smoke ${skill} passed for commit ${commit}`.replace("  ", " ").trim(),
      inputs: [event.event_id],
      evaluatedAt
    });
  }
  const failedStep = event.payload && event.payload.failed_step;
  const summary = event.payload && event.payload.summary || "no summary";
  return makeVerdict({
    gate: GATE,
    verdict: "fail",
    severity,
    required,
    reason: `smoke failed for commit ${commit}${failedStep ? ` at ${failedStep}` : ""}: ${summary}`,
    inputs: [event.event_id],
    evaluatedAt
  });
}

// src/gates/dependency-audit.js
import { execFileSync } from "node:child_process";
import { existsSync as existsSync2 } from "node:fs";
import path3 from "node:path";
var GATE2 = "dependency_audit";
var BLOCKING_LEVELS = ["critical", "high"];
function classifyAudit(auditJson, { blocking = BLOCKING_LEVELS } = {}) {
  const vulns = auditJson && auditJson.metadata && auditJson.metadata.vulnerabilities || {};
  const counts = {};
  let blockingTotal = 0;
  for (const level of blocking) {
    const n = Number(vulns[level] || 0);
    counts[level] = n;
    blockingTotal += n;
  }
  return { blockingTotal, counts };
}
var NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
function defaultRunAudit(repoRoot) {
  let out;
  try {
    out = execFileSync(NPM_BIN, ["audit", "--json"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (err) {
    out = err.stdout;
    if (!out) throw err;
  }
  return JSON.parse(out);
}
function evaluateDependencyAudit({ repoRoot, config = {}, evaluatedAt, deps = {} }) {
  const severity = config.severity || "block";
  const required = config.required != null ? config.required : true;
  const hasPkg = deps.hasPackageJson != null ? deps.hasPackageJson : existsSync2(path3.join(repoRoot, "package.json"));
  if (!hasPkg) {
    return makeVerdict({
      gate: GATE2,
      verdict: "not_applicable",
      severity,
      required,
      reason: "no package.json at the project root \u2014 no npm dependency surface to audit (M6 generalizes this)",
      inputs: [],
      evaluatedAt
    });
  }
  let auditJson;
  try {
    const run = deps.runAudit || defaultRunAudit;
    auditJson = run(repoRoot);
  } catch (err) {
    return makeVerdict({
      gate: GATE2,
      verdict: "error",
      severity,
      required,
      reason: `npm audit could not be evaluated: ${err.message}`,
      inputs: ["npm audit --json"],
      evaluatedAt
    });
  }
  const { blockingTotal, counts } = classifyAudit(auditJson);
  if (blockingTotal > 0) {
    return makeVerdict({
      gate: GATE2,
      verdict: "fail",
      severity,
      required,
      reason: `dependency audit found ${blockingTotal} blocking advisory(ies): ${counts.critical || 0} critical, ${counts.high || 0} high`,
      inputs: ["npm audit --json"],
      evaluatedAt
    });
  }
  return makeVerdict({
    gate: GATE2,
    verdict: "pass",
    severity,
    required,
    reason: "no high or critical advisories",
    inputs: ["npm audit --json"],
    evaluatedAt
  });
}

// src/evaluate-gates.js
var REGISTRY = {
  smoke_results_pass: {
    defaults: {},
    run: ({ repoRoot, commit, config, evaluatedAt, deps }) => evaluateSmokeResults({ repoRoot, commit, config, evaluatedAt, deps: deps.smoke })
  },
  dependency_audit: {
    defaults: { required: false },
    run: ({ repoRoot, config, evaluatedAt, deps }) => evaluateDependencyAudit({ repoRoot, config, evaluatedAt, deps: deps.audit })
  }
};
function parseOverrideToken(token) {
  const idx = token.indexOf(":");
  if (idx === -1) return { gate: token.trim(), reason: "" };
  return { gate: token.slice(0, idx).trim(), reason: token.slice(idx + 1).trim() };
}
function runGates({ repoRoot, commit, config, evaluatedAt, deps = {} }) {
  const verdicts = [];
  for (const [name, entry] of Object.entries(REGISTRY)) {
    const resolved = { ...GATE_DEFAULTS, ...entry.defaults, ...config.gates && config.gates[name] || {} };
    if (resolved.enabled === false) continue;
    verdicts.push(entry.run({ repoRoot, commit, config: resolved, evaluatedAt, deps }));
  }
  return verdicts;
}
function resolveDecision(verdicts, overrides = []) {
  const byGate = new Map(verdicts.map((v) => [v.gate, v]));
  const errors = [];
  for (const o of overrides) {
    if (!o.reason || !o.reason.trim()) {
      errors.push(`override of "${o.gate}" requires a non-empty reason`);
    }
    const v = byGate.get(o.gate);
    if (!v) {
      errors.push(`cannot override "${o.gate}" \u2014 not an evaluated gate`);
    } else if (v.severity !== "block") {
      errors.push(`cannot override "${o.gate}" \u2014 it is severity "${v.severity}", not blocking; overriding it is meaningless`);
    }
  }
  if (errors.length > 0) return { errors };
  const overridden = new Set(overrides.map((o) => o.gate));
  const blockers = verdicts.filter((v) => v.severity === "block" && (effectiveVerdict(v) === "fail" || effectiveVerdict(v) === "error")).map((v) => v.gate);
  const overriddenBlockers = blockers.filter((g) => overridden.has(g));
  const unresolvedBlockers = blockers.filter((g) => !overridden.has(g));
  const unnecessaryOverrides = [...overridden].filter((g) => !blockers.includes(g));
  const decision = unresolvedBlockers.length === 0 ? "proceed" : "blocked";
  return { errors: [], blockers, overriddenBlockers, unresolvedBlockers, unnecessaryOverrides, decision };
}
function usage(msg) {
  process.stderr.write(`error: ${msg}
`);
  process.exit(2);
}
function parseCliOptions(argv) {
  const out = { forceRelease: false, overrides: [], commit: null, repoRoot: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force-release") {
      out.forceRelease = true;
    } else if (a === "--override") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) usage('--override requires <gate>:"<reason>"');
      out.overrides.push(parseOverrideToken(next));
      i++;
    } else if (a === "--commit") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) usage("--commit requires a value");
      out.commit = next;
      i++;
    } else if (a === "--repo-root") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) usage("--repo-root requires a path");
      out.repoRoot = next;
      i++;
    }
  }
  return out;
}
function resolveTargetCommit(repoRoot) {
  try {
    return execFileSync2("git", ["rev-parse", "--short", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
  } catch {
    return null;
  }
}
function main() {
  const cli = parseCliOptions(process.argv.slice(2));
  if (cli.overrides.length > 0 && !cli.forceRelease) {
    usage("--override requires --force-release (there is no force-everything flag; override per gate)");
  }
  const repoRoot = cli.repoRoot;
  const commit = cli.commit || resolveTargetCommit(repoRoot);
  const config = loadGateConfig(repoRoot);
  const evaluatedAt = (/* @__PURE__ */ new Date()).toISOString();
  const verdicts = runGates({ repoRoot, commit, config, evaluatedAt });
  const resolution = resolveDecision(verdicts, cli.overrides);
  if (resolution.errors.length > 0) {
    for (const e of resolution.errors) process.stderr.write(`error: ${e}
`);
    process.exit(2);
  }
  const aggregate = composeAggregate(verdicts, { evaluatedAt });
  const output = {
    schema_version: 1,
    commit,
    config_source: config.source,
    decision: resolution.decision,
    aggregate,
    gates: verdicts,
    overrides: cli.overrides,
    overridden_blockers: resolution.overriddenBlockers,
    unresolved_blockers: resolution.unresolvedBlockers,
    unnecessary_overrides: resolution.unnecessaryOverrides,
    evaluated_at: evaluatedAt
  };
  console.log(JSON.stringify(output, null, 2));
  process.exit(resolution.decision === "proceed" ? 0 : 1);
}
var isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("evaluate-gates.js");
if (isMain) main();
export {
  parseOverrideToken,
  resolveDecision,
  runGates
};
