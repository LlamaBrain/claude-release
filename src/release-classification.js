import { classifyRemovedAddedPairs, splitParamTuple } from './classify-api-diff.js';

// API evidence can raise a commit-derived classification but never lower it.
// A null result means the analyzer did not run or failed; it is not an empty diff.
function optionalExtension(pair) {
  const signature = pair.addedEntry.signature || '';
  const open = signature.indexOf('('), close = signature.lastIndexOf(')');
  if (open < 0 || close <= open) return false;
  const added = splitParamTuple(signature.slice(open + 1, close));
  const removedFqn = pair.removedEntry.fqn || '';
  const ropen = removedFqn.indexOf('('), rclose = removedFqn.lastIndexOf(')');
  if (ropen < 0 || rclose <= ropen) return false;
  const removed = splitParamTuple(removedFqn.slice(ropen + 1, rclose));
  const appended = added.slice(removed.length);
  return appended.length > 0 && appended.every(p => /^[^=]+\s=\s.+$/.test(p));
}
export function classifyApiEvidence(commitKind, apiDiff, posture = 'binary') {
  if (!['source', 'binary'].includes(posture)) throw new Error('invalid API compatibility posture');
  if (!apiDiff) return { bumpKind: commitKind, status: 'unavailable', reason: 'API analysis unavailable' };
  const pairs = classifyRemovedAddedPairs(apiDiff);
  const additivePairs = posture === 'source' ? pairs.additivePairs.filter(optionalExtension) : [];
  const accepted = new Set(additivePairs.map(pair => pair.removedEntry));
  const realRemoved = apiDiff.removed.filter(entry => !accepted.has(entry));
  const effectiveAdded = pairs.effectiveAdded;
  const apiKind = realRemoved.length || apiDiff.changed.length ? 'major' : effectiveAdded.length ? 'minor' : 'none';
  const ranks = { none: 0, patch: 1, minor: 2, major: 3 };
  // A graduate manifest retains its existing stable target until an explicit
  // stable baseline is available to resolve the new compatibility evidence.
  if (commitKind === 'graduate') {
    return { bumpKind: commitKind, status: 'analyzed', apiKind, requiresBaseline: apiKind !== 'none' };
  }
  if (!(commitKind in ranks)) throw new Error(`Unsupported bump kind: ${commitKind}`);
  return {
    bumpKind: ranks[apiKind] > ranks[commitKind] ? apiKind : commitKind,
    status: 'analyzed',
    apiKind,
    reason: `API diff: ${realRemoved.length} removal(s), ${apiDiff.changed.length} change(s), ${effectiveAdded.length} addition(s); ${additivePairs.length} additive pair(s)`,
  };
}
