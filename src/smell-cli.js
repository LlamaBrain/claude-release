#!/usr/bin/env node
// CLI wrapper for lib/smell.js. Three message sources:
//   smell-cli.js --message "<text>"           pre-commit, ad-hoc
//   smell-cli.js --staged-msg-file <path>     pre-commit, reads file (e.g. .git/COMMIT_EDITMSG)
//   smell-cli.js <ref>                        post-hoc audit of a single commit
//
// Optional flags:
//   --json                          structured output
//   --threshold-files <n>           default 5
//   --threshold-loc <n>             default 100
//   --threshold-top-level-dirs <n>  default 5 (unrelated-area-bundling)
//
// Exit code: number of warnings emitted (0 = clean). With --json, still reflects warning count.

import { readFileSync, existsSync } from 'node:fs';
import {
  runSmellChecks,
  getStagedInputs,
  getCommitInputs,
  getCommitMessage,
} from './smell.js';

function parseArgs(argv) {
  const args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--message') { args.flags.message = argv[++i]; continue; }
    if (a === '--staged-msg-file') { args.flags.stagedMsgFile = argv[++i]; continue; }
    if (a === '--json') { args.flags.json = true; continue; }
    if (a === '--threshold-files') { args.flags.thresholdFiles = parseInt(argv[++i], 10); continue; }
    if (a === '--threshold-loc') { args.flags.thresholdLoc = parseInt(argv[++i], 10); continue; }
    if (a === '--threshold-top-level-dirs') { args.flags.thresholdTopLevelDirs = parseInt(argv[++i], 10); continue; }
    if (a === '--help' || a === '-h') { args.flags.help = true; continue; }
    args.positional.push(a);
  }
  return args;
}

function usage() {
  process.stderr.write([
    'usage: smell-cli.js (--message "<text>" | --staged-msg-file <path> | <ref>)',
    '                    [--json] [--threshold-files N] [--threshold-loc N] [--threshold-top-level-dirs N]',
    '',
    'Exit code = warning count (0 = clean).',
    '',
  ].join('\n'));
}

function fmtWarning(w, i) {
  const lines = [
    `${i + 1}. [${w.check}] ${w.message}`,
  ];
  if (w.details) {
    for (const [k, v] of Object.entries(w.details)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) {
        if (v.length === 0) continue;
        lines.push(`   ${k}:`);
        for (const item of v) lines.push(`     - ${item}`);
      } else if (typeof v === 'object') {
        lines.push(`   ${k}: ${JSON.stringify(v)}`);
      } else {
        lines.push(`   ${k}: ${v}`);
      }
    }
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.flags.help) { usage(); process.exit(0); }

  let message;
  let inputs;

  if (args.flags.message) {
    message = args.flags.message;
    inputs = getStagedInputs();
  } else if (args.flags.stagedMsgFile) {
    const p = args.flags.stagedMsgFile;
    if (!existsSync(p)) {
      process.stderr.write(`smell-cli: --staged-msg-file path does not exist: ${p}\n`);
      process.exit(2);
    }
    message = readFileSync(p, 'utf8').replace(/^#.*$/gm, '').trim();
    inputs = getStagedInputs();
  } else if (args.positional.length === 1) {
    const ref = args.positional[0];
    message = getCommitMessage(ref);
    if (!message) {
      process.stderr.write(`smell-cli: could not read commit message for ref: ${ref}\n`);
      process.exit(2);
    }
    inputs = getCommitInputs(ref);
  } else {
    usage();
    process.exit(2);
  }

  const opts = {
    message,
    inputs,
    thresholdFiles: args.flags.thresholdFiles ?? 5,
    thresholdLoc: args.flags.thresholdLoc ?? 100,
    thresholdTopLevelDirs: args.flags.thresholdTopLevelDirs ?? 5,
  };

  const { warnings } = await runSmellChecks(opts);

  if (args.flags.json) {
    process.stdout.write(JSON.stringify({
      mode: inputs.mode,
      ref: inputs.ref ?? null,
      warning_count: warnings.length,
      warnings,
    }, null, 2) + '\n');
  } else if (warnings.length === 0) {
    process.stdout.write('OK — no smells detected.\n');
  } else {
    process.stdout.write(`${warnings.length} smell${warnings.length === 1 ? '' : 's'} detected:\n\n`);
    for (let i = 0; i < warnings.length; i++) {
      process.stdout.write(fmtWarning(warnings[i], i) + '\n\n');
    }
  }

  process.exit(warnings.length > 255 ? 255 : warnings.length);
}

main().catch(err => {
  process.stderr.write(`smell-cli: ${err.message}\n`);
  process.exit(1);
});
