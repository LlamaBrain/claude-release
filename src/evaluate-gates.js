#!/usr/bin/env node
// Release-gate evaluator (M5_RELEASE_GATES_MINIMAL).
//
// Composes the per-gate verdicts into a release decision and emits it as JSON,
// so /release can refuse an inconsistent ship. Canonical contract:
// seam-release-gates.md ("Where gate evaluation runs", "Override", "Composition
// rules"). Mirrors the repo's other lib tools: pure cores split out for tests,
// execFileSync for git, JSON to stdout, exit codes 0/1/2.
//
//   exit 0 — release may proceed (all gates pass, or every blocking failure was
//            explicitly overridden with a recorded reason)
//   exit 1 — release blocked (an un-overridden blocking gate failed)
//   exit 2 — usage / config error (bad override, malformed config)
//
// Trace emission (release.gate.summary / release.gate.override) is a deliberate
// fast-follow now that M2 has shipped the substrate — not part of this cut.

import { execFileSync } from 'node:child_process';
import { effectiveVerdict, composeAggregate } from './gates/verdict.js';
import { loadGateConfig, GATE_DEFAULTS } from './gates/config.js';
import { evaluateSmokeResults } from './gates/smoke-results.js';
import { evaluateDependencyAudit } from './gates/dependency-audit.js';

// The known gate set for the minimal cut. `defaults` layer over GATE_DEFAULTS
// and under the project's release-gates.yaml. dependency_audit is required:false
// so a project with no npm surface (e.g. Unity) resolves not_applicable → pass
// rather than NA → error → block (seam-release-gates.md, "Gate verdict").
const REGISTRY = {
  smoke_results_pass: {
    defaults: {},
    run: ({ repoRoot, commit, config, evaluatedAt, deps }) =>
      evaluateSmokeResults({ repoRoot, commit, config, evaluatedAt, deps: deps.smoke }),
  },
  dependency_audit: {
    defaults: { required: false },
    run: ({ repoRoot, config, evaluatedAt, deps }) =>
      evaluateDependencyAudit({ repoRoot, config, evaluatedAt, deps: deps.audit }),
  },
};

// Split a `--override` token into { gate, reason } on the FIRST colon, so a
// reason may itself contain colons ("known flake: scene-load timeout").
export function parseOverrideToken(token) {
  const idx = token.indexOf(':');
  if (idx === -1) return { gate: token.trim(), reason: '' };
  return { gate: token.slice(0, idx).trim(), reason: token.slice(idx + 1).trim() };
}

// Run the enabled gates and return their verdicts. `deps.smoke` / `deps.audit`
// pass through to the gates for test injection.
export function runGates({ repoRoot, commit, config, evaluatedAt, deps = {} }) {
  const verdicts = [];
  for (const [name, entry] of Object.entries(REGISTRY)) {
    const resolved = { ...GATE_DEFAULTS, ...entry.defaults, ...((config.gates && config.gates[name]) || {}) };
    if (resolved.enabled === false) continue;
    verdicts.push(entry.run({ repoRoot, commit, config: resolved, evaluatedAt, deps }));
  }
  return verdicts;
}

// Pure: turn per-gate verdicts + overrides into a release decision.
// Validation errors (returned in `errors`) are hard usage errors. A block-gate
// override that wasn't needed (the gate passed) is reported in
// `unnecessaryOverrides` but does NOT block the release.
export function resolveDecision(verdicts, overrides = []) {
  const byGate = new Map(verdicts.map(v => [v.gate, v]));
  const errors = [];

  for (const o of overrides) {
    if (!o.reason || !o.reason.trim()) {
      errors.push(`override of "${o.gate}" requires a non-empty reason`);
    }
    const v = byGate.get(o.gate);
    if (!v) {
      errors.push(`cannot override "${o.gate}" — not an evaluated gate`);
    } else if (v.severity !== 'block') {
      errors.push(`cannot override "${o.gate}" — it is severity "${v.severity}", not blocking; overriding it is meaningless`);
    }
  }
  if (errors.length > 0) return { errors };

  const overridden = new Set(overrides.map(o => o.gate));
  const blockers = verdicts
    .filter(v => v.severity === 'block' && (effectiveVerdict(v) === 'fail' || effectiveVerdict(v) === 'error'))
    .map(v => v.gate);

  const overriddenBlockers = blockers.filter(g => overridden.has(g));
  const unresolvedBlockers = blockers.filter(g => !overridden.has(g));
  const unnecessaryOverrides = [...overridden].filter(g => !blockers.includes(g));
  const decision = unresolvedBlockers.length === 0 ? 'proceed' : 'blocked';

  return { errors: [], blockers, overriddenBlockers, unresolvedBlockers, unnecessaryOverrides, decision };
}

// ---------------------------------------------------------------------------
// CLI

function usage(msg) {
  process.stderr.write(`error: ${msg}\n`);
  process.exit(2);
}

function parseCliOptions(argv) {
  const out = { forceRelease: false, overrides: [], commit: null, repoRoot: process.cwd() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force-release') {
      out.forceRelease = true;
    } else if (a === '--override') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) usage('--override requires <gate>:"<reason>"');
      out.overrides.push(parseOverrideToken(next));
      i++;
    } else if (a === '--commit') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) usage('--commit requires a value');
      out.commit = next;
      i++;
    } else if (a === '--repo-root') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) usage('--repo-root requires a path');
      out.repoRoot = next;
      i++;
    }
    // Unknown flags are ignored (mirrors compute-bump.js), so /release can
    // forward a shared flag set without this tool choking on its siblings.
  }
  return out;
}

function resolveTargetCommit(repoRoot) {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function main() {
  const cli = parseCliOptions(process.argv.slice(2));
  if (cli.overrides.length > 0 && !cli.forceRelease) {
    usage('--override requires --force-release (there is no force-everything flag; override per gate)');
  }

  const repoRoot = cli.repoRoot;
  const commit = cli.commit || resolveTargetCommit(repoRoot);
  const config = loadGateConfig(repoRoot);
  const evaluatedAt = new Date().toISOString();

  const verdicts = runGates({ repoRoot, commit, config, evaluatedAt });
  const resolution = resolveDecision(verdicts, cli.overrides);

  if (resolution.errors.length > 0) {
    for (const e of resolution.errors) process.stderr.write(`error: ${e}\n`);
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
    evaluated_at: evaluatedAt,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(resolution.decision === 'proceed' ? 0 : 1);
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('evaluate-gates.js');
if (isMain) main();
