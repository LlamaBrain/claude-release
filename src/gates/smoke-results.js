// Gate: smoke_results_pass.
//
// Refuses the release when the ATH smoke against the target commit isn't green.
// Minimal-cut input mechanism (seam-release-gates.md, "How gates get their
// inputs" #2 + "Minimal first cut"): a direct read of the Captain SDLC trace
// the ATH emitter (M2) writes to <repoRoot>/.captain-sdlc/trace/YYYY-MM-DD.jsonl.
// The pure selection logic is split from the filesystem read so it can be
// unit-tested with synthetic events.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { makeVerdict } from './verdict.js';

const GATE = 'smoke_results_pass';

// Two short commit ids "match" if one is a prefix of the other — git short-SHA
// lengths can differ between the emitter and the release tool. Requires both
// present and at least 7 chars of overlap.
export function commitsMatch(a, b) {
  if (!a || !b) return false;
  const x = String(a);
  const y = String(b);
  const n = Math.min(x.length, y.length);
  if (n < 7) return false;
  return x.slice(0, n) === y.slice(0, n);
}

// Pure: from a list of trace events, pick the smoke result for `commit`.
// Returns { result: 'pass' | 'fail' | 'none', event }. When several smokes ran
// against the same commit, the latest by timestamp wins (re-run semantics).
export function selectSmokeResult(events, commit) {
  const matches = events
    .filter(e => e && e.kind === 'ath.smoke.completed' && commitsMatch(e.refs && e.refs.commit, commit))
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  if (matches.length === 0) return { result: 'none', event: null };
  const latest = matches[matches.length - 1];
  return { result: latest.payload && latest.payload.result === 'pass' ? 'pass' : 'fail', event: latest };
}

// Read every event from <repoRoot>/.captain-sdlc/trace/*.jsonl. Tolerates a
// partial trailing line (a crash mid-write) rather than throwing.
export function readTraceEvents(repoRoot) {
  const dir = path.join(repoRoot, '.captain-sdlc', 'trace');
  if (!existsSync(dir)) return { events: [], files: [] };
  const files = readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort();
  const events = [];
  for (const f of files) {
    const text = readFileSync(path.join(dir, f), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try {
        events.push(JSON.parse(t));
      } catch {
        /* tolerate a partial/corrupt line */
      }
    }
  }
  return { events, files: files.map(f => path.posix.join('.captain-sdlc', 'trace', f)) };
}

// Evaluate the gate. `deps.readTraceEvents` lets tests inject events. A missing
// smoke for the target commit is an `error` (treated as fail under
// required:true) — you should not ship a commit whose smokes can't be confirmed.
export function evaluateSmokeResults({ repoRoot, commit, config = {}, evaluatedAt, deps = {} }) {
  const severity = config.severity || 'block';
  const required = config.required != null ? config.required : true;
  const read = deps.readTraceEvents || readTraceEvents;
  const { events, files } = read(repoRoot);

  if (!commit) {
    return makeVerdict({
      gate: GATE,
      verdict: 'error',
      severity,
      required,
      reason: 'no target commit supplied to the smoke gate',
      inputs: files,
      evaluatedAt,
    });
  }

  const { result, event } = selectSmokeResult(events, commit);

  if (result === 'none') {
    return makeVerdict({
      gate: GATE,
      verdict: 'error',
      severity,
      required,
      reason: `no ath.smoke.completed event found for commit ${commit} in the trace`,
      inputs: files,
      evaluatedAt,
    });
  }

  if (result === 'pass') {
    const skill = (event.payload && event.payload.skill) || '';
    return makeVerdict({
      gate: GATE,
      verdict: 'pass',
      severity,
      required,
      reason: `smoke ${skill} passed for commit ${commit}`.replace('  ', ' ').trim(),
      inputs: [event.event_id],
      evaluatedAt,
    });
  }

  const failedStep = event.payload && event.payload.failed_step;
  const summary = (event.payload && event.payload.summary) || 'no summary';
  return makeVerdict({
    gate: GATE,
    verdict: 'fail',
    severity,
    required,
    reason: `smoke failed for commit ${commit}${failedStep ? ` at ${failedStep}` : ''}: ${summary}`,
    inputs: [event.event_id],
    evaluatedAt,
  });
}
