#!/usr/bin/env node
// Parse a single Conventional Commit message. Module + CLI.
// CLI: `echo "<msg>" | node parse-commits.js --stdin`  -> JSON to stdout, exit 0 if valid else 1.

import { sync as parseSync } from 'conventional-commits-parser';

const VALID_TYPES = new Set([
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
  'test', 'build', 'ci', 'chore', 'revert',
]);

export function parseCommit(raw) {
  const parsed = parseSync(raw, {
    headerPattern: /^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/,
    headerCorrespondence: ['type', 'scope', 'breakingMark', 'subject'],
    noteKeywords: ['BREAKING CHANGE', 'BREAKING-CHANGE'],
    revertPattern: /^Revert\s"([^"]+)"\s*This reverts commit (\w+)\.?/i,
    revertCorrespondence: ['header', 'hash'],
  });

  const type = parsed.type;
  const valid = Boolean(type && VALID_TYPES.has(type) && parsed.subject);
  const breaking = Boolean(
    parsed.breakingMark === '!' ||
    (parsed.notes || []).some(n => /^BREAKING[\s-]CHANGE$/.test(n.title))
  );
  const issues = (parsed.references || []).map(r => `#${r.issue}`);

  // Squash-merge bodies often embed multiple Conventional Commit lines as a list.
  // We surface the top-level result but keep `raw` so callers can re-parse children.
  return {
    valid,
    type: type || null,
    scope: parsed.scope || null,
    subject: parsed.subject || null,
    body: parsed.body || '',
    breaking,
    breaking_description: (parsed.notes || [])
      .filter(n => /^BREAKING[\s-]CHANGE$/.test(n.title))
      .map(n => n.text)
      .join('\n') || null,
    issues,
    revert: Boolean(parsed.revert),
    raw,
  };
}

// CLI entry
// Bundling-aware CLI guard: when this module is bundled into another entry
// point (e.g., build-manifest.js), import.meta.url reflects the bundle file,
// not parse-commits.js. The old check (endsWith basename of argv[1]) returned
// true for any bundle that ended in any .js file, accidentally firing the CLI
// path. The explicit-basename check pins the guard to standalone invocation.
const isMain = (() => {
  try {
    const myBasename = new URL(import.meta.url).pathname.split('/').pop();
    const invokedBasename = process.argv[1].replace(/\\/g, '/').split('/').pop();
    return myBasename === 'parse-commits.js' && invokedBasename === 'parse-commits.js';
  } catch { return false; }
})();

if (isMain && process.argv.includes('--stdin')) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => (buf += chunk));
  process.stdin.on('end', () => {
    const parsed = parseCommit(buf.trim());
    console.log(JSON.stringify(parsed, null, 2));
    process.exit(parsed.valid ? 0 : 1);
  });
} else if (isMain) {
  console.error('parse-commits.js: use --stdin and pipe a commit message');
  process.exit(2);
}
