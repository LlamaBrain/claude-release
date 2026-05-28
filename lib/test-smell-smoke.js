#!/usr/bin/env node
// Smoke test for lib/smell.js. Spins up an isolated temp git repo per scenario, stages a known
// diff + message, runs the checks with tryApiDiff mocked, and asserts which check ids fire.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)));

// Import after we may need to chdir; library calls git in CWD.
const { runSmellChecks, getStagedInputs } = await import('./smell.js');

function git(repo, ...args) {
  return execFileSync('git', args, {
    cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_AUTHOR_NAME: 'Smoke', GIT_AUTHOR_EMAIL: 'smoke@test',
           GIT_COMMITTER_NAME: 'Smoke', GIT_COMMITTER_EMAIL: 'smoke@test' },
  });
}

function initRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'claude-release-smell-smoke-'));
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'smoke@test');
  git(repo, 'config', 'user.name', 'Smoke');
  git(repo, 'config', 'commit.gpgsign', 'false');
  // Seed file + initial commit + tag, so prevRef exists.
  writeFileSync(join(repo, 'seed.txt'), 'seed\n');
  git(repo, 'add', 'seed.txt');
  git(repo, 'commit', '-q', '-m', 'chore: seed');
  git(repo, 'tag', 'v0.0.1');
  return repo;
}

async function withRepo(scenarioFn) {
  const repo = initRepo();
  const prevCwd = process.cwd();
  try {
    process.chdir(repo);
    return await scenarioFn(repo);
  } finally {
    process.chdir(prevCwd);
    try { rmSync(repo, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function fakeApiDiff(added = [], removed = [], changed = []) {
  return async () => ({ added, removed, changed });
}

function checkIds(result) {
  return result.warnings.map(w => w.check).sort();
}

function assertEq(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${label}\n  expected: ${e}\n  actual:   ${a}`);
}

function assertContains(label, actual, expected) {
  for (const id of expected) {
    if (!actual.includes(id)) {
      throw new Error(`${label}\n  expected to contain: ${id}\n  actual: ${JSON.stringify(actual)}`);
    }
  }
}

function assertNotContains(label, actual, forbidden) {
  for (const id of forbidden) {
    if (actual.includes(id)) {
      throw new Error(`${label}\n  expected NOT to contain: ${id}\n  actual: ${JSON.stringify(actual)}`);
    }
  }
}

// ---- Scenarios ----

async function scenarioClean() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'one line\n');
    git(repo, 'add', 'a.txt');
    const message = 'feat(foo): add the a file\n\nThis adds a single-line file as a smoke fixture for the test harness.\n';
    const inputs = getStagedInputs();
    const result = await runSmellChecks({ message, inputs, runApiDiff: fakeApiDiff() });
    assertEq('scenarioClean: no warnings', checkIds(result), []);
  });
}

async function scenarioConventionalMalformed() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'one\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'just some change',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertContains('scenarioConventionalMalformed', checkIds(result), ['conventional-malformed']);
  });
}

async function scenarioThinSubject() {
  await withRepo(async (repo) => {
    // Create 8 files (above the 5-file threshold), no body in message.
    for (let i = 0; i < 8; i++) {
      writeFileSync(join(repo, `f${i}.txt`), `line ${i}\n`);
      git(repo, 'add', `f${i}.txt`);
    }
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore: bulk add',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertContains('scenarioThinSubject', checkIds(result), ['thin-subject-on-substantive-diff']);
  });
}

async function scenarioBreakingMarkerNoDescription() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'feat!: drop foo',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertContains('scenarioBreakingMarkerNoDescription', checkIds(result), ['breaking-marker-no-description']);
  });
}

async function scenarioBreakingMarkerWithDescriptionClean() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const message = 'feat!: drop foo\n\nBREAKING CHANGE: Foo.bar(int) has been removed; migrate to Foo.baz(int, bool).\n';
    const result = await runSmellChecks({ message, inputs, runApiDiff: fakeApiDiff() });
    const ids = checkIds(result);
    assertNotContains('scenarioBreakingMarkerWithDescriptionClean', ids, ['breaking-marker-no-description']);
  });
}

async function scenarioApiBreakNoMarker() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    // Fake api-diff reports a removal; message has no breaking marker.
    const result = await runSmellChecks({
      message: 'refactor: clean up Player',
      inputs,
      runApiDiff: fakeApiDiff([], [{ kind: 'method', fqn: 'Game.Player.Jump()', signature: 'public void Jump()' }], []),
    });
    assertContains('scenarioApiBreakNoMarker', checkIds(result), ['api-break-no-marker']);
  });
}

async function scenarioApiBreakWithMarkerClean() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'refactor!: drop Jump\n\nBREAKING CHANGE: Game.Player.Jump() removed; use JumpWithPower(float) instead.\n',
      inputs,
      runApiDiff: fakeApiDiff([], [{ kind: 'method', fqn: 'Game.Player.Jump()', signature: 'public void Jump()' }], []),
    });
    assertNotContains('scenarioApiBreakWithMarkerClean', checkIds(result), ['api-break-no-marker']);
  });
}

async function scenarioChangelogMissesBreaking() {
  await withRepo(async (repo) => {
    // Stage a CHANGELOG.md that doesn't mention the api break.
    writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [v0.0.2] - 2026-01-01\n\n### Added\n\n- Unrelated bullet (v0.0.2)\n');
    git(repo, 'add', 'CHANGELOG.md');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore(release): v0.0.2',
      inputs,
      runApiDiff: fakeApiDiff([], [{ kind: 'method', fqn: 'Game.Player.Jump()', signature: 'public void Jump()' }], []),
      manifest: { commits: [], api_diff: { added: [], removed: [{ fqn: 'Game.Player.Jump()' }], changed: [] } },
    });
    assertContains('scenarioChangelogMissesBreaking', checkIds(result), ['changelog-misses-breaking-change']);
  });
}

async function scenarioChangelogSurfacesBreakingClean() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [v0.0.2] - 2026-01-01\n\n### Removed\n\n- Game.Player.Jump() removed; use JumpWithPower (v0.0.2)\n');
    git(repo, 'add', 'CHANGELOG.md');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore(release): v0.0.2',
      inputs,
      runApiDiff: fakeApiDiff([], [{ kind: 'method', fqn: 'Game.Player.Jump()', signature: 'public void Jump()' }], []),
      manifest: { commits: [], api_diff: { added: [], removed: [{ fqn: 'Game.Player.Jump()' }], changed: [] } },
    });
    assertNotContains('scenarioChangelogSurfacesBreakingClean', checkIds(result), ['changelog-misses-breaking-change']);
  });
}

// ---- Main ----

const scenarios = [
  ['clean baseline', scenarioClean],
  ['conventional-malformed', scenarioConventionalMalformed],
  ['thin-subject-on-substantive-diff', scenarioThinSubject],
  ['breaking-marker-no-description', scenarioBreakingMarkerNoDescription],
  ['breaking marker + desc → clean', scenarioBreakingMarkerWithDescriptionClean],
  ['api-break-no-marker', scenarioApiBreakNoMarker],
  ['api break + marker → clean', scenarioApiBreakWithMarkerClean],
  ['changelog-misses-breaking-change', scenarioChangelogMissesBreaking],
  ['changelog surfaces breaking → clean', scenarioChangelogSurfacesBreakingClean],
];

let failed = 0;
for (const [name, fn] of scenarios) {
  try {
    await fn();
    process.stdout.write(`  ok   ${name}\n`);
  } catch (err) {
    failed++;
    process.stdout.write(`  FAIL ${name}\n`);
    process.stderr.write(`    ${err.message.replace(/\n/g, '\n    ')}\n`);
  }
}
if (failed > 0) {
  process.stderr.write(`\n${failed} scenario(s) failed.\n`);
  process.exit(1);
}
process.stdout.write(`\nOK — all ${scenarios.length} smell smoke scenarios passed.\n`);

// Suppress import lint warning
void HERE;
