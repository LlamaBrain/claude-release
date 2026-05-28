#!/usr/bin/env node
// Scripted smoke test for the bundled ApiDiff dotnet tool.
// Synthesises before/after fixture trees, runs the tool, and asserts expected entries appear
// in the right buckets in a stable order. No git, no network, no plugin manifest involvement —
// this only tests the Roslyn-backed extractor.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_LIB = resolve(dirname(fileURLToPath(import.meta.url)));
const APIDIFF_PROJECT = join(PLUGIN_LIB, 'dotnet', 'ApiDiff');
const APIDIFF_DLL = join(APIDIFF_PROJECT, 'bin', 'Release', 'net8.0', 'ApiDiff.dll');

const fixtures = {
  before: {
    'Player.cs': `
namespace Game {
  public class Player {
    public void Move(Vector2 dir) {}
    public float maxSpeed;
    public int Health { get; set; }
  }
  public struct Vector2 { public float x; public float y; }
}
`,
    'Container.cs': `
namespace Game {
  public partial class Container {
    public int CountA() => 0;
  }
}
`,
    'ContainerExtra.cs': `
namespace Game {
  public partial class Container {
    public int CountB() => 0;
  }
}
`,
  },
  after: {
    'Player.cs': `
using UnityEngine;
namespace Game {
  public class Player {
    public void Move(Vector2 dir, bool jump) {}   // signature changed
    public void Crouch() {}                        // added
    // maxSpeed removed
    public int Health { get; set; }
    [SerializeField] private float stamina;        // added (SerializeField on private)
    public class Inner {                           // added nested public type
      public void Pulse() {}
    }
  }
  public struct Vector2 { public float x; public float y; }
}
`,
    'Container.cs': `
namespace Game {
  public partial class Container {
    public int CountA() => 0;
  }
}
`,
    'ContainerExtra.cs': `
namespace Game {
  public partial class Container {
    public int CountB() => 0;
    public int CountC() => 0;                       // added in second partial
  }
}
`,
  },
};

const expected = {
  added: [
    { kind: 'field', fqn: 'Game.Player.stamina' },
    { kind: 'method', fqn: 'Game.Container.CountC()' },
    { kind: 'method', fqn: 'Game.Player.Crouch()' },
    { kind: 'method', fqn: 'Game.Player.Inner.Pulse()' },
    { kind: 'method', fqn: 'Game.Player.Move(Vector2,bool)' },
    { kind: 'type', fqn: 'Game.Player.Inner' },
  ],
  removed: [
    { kind: 'field', fqn: 'Game.Player.maxSpeed' },
    { kind: 'method', fqn: 'Game.Player.Move(Vector2)' },
  ],
  changed: [],
};

function writeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function ensureBuilt() {
  if (existsSync(APIDIFF_DLL)) return;
  process.stderr.write('building ApiDiff (first run)…\n');
  execFileSync(
    'dotnet',
    ['build', APIDIFF_PROJECT, '-c', 'Release', '--verbosity', 'quiet', '--nologo'],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
}

function runApiDiff(prevDir, currDir) {
  ensureBuilt();
  const stdout = execFileSync(
    'dotnet',
    [APIDIFF_DLL, prevDir, currDir],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

function assertSubset(label, actual, expected) {
  const missing = [];
  for (const e of expected) {
    const hit = actual.find(a => a.kind === e.kind && a.fqn === e.fqn);
    if (!hit) missing.push(`${e.kind} ${e.fqn}`);
  }
  if (missing.length > 0) {
    throw new Error(`${label}: missing entries:\n  ${missing.join('\n  ')}\nactual:\n  ${actual.map(a => `${a.kind} ${a.fqn}`).join('\n  ')}`);
  }
}

function assertOrdered(label, actual) {
  for (let i = 1; i < actual.length; i++) {
    const a = actual[i - 1];
    const b = actual[i];
    const cmpKind = a.kind.localeCompare(b.kind);
    if (cmpKind > 0) throw new Error(`${label}: ordering broken at index ${i} — '${a.kind}' before '${b.kind}'`);
    if (cmpKind === 0 && a.fqn.localeCompare(b.fqn) > 0) {
      throw new Error(`${label}: ordering broken at index ${i} (same kind) — '${a.fqn}' before '${b.fqn}'`);
    }
  }
}

function main() {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'claude-release-apidiff-smoke-'));
  try {
    const beforeDir = join(tmpRoot, 'before');
    const afterDir = join(tmpRoot, 'after');
    mkdirSync(beforeDir, { recursive: true });
    mkdirSync(afterDir, { recursive: true });
    writeTree(beforeDir, fixtures.before);
    writeTree(afterDir, fixtures.after);

    const diff = runApiDiff(beforeDir, afterDir);

    assertSubset('added', diff.added, expected.added);
    assertSubset('removed', diff.removed, expected.removed);
    assertOrdered('added', diff.added);
    assertOrdered('removed', diff.removed);
    assertOrdered('changed', diff.changed);

    // Sanity: partial-type members should land under the same type FQN, not duplicate.
    const containerCounts = diff.added.filter(a => a.fqn.startsWith('Game.Container.'));
    if (!containerCounts.some(a => a.fqn === 'Game.Container.CountC()')) {
      throw new Error('partial-type smoke: expected Game.Container.CountC() in added');
    }

    process.stdout.write('OK — api-diff smoke test passed\n');
    process.stdout.write(`  added:   ${diff.added.length}\n`);
    process.stdout.write(`  removed: ${diff.removed.length}\n`);
    process.stdout.write(`  changed: ${diff.changed.length}\n`);
  } finally {
    try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

try {
  main();
} catch (err) {
  process.stderr.write(`FAIL: ${err.message}\n`);
  process.exit(1);
}
