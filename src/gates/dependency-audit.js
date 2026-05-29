// Gate: dependency_audit.
//
// The thin inline CVE check for the minimal cut (seam-release-gates.md, "Gate
// inputs" #4 + "Minimal first cut"): fail the release on any blocking advisory.
// M6_DEPENDENCY_AUDIT later generalizes this to license / staleness and other
// ecosystems. For now it runs `npm audit --json` and blocks on high/critical;
// projects with no package.json (e.g. Unity consumers) are not_applicable.
// The classification is pure and unit-tested; the npm invocation is injectable.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { makeVerdict } from './verdict.js';

const GATE = 'dependency_audit';
const BLOCKING_LEVELS = ['critical', 'high'];

// Pure: count blocking advisories in `npm audit --json` output (npm v7+ shape:
// metadata.vulnerabilities.{info,low,moderate,high,critical}). Tolerant of a
// missing metadata block.
export function classifyAudit(auditJson, { blocking = BLOCKING_LEVELS } = {}) {
  const vulns = (auditJson && auditJson.metadata && auditJson.metadata.vulnerabilities) || {};
  const counts = {};
  let blockingTotal = 0;
  for (const level of blocking) {
    const n = Number(vulns[level] || 0);
    counts[level] = n;
    blockingTotal += n;
  }
  return { blockingTotal, counts };
}

// `npm audit` exits non-zero when advisories exist but still prints the JSON
// report to stdout; recover stdout from the thrown error in that case. On
// Windows `npm` resolves to npm.cmd, and recent Node refuses to spawn a .cmd
// through execFileSync without a shell — so route through the shell there. The
// argv is fixed and carries no user input, so shell interpolation is not a risk.
function defaultRunAudit(repoRoot) {
  let out;
  try {
    out = execFileSync('npm', ['audit', '--json'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });
  } catch (err) {
    out = err.stdout;
    if (!out) throw err;
  }
  return JSON.parse(out);
}

// Evaluate the gate. `deps.hasPackageJson` / `deps.runAudit` are injectable for
// tests.
export function evaluateDependencyAudit({ repoRoot, config = {}, evaluatedAt, deps = {} }) {
  const severity = config.severity || 'block';
  const required = config.required != null ? config.required : true;

  const hasPkg =
    deps.hasPackageJson != null ? deps.hasPackageJson : existsSync(path.join(repoRoot, 'package.json'));

  if (!hasPkg) {
    return makeVerdict({
      gate: GATE,
      verdict: 'not_applicable',
      severity,
      required,
      reason: 'no package.json at the project root — no npm dependency surface to audit (M6 generalizes this)',
      inputs: [],
      evaluatedAt,
    });
  }

  let auditJson;
  try {
    const run = deps.runAudit || defaultRunAudit;
    auditJson = run(repoRoot);
  } catch (err) {
    return makeVerdict({
      gate: GATE,
      verdict: 'error',
      severity,
      required,
      reason: `npm audit could not be evaluated: ${err.message}`,
      inputs: ['npm audit --json'],
      evaluatedAt,
    });
  }

  const { blockingTotal, counts } = classifyAudit(auditJson);
  if (blockingTotal > 0) {
    return makeVerdict({
      gate: GATE,
      verdict: 'fail',
      severity,
      required,
      reason: `dependency audit found ${blockingTotal} blocking advisory(ies): ${counts.critical || 0} critical, ${counts.high || 0} high`,
      inputs: ['npm audit --json'],
      evaluatedAt,
    });
  }

  return makeVerdict({
    gate: GATE,
    verdict: 'pass',
    severity,
    required,
    reason: 'no high or critical advisories',
    inputs: ['npm audit --json'],
    evaluatedAt,
  });
}
