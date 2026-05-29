// Re-pair removed+added api-diff entries that represent a source-compatible signature
// extension (adding a defaulted parameter). The dotnet ApiDiff bakes the parameter-type
// tuple into a method's FQN (e.g. `Game.Player.Move(Vector2)` vs `Game.Player.Move(Vector2,bool)`),
// so adding a defaulted param surfaces as 1 removed + 1 added entry even though existing
// callers still compile. This module detects that shape and reclassifies the pair as additive.
//
// Caveat: the new signature still LOOKS like a binary break to existing compiled callers
// because the method-resolution metadata token changes. Source-only consumers (the common
// case for this plugin's Unity / asset-package targets) are fine. If the project ships a
// compiled DLL that downstream binaries link against, the "additive" pair is in fact an ABI
// break and the operator should override with an explicit bump.

// Split a param-type tuple like `Vector2,List<int,string>,ref int` on top-level commas
// only — commas inside <…>, (…), [...] do not separate params. Generic type arguments,
// nested tuples, and array ranks all nest inside one of these bracket families in C# syntax,
// so a single depth counter suffices.
export function splitParamTuple(inner) {
  if (!inner) return [];
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '<' || c === '(' || c === '[') depth++;
    else if (c === '>' || c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(inner.slice(start).trim());
  return parts.filter(p => p.length > 0);
}

// Split a method/constructor/operator FQN at the first `(`. Returns null for entries that
// have no `(...)` tail (types/fields/properties/events). Indexers use `[...]` and are
// intentionally not matched — they don't share the additive-param failure mode in practice
// and folding them in would conflate with property-style entries.
export function splitFqnAtOpenParen(fqn) {
  const i = fqn.indexOf('(');
  if (i < 0) return null;
  if (!fqn.endsWith(')')) return null;
  return {
    prefix: fqn.slice(0, i + 1), // includes the '('
    inner: fqn.slice(i + 1, -1), // strips the trailing ')'
  };
}

// Decide whether `addedParams` is a strict additive extension of `removedParams` —
// addedParams[0..N-1] === removedParams AND addedParams.length > N.
export function isStrictAdditiveExtension(removedParams, addedParams) {
  if (addedParams.length <= removedParams.length) return false;
  for (let i = 0; i < removedParams.length; i++) {
    if (removedParams[i] !== addedParams[i]) return false;
  }
  return true;
}

// Group removed/added entries by their FQN-up-to-open-paren prefix, then pair them up by
// strict additive extension. Returns:
//   { realRemoved, effectiveAdded, additivePairs }
// where:
//   realRemoved    — removed entries that did NOT find an additive partner
//   effectiveAdded — all added entries unchanged (the new signature in an additive pair is
//                    still a real net-new symbol on the public surface — only the OLD
//                    signature's "removal" gets dropped from the breaking-change tally)
//   additivePairs  — { prefix, removedEntry, addedEntry } records for bump_reason text
//
// We do NOT touch the `changed` bucket: a changed entry has the same FQN in both versions,
// so its param-type tuple is unchanged by definition — the "added optional default" case
// never lands in `changed`. Caller decides what to do with `changed` (currently: major).
//
// Tiebreak for multi-overload pairs sharing a prefix: we iterate removed in the order
// ApiDiff gave us (sorted by kind+FQN by Program.cs's Sort), and for each removed entry we
// pick the FIRST currently-unpaired added entry whose tuple is a strict additive extension.
// Deterministic and simple. A more sophisticated heuristic (longest-prefix match,
// minimum-distance pairing) is possible but not warranted until we hit a real-world
// counter-example.
export function classifyRemovedAddedPairs(apiDiff) {
  const removed = apiDiff.removed ?? [];
  const added = apiDiff.added ?? [];

  // Buckets keyed by FQN prefix `Type.Name(`. Only method/ctor/operator entries ever land
  // here because splitFqnAtOpenParen returns null for the rest.
  const removedByPrefix = new Map(); // prefix -> array of { entry, params }
  const addedByPrefix = new Map();

  for (const entry of removed) {
    const split = splitFqnAtOpenParen(entry.fqn);
    if (!split) continue;
    const params = splitParamTuple(split.inner);
    if (!removedByPrefix.has(split.prefix)) removedByPrefix.set(split.prefix, []);
    removedByPrefix.get(split.prefix).push({ entry, params });
  }
  for (const entry of added) {
    const split = splitFqnAtOpenParen(entry.fqn);
    if (!split) continue;
    const params = splitParamTuple(split.inner);
    if (!addedByPrefix.has(split.prefix)) addedByPrefix.set(split.prefix, []);
    addedByPrefix.get(split.prefix).push({ entry, params });
  }

  const pairedRemovedFqns = new Set();
  const additivePairs = [];

  for (const [prefix, removedItems] of removedByPrefix) {
    const addedItems = addedByPrefix.get(prefix);
    if (!addedItems || addedItems.length === 0) continue;
    const claimedAdded = new Set(); // indices in addedItems already paired
    for (const r of removedItems) {
      for (let j = 0; j < addedItems.length; j++) {
        if (claimedAdded.has(j)) continue;
        const a = addedItems[j];
        if (isStrictAdditiveExtension(r.params, a.params)) {
          pairedRemovedFqns.add(r.entry.fqn);
          additivePairs.push({ prefix, removedEntry: r.entry, addedEntry: a.entry });
          claimedAdded.add(j);
          break;
        }
      }
    }
  }

  const realRemoved = removed.filter(e => !pairedRemovedFqns.has(e.fqn));
  const effectiveAdded = added;

  return { realRemoved, effectiveAdded, additivePairs };
}
