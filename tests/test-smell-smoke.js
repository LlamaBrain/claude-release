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
const { runSmellChecks, getStagedInputs } = await import('../src/smell.js');

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
    // Scopeless message so the new scope-mismatch check doesn't fire on the baseline.
    const message = 'feat: add the a file\n\nThis adds a single-line file as a smoke fixture for the test harness.\n';
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

async function scenarioScopeMismatch() {
  await withRepo(async (repo) => {
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'feat(ui): a thing\n\nThis is a body that explains the why and what of the change.\n',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertContains('scenarioScopeMismatch', checkIds(result), ['scope-mismatch']);
  });
}

async function scenarioScopeMatchClean() {
  await withRepo(async (repo) => {
    // Path contains "ui" — scope "ui" matches.
    writeFileSync(join(repo, 'ui-panel.txt'), 'x\n');
    git(repo, 'add', 'ui-panel.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'feat(ui): a thing\n\nThis is a body that explains the why and what of the change.\n',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertNotContains('scenarioScopeMatchClean', checkIds(result), ['scope-mismatch']);
  });
}

async function scenarioUnrelatedAreaBundling() {
  await withRepo(async (repo) => {
    // 6 distinct top-level dirs > default threshold (5)
    for (const dir of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']) {
      mkdirSync(join(repo, dir), { recursive: true });
      writeFileSync(join(repo, dir, 'f.txt'), 'x\n');
      git(repo, 'add', `${dir}/f.txt`);
    }
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore: kitchen sink\n\nBundling unrelated changes across many top-level directories to trigger the check.\n',
      inputs,
      runApiDiff: fakeApiDiff(),
    });
    assertContains('scenarioUnrelatedAreaBundling', checkIds(result), ['unrelated-area-bundling']);
  });
}

async function scenarioBundlingWithChangelogSkipped() {
  await withRepo(async (repo) => {
    // 6 top-level dirs AND CHANGELOG.md → release pattern, bundling check should NOT fire.
    for (const dir of ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta']) {
      mkdirSync(join(repo, dir), { recursive: true });
      writeFileSync(join(repo, dir, 'f.txt'), 'x\n');
      git(repo, 'add', `${dir}/f.txt`);
    }
    writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [v0.0.2] - 2026-01-01\n\n### Added\n\n- A thing across many dirs (v0.0.2)\n');
    git(repo, 'add', 'CHANGELOG.md');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore(release): v0.0.2\n\nRelease body explaining the cross-cutting work.\n',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: { commits: [], api_diff: { added: [], removed: [], changed: [] } },
    });
    assertNotContains('scenarioBundlingWithChangelogSkipped', checkIds(result), ['unrelated-area-bundling']);
  });
}

async function scenarioReleaseApiBreakNotMarked() {
  await withRepo(async (repo) => {
    // Manifest reports a removed public API entry, but the only commit is a `fix:` with breaking=false.
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'fix: tidy up Player internals',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: {
        commits: [
          { type: 'fix', scope: null, subject: 'tidy up Player internals', body: '', breaking: false, hash: 'aaaaaaa' },
        ],
        api_diff: {
          added: [],
          removed: [{ kind: 'method', fqn: 'Foo.Bar(int)', signature: 'public void Bar(int)' }],
          changed: [],
        },
      },
    });
    assertContains('scenarioReleaseApiBreakNotMarked', checkIds(result), ['release-api-break-not-marked']);
  });
}

async function scenarioReleaseApiBreakWithMarkerClean() {
  await withRepo(async (repo) => {
    // Same api-diff entry as above, but a `feat!:` commit (breaking=true) covers it.
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'feat!: drop Foo.Bar(int)\n\nBREAKING CHANGE: Foo.Bar(int) removed; migrate to Foo.Baz(int, bool).\n',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: {
        commits: [
          { type: 'feat', scope: null, subject: 'drop Foo.Bar(int)', body: '', breaking: true, hash: 'bbbbbbb' },
        ],
        api_diff: {
          added: [],
          removed: [{ kind: 'method', fqn: 'Foo.Bar(int)', signature: 'public void Bar(int)' }],
          changed: [],
        },
      },
    });
    assertNotContains('scenarioReleaseApiBreakWithMarkerClean', checkIds(result), ['release-api-break-not-marked']);
  });
}

async function scenarioReleaseEmptyApiDiffClean() {
  await withRepo(async (repo) => {
    // Empty api-diff + `fix:` commit → nothing to flag.
    writeFileSync(join(repo, 'a.txt'), 'x\n');
    git(repo, 'add', 'a.txt');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'fix: small internal cleanup',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: {
        commits: [
          { type: 'fix', scope: null, subject: 'small internal cleanup', body: '', breaking: false, hash: 'ccccccc' },
        ],
        api_diff: { added: [], removed: [], changed: [] },
      },
    });
    assertNotContains('scenarioReleaseEmptyApiDiffClean', checkIds(result), ['release-api-break-not-marked']);
  });
}

async function scenarioChangelogClaimsUnbacked() {
  await withRepo(async (repo) => {
    // Bullet text uses keyword "quantum" that appears in NO commit subject/body and NO api-diff.
    writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [v0.0.2] - 2026-01-01\n\n### Added\n\n- Quantum hyperloop teleporter (v0.0.2)\n');
    git(repo, 'add', 'CHANGELOG.md');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore(release): v0.0.2',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: { commits: [{ hash: 'aaaaaaa', subject: 'add pause panel', body: '' }], api_diff: { added: [], removed: [], changed: [] } },
    });
    assertContains('scenarioChangelogClaimsUnbacked', checkIds(result), ['changelog-claims-unbacked']);
  });
}

async function scenarioChangelogClaimsBackedClean() {
  await withRepo(async (repo) => {
    // Bullet keywords appear in a commit subject.
    writeFileSync(join(repo, 'CHANGELOG.md'), '# Changelog\n\n## [v0.0.2] - 2026-01-01\n\n### Added\n\n- Pause panel for the UI (aaaaaaa)\n');
    git(repo, 'add', 'CHANGELOG.md');
    const inputs = getStagedInputs();
    const result = await runSmellChecks({
      message: 'chore(release): v0.0.2',
      inputs,
      runApiDiff: fakeApiDiff(),
      manifest: { commits: [{ hash: 'aaaaaaa', subject: 'add pause panel', body: '' }], api_diff: { added: [], removed: [], changed: [] } },
    });
    assertNotContains('scenarioChangelogClaimsBackedClean', checkIds(result), ['changelog-claims-unbacked']);
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
  ['scope-mismatch', scenarioScopeMismatch],
  ['scope match → clean', scenarioScopeMatchClean],
  ['unrelated-area-bundling', scenarioUnrelatedAreaBundling],
  ['bundling skipped on CHANGELOG release commit → clean', scenarioBundlingWithChangelogSkipped],
  ['release-api-break-not-marked', scenarioReleaseApiBreakNotMarked],
  ['release api break + marker → clean', scenarioReleaseApiBreakWithMarkerClean],
  ['release empty api-diff → clean', scenarioReleaseEmptyApiDiffClean],
  ['changelog-claims-unbacked', scenarioChangelogClaimsUnbacked],
  ['changelog claims backed → clean', scenarioChangelogClaimsBackedClean],
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
