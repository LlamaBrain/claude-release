import assert from 'node:assert/strict';
import { expandSquashCommit } from '../src/squash-changes.js';
const payload = (commits) => Buffer.from(JSON.stringify({ schema_version: 1, commits })).toString('base64url');
const changes = [
  { oid: 'a'.repeat(40), message: 'feat(ui): add menu\n\nImplements: TASK-1' },
  { oid: 'b'.repeat(40), message: 'fix!: remove endpoint\n\nBREAKING CHANGE: Use the replacement endpoint.\n\nCaptain-Run: run-2' },
];
const header = 'chore: squash work\n\nImplements: TASK-1\nCaptain-Changes: ';
const expanded = expandSquashCommit({ full_hash: 'f'.repeat(40), raw: header + payload(changes) });
assert.equal(expanded.length, 3);
assert.equal(expanded[0].squash_summary, true);
assert.equal(expanded[1].type, 'feat');
assert.equal(expanded[2].breaking, true);
assert.match(expanded[2].raw, /Captain-Run: run-2/);
assert.throws(() => expandSquashCommit({ full_hash: 'f'.repeat(40), raw: header + 'garbage' }));
assert.throws(() => expandSquashCommit({ full_hash: 'f'.repeat(40), raw: header + payload([changes[0], changes[0]]) }));
assert.throws(() => expandSquashCommit({ full_hash: 'f'.repeat(40), raw: header + payload([{ oid: 'a'.repeat(40), message: 'invalid' }]) }));
const marked = expandSquashCommit({ full_hash: 'f'.repeat(40), raw: 'feat!: remove API\n\nBREAKING CHANGE: Use the new endpoint.\nCaptain-Changes: ' + payload([changes[0]]) });
assert.ok(marked.some(c => c.breaking));
assert.ok(expanded.filter(c => !c.squash_summary).every(c => c.squash_message.includes('Implements: TASK-1')));
assert.throws(() => expandSquashCommit({full_hash:'f'.repeat(40),raw:header + payload([{oid:'e'.repeat(40),message:'chore: nested\n\nCaptain-Changes: '+payload([changes[0]])}])}),/nested/i);
const tooMany=Array.from({length:513},(_,i)=>({oid:i.toString(16).padStart(40,'0'),message:'fix: test'}));
assert.throws(()=>expandSquashCommit({full_hash:'f'.repeat(40),raw:header+payload(tooMany)}),/limit/i);
assert.throws(()=>expandSquashCommit({full_hash:'f'.repeat(40),raw:header+payload([{oid:'a'.repeat(40),message:'fix: '+ 'x'.repeat(1048576)}])}),/limit/i);
assert.throws(()=>expandSquashCommit({full_hash:'f'.repeat(40),raw:header+payload([{oid:'a'.repeat(40),message:'fix: '+ 'x'.repeat(8192)}])}),/header.*limit/i);
console.log('durable squash payload passed');
