import assert from 'node:assert/strict';
import { classifyApiEvidence } from '../src/release-classification.js';

const empty = { added: [], removed: [], changed: [] };
const removed = { ...empty, removed: [{ kind: 'method', fqn: 'Game.Player.Jump()', signature: 'public void Jump()' }] };
const added = { ...empty, added: [{ kind: 'method', fqn: 'Game.Player.Run()', signature: 'public void Run()' }] };
for (const commitKind of ['none', 'patch', 'minor', 'major']) {
  assert.equal(classifyApiEvidence(commitKind, removed).bumpKind, 'major', `removal must override ${commitKind}`);
}
assert.equal(classifyApiEvidence('patch', added).bumpKind, 'minor');
assert.equal(classifyApiEvidence('major', added).bumpKind, 'major');
assert.equal(classifyApiEvidence('patch', empty).bumpKind, 'patch');
assert.equal(classifyApiEvidence('patch', null).status, 'unavailable');
assert.equal(classifyApiEvidence('patch', empty).status, 'analyzed');
assert.equal(classifyApiEvidence('graduate', removed).bumpKind, 'graduate');
assert.equal(classifyApiEvidence('graduate', removed).requiresBaseline, true);
const oldMethod = {kind:'method', fqn:'Game.Player.Foo(int)', signature:'public void Foo(int x)'};
const optional = {kind:'method', fqn:'Game.Player.Foo(int,bool)', signature:'public void Foo(int x, bool y = false)'};
const required = {...optional, signature:'public void Foo(int x, bool y)'};
assert.equal(classifyApiEvidence('patch', {added:[optional],removed:[oldMethod],changed:[]}, 'source').bumpKind, 'minor');
assert.equal(classifyApiEvidence('patch', {added:[optional],removed:[oldMethod],changed:[]}, 'binary').bumpKind, 'major');
assert.equal(classifyApiEvidence('patch', {added:[required],removed:[oldMethod],changed:[]}, 'source').bumpKind, 'major');
console.log('API evidence classification passed');
