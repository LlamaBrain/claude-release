#!/usr/bin/env node
// Smoke test for lib/classify-api-diff.js — the additive-pair reclassification logic
// that build-manifest.js uses to keep "add an optional defaulted parameter" out of the
// major-bump bucket. Pure unit-style: no git, no dotnet, no filesystem; we synthesise
// raw ApiDiff JSON shapes and assert the classifier's output.

import {
  classifyRemovedAddedPairs,
  isStrictAdditiveExtension,
  splitFqnAtOpenParen,
  splitParamTuple,
} from './classify-api-diff.js';

let failed = 0;
let passed = 0;

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

function method(fqn, signature = `(synthetic) ${fqn}`) {
  return { kind: 'method', fqn, signature };
}
function ctor(fqn, signature = `(synthetic) ${fqn}`) {
  return { kind: 'ctor', fqn, signature };
}
function field(fqn, signature = `public ${fqn}`) {
  return { kind: 'field', fqn, signature };
}

function run(label, apiDiff) {
  return { label, ...classifyRemovedAddedPairs(apiDiff) };
}

function fqns(entries) {
  return entries.map(e => e.fqn).sort();
}

function pairFqns(pairs) {
  return pairs.map(p => `${p.removedEntry.fqn} -> ${p.addedEntry.fqn}`).sort();
}

// -------------------------------------------------------------------
process.stdout.write('Section: splitParamTuple\n');

eq('empty inner', splitParamTuple(''), []);
eq('single bare', splitParamTuple('int'), ['int']);
eq('two bare', splitParamTuple('int,bool'), ['int', 'bool']);
eq('with ref modifier', splitParamTuple('ref int,out bool'), ['ref int', 'out bool']);
eq('generic with internal comma',
  splitParamTuple('List<int,string>,bool'),
  ['List<int,string>', 'bool']);
eq('nested generic',
  splitParamTuple('Dictionary<string,List<int>>,Vector2'),
  ['Dictionary<string,List<int>>', 'Vector2']);
eq('array rank with internal comma',
  splitParamTuple('int[,],bool'),
  ['int[,]', 'bool']);

// -------------------------------------------------------------------
process.stdout.write('Section: splitFqnAtOpenParen\n');

eq('method with one param',
  splitFqnAtOpenParen('Game.Player.Move(Vector2)'),
  { prefix: 'Game.Player.Move(', inner: 'Vector2' });
eq('method with no params',
  splitFqnAtOpenParen('Game.Player.Jump()'),
  { prefix: 'Game.Player.Jump(', inner: '' });
eq('ctor',
  splitFqnAtOpenParen('Game.Player.Player(int)'),
  { prefix: 'Game.Player.Player(', inner: 'int' });
eq('field returns null',
  splitFqnAtOpenParen('Game.Player.maxSpeed'),
  null);
eq('property returns null',
  splitFqnAtOpenParen('Game.Player.Health'),
  null);
eq('indexer returns null (ends with ])',
  splitFqnAtOpenParen('Game.Player.this[int]'),
  null);

// -------------------------------------------------------------------
process.stdout.write('Section: isStrictAdditiveExtension\n');

eq('added longer same prefix → true',
  isStrictAdditiveExtension(['int'], ['int', 'bool']),
  true);
eq('added two longer same prefix → true',
  isStrictAdditiveExtension(['int', 'string'], ['int', 'string', 'bool']),
  true);
eq('same length → false',
  isStrictAdditiveExtension(['int'], ['string']),
  false);
eq('shorter → false',
  isStrictAdditiveExtension(['int', 'bool'], ['int']),
  false);
eq('mismatched in middle → false',
  isStrictAdditiveExtension(['int', 'string'], ['int', 'bool', 'string']),
  false);
eq('empty removed, non-empty added → true',
  isStrictAdditiveExtension([], ['int']),
  true);
eq('empty both → false (not strict)',
  isStrictAdditiveExtension([], []),
  false);

// -------------------------------------------------------------------
process.stdout.write('Section: classifyRemovedAddedPairs — edge cases\n');

{
  // Removed only, no matching added → real removal.
  const r = run('removed-only',
    { added: [], removed: [method('Game.Player.Foo(int)')], changed: [] });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.Player.Foo(int)']);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), []);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs), []);
}

{
  // Same name, different param type → real break (no additive pair).
  const r = run('type-mismatch-at-pos0',
    {
      added: [method('Game.Player.Foo(string)')],
      removed: [method('Game.Player.Foo(int)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.Player.Foo(int)']);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), ['Game.Player.Foo(string)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs), []);
}

{
  // Classic single-param addition → additive pair.
  const r = run('add-one-param',
    {
      added: [method('Game.Player.Foo(int,bool)')],
      removed: [method('Game.Player.Foo(int)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), ['Game.Player.Foo(int,bool)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Player.Foo(int) -> Game.Player.Foo(int,bool)']);
}

{
  // Append-only on two-param method → additive pair.
  const r = run('add-param-on-two-param',
    {
      added: [method('Game.Player.Foo(int,string,bool)')],
      removed: [method('Game.Player.Foo(int,string)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), ['Game.Player.Foo(int,string,bool)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Player.Foo(int,string) -> Game.Player.Foo(int,string,bool)']);
}

{
  // Insertion in the middle (positional mismatch) → real break, not additive.
  const r = run('insert-middle-mismatch',
    {
      added: [method('Game.Player.Foo(int,bool,string)')],
      removed: [method('Game.Player.Foo(int,string)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.Player.Foo(int,string)']);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), ['Game.Player.Foo(int,bool,string)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs), []);
}

{
  // Zero-param → one-param: empty tuple is a valid prefix.
  const r = run('add-param-to-noargs',
    {
      added: [method('Game.Player.Jump(float)')],
      removed: [method('Game.Player.Jump()')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), ['Game.Player.Jump(float)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Player.Jump() -> Game.Player.Jump(float)']);
}

{
  // Generic-type param with embedded comma — splitter must keep it as one slot.
  const r = run('generic-param-with-comma',
    {
      added: [method('Game.Bag.Put(List<int,string>,bool)')],
      removed: [method('Game.Bag.Put(List<int,string>)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Bag.Put(List<int,string>) -> Game.Bag.Put(List<int,string>,bool)']);
}

{
  // Constructor follows the same shape — Type.TypeName(...).
  const r = run('ctor-additive',
    {
      added: [ctor('Game.Player.Player(int,bool)')],
      removed: [ctor('Game.Player.Player(int)')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Player.Player(int) -> Game.Player.Player(int,bool)']);
}

{
  // Field removal is unaffected — splitter returns null, so it stays in realRemoved.
  const r = run('field-removed-is-real',
    {
      added: [],
      removed: [field('Game.Player.maxSpeed')],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.Player.maxSpeed']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs), []);
}

{
  // Overload-soup: same prefix, multiple removed + added entries.
  // - Foo(int) -> Foo(int,bool) is additive
  // - Foo(string) has no match → stays real-removed
  // - Foo(double,bool) is fresh-added (no removed partner)
  const r = run('overload-soup',
    {
      added: [
        method('Game.X.Foo(int,bool)'),
        method('Game.X.Foo(double,bool)'),
      ],
      removed: [
        method('Game.X.Foo(int)'),
        method('Game.X.Foo(string)'),
      ],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.X.Foo(string)']);
  eq(`${r.label}: effectiveAdded sorted`, fqns(r.effectiveAdded),
    ['Game.X.Foo(double,bool)', 'Game.X.Foo(int,bool)']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.X.Foo(int) -> Game.X.Foo(int,bool)']);
}

{
  // Mixed real removal (field) + additive method pair.
  const r = run('mixed-real-and-additive',
    {
      added: [method('Game.Player.Move(Vector2,bool)')],
      removed: [
        field('Game.Player.maxSpeed'),
        method('Game.Player.Move(Vector2)'),
      ],
      changed: [],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), ['Game.Player.maxSpeed']);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs),
    ['Game.Player.Move(Vector2) -> Game.Player.Move(Vector2,bool)']);
}

{
  // changed bucket is never touched — verify.
  const r = run('changed-passthrough',
    {
      added: [],
      removed: [],
      changed: [{ kind: 'method', fqn: 'Game.X.Foo(int)', from: 'public void Foo(int x)', to: 'public int Foo(int x)' }],
    });
  eq(`${r.label}: realRemoved`, fqns(r.realRemoved), []);
  eq(`${r.label}: effectiveAdded`, fqns(r.effectiveAdded), []);
  eq(`${r.label}: additivePairs`, pairFqns(r.additivePairs), []);
}

// -------------------------------------------------------------------
process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
process.stdout.write('OK — classify-api-diff smoke test passed\n');
