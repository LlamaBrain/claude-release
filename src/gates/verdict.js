// Release-gate verdict shape + aggregate composition.
//
// Canonical contract: the Captain SDLC nerve-center doc
// `seam-release-gates.md` ("Gate verdict" and "Composition rules"). This module
// is pure — no IO — so it is unit-testable without git, npm, or the filesystem,
// mirroring how `classify-api-diff.js` is split out from the IO-bound tools.

export const GATE_SCHEMA_VERSION = 1;

const VERDICTS = new Set(['pass', 'fail', 'warn', 'not_applicable', 'error']);
const SEVERITIES = new Set(['block', 'warn', 'log']);

// Build one gate's verdict in the standard shape. Throws on an unknown
// verdict/severity so a miswritten gate fails loudly rather than silently
// emitting an unrecognized record.
export function makeVerdict({
  gate,
  verdict,
  severity = 'block',
  required = true,
  reason = '',
  inputs = [],
  evaluatedAt,
}) {
  if (!gate || typeof gate !== 'string') throw new Error('makeVerdict: gate name is required');
  if (!VERDICTS.has(verdict)) throw new Error(`makeVerdict: unknown verdict "${verdict}"`);
  if (!SEVERITIES.has(severity)) throw new Error(`makeVerdict: unknown severity "${severity}"`);
  return {
    schema_version: GATE_SCHEMA_VERSION,
    gate,
    verdict,
    severity,
    required: Boolean(required),
    reason: String(reason ?? ''),
    inputs: Array.isArray(inputs) ? inputs : [],
    evaluated_at: evaluatedAt,
  };
}

// Resolve a verdict's *effective* outcome by applying the not_applicable rule
// (seam-release-gates.md, "Gate verdict"): a required gate that can't apply is
// an error (catches a broken NA — missing input / misconfig); an optional gate
// that can't apply passes. Every other verdict passes through unchanged.
export function effectiveVerdict(v) {
  if (v.verdict === 'not_applicable') return v.required ? 'error' : 'pass';
  return v.verdict;
}

// Compose per-gate verdicts into one aggregate, returned in the same standard
// shape (seam-release-gates.md, "Composition rules"):
//   - any block-severity fail/error      → overall fail
//   - any warn-severity fail/error, or a gate that returned a `warn` verdict
//                                         → overall warn
//   - log severity is informational and never affects the aggregate
//   - pass / resolved-NA contribute nothing
// No weighted scoring, no AND/OR operators — humans read the list and judge.
export function composeAggregate(verdicts, { gate = 'release_gates', evaluatedAt } = {}) {
  let hardFail = false;
  let softWarn = false;
  const failing = [];
  const warning = [];

  for (const v of verdicts) {
    if (v.severity === 'log') continue;
    const eff = effectiveVerdict(v);
    const bad = eff === 'fail' || eff === 'error';
    if (bad && v.severity === 'block') {
      hardFail = true;
      failing.push(v.gate);
    } else if (bad && v.severity === 'warn') {
      softWarn = true;
      warning.push(v.gate);
    } else if (eff === 'warn') {
      softWarn = true;
      warning.push(v.gate);
    }
  }

  const verdict = hardFail ? 'fail' : softWarn ? 'warn' : 'pass';
  const reason =
    verdict === 'fail'
      ? `blocking gate(s) failed: ${failing.join(', ')}`
      : verdict === 'warn'
        ? `non-blocking gate(s) flagged: ${warning.join(', ')}`
        : `all ${verdicts.length} gate(s) passed`;

  return {
    schema_version: GATE_SCHEMA_VERSION,
    gate,
    verdict,
    severity: 'block',
    required: true,
    reason,
    inputs: verdicts.map(v => v.gate),
    evaluated_at: evaluatedAt,
  };
}
