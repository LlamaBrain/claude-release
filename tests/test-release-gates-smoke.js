#!/usr/bin/env node
// Smoke test for the release-gate primitives (M5_RELEASE_GATES_MINIMAL, phase 1).
// Pure unit-style — no git, no npm, no real trace files: we synthesise verdict
// objects, trace events, npm-audit JSON, and YAML config text and assert the
// gate logic. The smoke-event fixtures mirror the exact envelope shape ATH's M2
// emitter wrote and that was validated against BeforeTheShade.
// Run from the repo root: node tests/test-release-gates-smoke.js

import { makeVerdict, effectiveVerdict, composeAggregate } from '../src/gates/verdict.js';
import { selectSmokeResult, commitsMatch, evaluateSmokeResults } from '../src/gates/smoke-results.js';
import { classifyAudit, evaluateDependencyAudit } from '../src/gates/dependency-audit.js';
import { loadGateConfig, gateConfig, GATE_DEFAULTS } from '../src/gates/config.js';
import { parseOverrideToken, resolveDecision } from '../src/evaluate-gates.js';

let passed = 0;
let failed = 0;
function eq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    process.stdout.write(`  OK   ${label}\n`);
  } else {
    failed++;
    process.stdout.write(`  FAIL ${label}\n        expected: ${e}\n          actual: ${a}\n`);
  }
}

const AT = '2026-05-29T00:00:00.000Z';
const v = (gate, verdict, severity = 'block', required = true) =>
  makeVerdict({ gate, verdict, severity, required, evaluatedAt: AT });

// -------------------------------------------------------------------
process.stdout.write('Section: composeAggregate\n');

eq('all pass -> pass', composeAggregate([v('a', 'pass'), v('b', 'pass')], { evaluatedAt: AT }).verdict, 'pass');
eq('block fail -> fail', composeAggregate([v('a', 'pass'), v('b', 'fail')], { evaluatedAt: AT }).verdict, 'fail');
eq('warn-severity fail -> warn', composeAggregate([v('a', 'fail', 'warn')], { evaluatedAt: AT }).verdict, 'warn');
eq('block error -> fail', composeAggregate([v('a', 'error')], { evaluatedAt: AT }).verdict, 'fail');
eq('log-severity fail -> pass (informational)', composeAggregate([v('a', 'fail', 'log')], { evaluatedAt: AT }).verdict, 'pass');
eq('returned warn verdict -> warn', composeAggregate([v('a', 'warn')], { evaluatedAt: AT }).verdict, 'warn');
eq('NA + required -> fail', composeAggregate([v('a', 'not_applicable', 'block', true)], { evaluatedAt: AT }).verdict, 'fail');
eq('NA + optional -> pass', composeAggregate([v('a', 'not_applicable', 'block', false)], { evaluatedAt: AT }).verdict, 'pass');
eq('aggregate is verdict-shaped',
  Object.keys(composeAggregate([v('a', 'pass')], { evaluatedAt: AT })).sort(),
  ['evaluated_at', 'gate', 'inputs', 'reason', 'required', 'schema_version', 'severity', 'verdict']);

// -------------------------------------------------------------------
process.stdout.write('Section: effectiveVerdict\n');

eq('NA required -> error', effectiveVerdict(v('a', 'not_applicable', 'block', true)), 'error');
eq('NA optional -> pass', effectiveVerdict(v('a', 'not_applicable', 'block', false)), 'pass');
eq('pass -> pass', effectiveVerdict(v('a', 'pass')), 'pass');

// -------------------------------------------------------------------
process.stdout.write('Section: commitsMatch\n');

eq('exact', commitsMatch('303588f', '303588f'), true);
eq('prefix differing length', commitsMatch('303588f', '303588fabc'), true);
eq('different', commitsMatch('303588f', 'deadbee'), false);
eq('null left', commitsMatch(null, '303588f'), false);
eq('too short', commitsMatch('3035', '3035'), false);

// -------------------------------------------------------------------
process.stdout.write('Section: selectSmokeResult\n');

const ev = (commit, result, ts, failed_step = null) => ({
  kind: 'ath.smoke.completed',
  event_id: `id-${ts}`,
  timestamp: ts,
  refs: { commit },
  payload: { skill: 'ath-smoke-fullloop', result, failed_step },
});

eq('pass for commit', selectSmokeResult([ev('303588f', 'pass', '2026-05-29T18:45:00Z')], '303588f').result, 'pass');
eq('fail for commit', selectSmokeResult([ev('303588f', 'fail', '2026-05-29T18:53:00Z', 'Step 5')], '303588f').result, 'fail');
eq('none for other commit', selectSmokeResult([ev('303588f', 'pass', 't1')], 'deadbee').result, 'none');
eq('picks latest by timestamp',
  selectSmokeResult(
    [ev('303588f', 'pass', '2026-05-29T10:00:00Z'), ev('303588f', 'fail', '2026-05-29T20:00:00Z', 'Step 5')],
    '303588f',
  ).result,
  'fail');
eq('ignores non-smoke kinds',
  selectSmokeResult(
    [{ kind: 'release.gate.summary', refs: { commit: '303588f' }, timestamp: 't', payload: { result: 'pass' } }],
    '303588f',
  ).result,
  'none');

// -------------------------------------------------------------------
process.stdout.write('Section: evaluateSmokeResults\n');

const smokeDeps = events => ({ readTraceEvents: () => ({ events, files: ['.captain-sdlc/trace/x.jsonl'] }) });

eq('gate pass', evaluateSmokeResults({ repoRoot: '.', commit: '303588f', evaluatedAt: AT, deps: smokeDeps([ev('303588f', 'pass', 't1')]) }).verdict, 'pass');
eq('gate fail', evaluateSmokeResults({ repoRoot: '.', commit: '303588f', evaluatedAt: AT, deps: smokeDeps([ev('303588f', 'fail', 't1', 'Step 5')]) }).verdict, 'fail');
eq('gate error when no event', evaluateSmokeResults({ repoRoot: '.', commit: '303588f', evaluatedAt: AT, deps: smokeDeps([]) }).verdict, 'error');
eq('gate error when no commit', evaluateSmokeResults({ repoRoot: '.', commit: null, evaluatedAt: AT, deps: smokeDeps([ev('303588f', 'pass', 't1')]) }).verdict, 'error');

// -------------------------------------------------------------------
process.stdout.write('Section: classifyAudit + dependency gate\n');

eq('high>0 blocks', classifyAudit({ metadata: { vulnerabilities: { critical: 0, high: 2, moderate: 5 } } }).blockingTotal, 2);
eq('clean', classifyAudit({ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 3 } } }).blockingTotal, 0);
eq('missing metadata tolerated', classifyAudit({}).blockingTotal, 0);
eq('gate NA without package.json',
  evaluateDependencyAudit({ repoRoot: '.', evaluatedAt: AT, deps: { hasPackageJson: false } }).verdict, 'not_applicable');
eq('gate fail on blocking CVE',
  evaluateDependencyAudit({ repoRoot: '.', evaluatedAt: AT, deps: { hasPackageJson: true, runAudit: () => ({ metadata: { vulnerabilities: { critical: 1, high: 0 } } }) } }).verdict, 'fail');
eq('gate pass on clean audit',
  evaluateDependencyAudit({ repoRoot: '.', evaluatedAt: AT, deps: { hasPackageJson: true, runAudit: () => ({ metadata: { vulnerabilities: { critical: 0, high: 0 } } }) } }).verdict, 'pass');
eq('gate error when audit throws',
  evaluateDependencyAudit({ repoRoot: '.', evaluatedAt: AT, deps: { hasPackageJson: true, runAudit: () => { throw new Error('offline'); } } }).verdict, 'error');

// -------------------------------------------------------------------
process.stdout.write('Section: loadGateConfig\n');

const yaml = `schema_version: 1
gates:
  smoke_results_pass:
    enabled: true
    severity: block
    required: true
    smoke_set: ath-smoke-fullloop
  dependency_audit:
    enabled: true
    severity: warn  # soft until we trust the audit output
    required: true
`;
const cfg = loadGateConfig('.', { fileText: yaml });
eq('parsed schema_version', cfg.schema_version, 1);
eq('smoke severity', cfg.gates.smoke_results_pass.severity, 'block');
eq('smoke_set string preserved', cfg.gates.smoke_results_pass.smoke_set, 'ath-smoke-fullloop');
eq('dependency severity override', cfg.gates.dependency_audit.severity, 'warn');
eq('inline comment stripped (required still bool)', cfg.gates.dependency_audit.required, true);
eq('absent file -> empty gates map', loadGateConfig('.', { fileText: null }).gates, {});
eq('gateConfig applies defaults for absent gate', gateConfig({ gates: {} }, 'whatever'), GATE_DEFAULTS);
eq('gateConfig merges partial override', gateConfig({ gates: { g: { severity: 'warn' } } }, 'g'), { enabled: true, severity: 'warn', required: true });

// -------------------------------------------------------------------
process.stdout.write('Section: parseOverrideToken\n');

eq('gate:reason', parseOverrideToken('smoke_results_pass:known flake'), { gate: 'smoke_results_pass', reason: 'known flake' });
eq('reason keeps later colons', parseOverrideToken('smoke_results_pass:flake: scene-load'), { gate: 'smoke_results_pass', reason: 'flake: scene-load' });
eq('no colon -> empty reason', parseOverrideToken('smoke_results_pass'), { gate: 'smoke_results_pass', reason: '' });

// -------------------------------------------------------------------
process.stdout.write('Section: resolveDecision\n');

const smokePass = v('smoke_results_pass', 'pass');
const smokeFail = v('smoke_results_pass', 'fail');
const auditPass = v('dependency_audit', 'pass');
const auditWarn = v('dependency_audit', 'pass', 'warn');

eq('all pass -> proceed', resolveDecision([smokePass, auditPass]).decision, 'proceed');
eq('block fail, no override -> blocked', resolveDecision([smokeFail, auditPass]).decision, 'blocked');
eq('block fail lists unresolved gate', resolveDecision([smokeFail, auditPass]).unresolvedBlockers, ['smoke_results_pass']);
eq('block fail, overridden -> proceed', resolveDecision([smokeFail, auditPass], [{ gate: 'smoke_results_pass', reason: 'manually verified' }]).decision, 'proceed');
eq('overridden blocker recorded', resolveDecision([smokeFail, auditPass], [{ gate: 'smoke_results_pass', reason: 'manually verified' }]).overriddenBlockers, ['smoke_results_pass']);

eq('empty reason -> error', resolveDecision([smokeFail], [{ gate: 'smoke_results_pass', reason: '' }]).errors.length > 0, true);
eq('unknown gate -> error', resolveDecision([smokeFail], [{ gate: 'nope', reason: 'x' }]).errors.length > 0, true);
eq('override of non-block gate -> error', resolveDecision([auditWarn], [{ gate: 'dependency_audit', reason: 'x' }]).errors.length > 0, true);

eq('unnecessary override (gate passed) -> still proceed', resolveDecision([smokePass, auditPass], [{ gate: 'smoke_results_pass', reason: 'belt and braces' }]).decision, 'proceed');
eq('unnecessary override is listed', resolveDecision([smokePass, auditPass], [{ gate: 'smoke_results_pass', reason: 'belt and braces' }]).unnecessaryOverrides, ['smoke_results_pass']);

const auditNAoptional = makeVerdict({ gate: 'dependency_audit', verdict: 'not_applicable', severity: 'block', required: false, evaluatedAt: AT });
const auditNArequired = makeVerdict({ gate: 'dependency_audit', verdict: 'not_applicable', severity: 'block', required: true, evaluatedAt: AT });
eq('NA optional is not a blocker -> proceed', resolveDecision([smokePass, auditNAoptional]).decision, 'proceed');
eq('NA required is a blocker -> blocked', resolveDecision([smokePass, auditNArequired]).decision, 'blocked');

// -------------------------------------------------------------------
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
process.stdout.write('OK — release-gate primitives smoke test passed\n');
