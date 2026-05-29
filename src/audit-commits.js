#!/usr/bin/env node
// Lint commits in a range for Conventional Commit compliance. CI-friendly.
// Usage: audit-commits.js [<range>]   (default: <last-tag>..HEAD, or HEAD if no tag)

import { execFileSync } from 'node:child_process';
import { parseCommit } from './parse-commits.js';

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function defaultRange() {
  try {
    const tag = git('describe', '--tags', '--abbrev=0');
    return `${tag}..HEAD`;
  } catch {
    return 'HEAD';
  }
}

const HSEP = '<<<H>>>';
const CSEP = '<<<COMMIT-SEP>>>';

const range = process.argv[2] || defaultRange();
let out;
try {
  out = git('log', range, `--pretty=format:%H${HSEP}%B${CSEP}`);
} catch (e) {
  console.error(`audit-commits: could not read range "${range}": ${e.message}`);
  process.exit(2);
}

let failures = 0;
if (out) {
  for (const chunk of out.split(CSEP).map(c => c.trim()).filter(Boolean)) {
    const idx = chunk.indexOf(HSEP);
    const hash = chunk.slice(0, idx).slice(0, 7);
    const message = chunk.slice(idx + HSEP.length).trim();
    const parsed = parseCommit(message);
    if (!parsed.valid) {
      const subject = message.split('\n', 1)[0];
      console.log(`${hash} ${subject} :: not Conventional Commits`);
      failures++;
    }
  }
}

process.exit(failures === 0 ? 0 : 1);
