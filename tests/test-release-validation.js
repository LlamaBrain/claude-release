import assert from 'node:assert/strict';
import { parseCommit } from '../src/parse-commits.js';
assert.equal(parseCommit('feat( ): add capability',{strictPolicy:true}).valid,false);
assert.equal(parseCommit('feat(api):    ',{strictPolicy:true}).valid,false);
assert.equal(parseCommit('feat!: remove API',{strictPolicy:true}).valid,false);
assert.equal(parseCommit('feat(api)!: remove API\n\nBREAKING CHANGE: Use replacement.',{strictPolicy:true}).valid,true);
assert.equal(parseCommit('feat(multi word): add',{}).valid,true);
assert.equal(parseCommit('feat(multi word): add',{strictPolicy:true}).valid,false);
console.log('strict Captain commit semantics passed');
