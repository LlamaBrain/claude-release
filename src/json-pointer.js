export function resolveJsonPointer(doc, pointer) {
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error('invalid JSON pointer');
  const parts = pointer.slice(1).split('/').map(part => {
    if (/~(?![01])/.test(part)) throw new Error('invalid JSON pointer');
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  });
  if (parts.some(part => ['__proto__', 'prototype', 'constructor'].includes(part))) throw new Error('unsafe JSON pointer');
  let parent = doc;
  for (const part of parts.slice(0, -1)) {
    if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, part)) throw new Error('missing JSON pointer');
    parent = parent[part];
  }
  const key = parts.at(-1);
  if (!parent || typeof parent !== 'object' || !Object.hasOwn(parent, key)) throw new Error('missing JSON pointer');
  return { parent, key };
}
