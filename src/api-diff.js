// Optional public-API diff via Roslyn.
// Materialises a previous git ref and the current worktree into temp directories, then shells out
// to the bundled dotnet ApiDiff tool to produce a structured diff. Returns null (with a stderr
// warning) on any failure so callers can fall back to commit-message signals only.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const WORKTREE_REF = 'WORKTREE';

function warn(reason) {
  process.stderr.write(`[claude-release] api-diff skipped: ${reason}\n`);
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    encoding: options.encoding ?? 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function hasDotnet() {
  try {
    execFileSync('dotnet', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pluginRootFromImportMeta() {
  // lib/api-diff.js -> plugin root is parent of lib/
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

// Path filter shared by ref- and worktree-materialisation. Input is a forward-slash relative path.
function isIncludedCsPath(relPath) {
  if (!relPath.endsWith('.cs')) return false;
  const lower = relPath.toLowerCase();
  const segments = relPath.split('/');
  const lowerSegments = lower.split('/');
  // Directory-segment exclusions
  const dirExclusions = ['packages', 'library', 'obj', 'bin', 'temp', 'editor', 'tests'];
  if (lowerSegments.slice(0, -1).some(s => dirExclusions.includes(s))) return false;
  // Filename-suffix exclusions
  const name = segments[segments.length - 1];
  const lowerName = lowerSegments[lowerSegments.length - 1];
  if (lowerName.endsWith('.tests.cs')) return false;
  if (lowerName.endsWith('.generated.cs')) return false;
  if (lowerName.endsWith('.designer.cs')) return false;
  if (lowerName.endsWith('.g.cs')) return false; // common autogen suffix
  if (lowerName.endsWith('.g.i.cs')) return false;
  void name;
  return true;
}

function materializeGitRef(ref, destDir) {
  // List tracked files at the ref. We do NOT pass a `-- '*.cs'` pathspec here: ls-tree's pathspec
  // semantics differ from ls-files — with `-r -- '*.cs'` git ls-tree returns zero rows because
  // the glob does not traverse into subdirectories the way callers expect. Filtering on extension
  // is done in JS via `isIncludedCsPath`, which also enforces the dir/suffix exclusions.
  let listing;
  try {
    listing = runGit(['ls-tree', '-r', '--name-only', '-z', ref]);
  } catch (err) {
    throw new Error(`git ls-tree failed for ref ${ref}: ${err.message}`);
  }
  const files = listing.split('\0').filter(Boolean).map(p => p.replace(/\\/g, '/')).filter(isIncludedCsPath);
  for (const relPath of files) {
    const outPath = join(destDir, ...relPath.split('/'));
    mkdirSync(dirname(outPath), { recursive: true });
    let content;
    try {
      content = runGit(['show', `${ref}:${relPath}`], { encoding: 'buffer' });
    } catch (err) {
      throw new Error(`git show failed for ${ref}:${relPath}: ${err.message}`);
    }
    writeFileSync(outPath, content);
  }
}

function materializeWorktree(destDir) {
  // git ls-files includes tracked files and staged adds, but excludes untracked-only files.
  // ls-files's pathspec does traverse subdirs (unlike ls-tree's), but for consistency with the
  // ref path above — and to keep the .cs filter in one place — we list everything and filter in JS.
  let listing;
  try {
    listing = runGit(['ls-files', '-z']);
  } catch (err) {
    throw new Error(`git ls-files failed: ${err.message}`);
  }
  const files = listing.split('\0').filter(Boolean).map(p => p.replace(/\\/g, '/')).filter(isIncludedCsPath);
  const repoRoot = runGit(['rev-parse', '--show-toplevel']).trim();
  for (const relPath of files) {
    const srcPath = join(repoRoot, ...relPath.split('/'));
    // Skip files that have been deleted in the worktree — Roslyn will then report their
    // public symbols as removed, which is the correct silent-break signal.
    if (!existsSync(srcPath)) continue;
    const outPath = join(destDir, ...relPath.split('/'));
    mkdirSync(dirname(outPath), { recursive: true });
    copyFileSync(srcPath, outPath);
  }
}

function ensureBuilt(projectDir, dllPath) {
  if (existsSync(dllPath)) return;
  execFileSync(
    'dotnet',
    ['build', projectDir, '-c', 'Release', '--verbosity', 'quiet', '--nologo'],
    { stdio: ['ignore', 'inherit', 'inherit'] },
  );
}

export async function tryApiDiff(previousRef, toRef) {
  if (!previousRef) return null;
  if (!hasDotnet()) return null;

  const pluginRoot = pluginRootFromImportMeta();
  const projectDir = join(pluginRoot, 'lib', 'dotnet', 'ApiDiff');
  const dllPath = join(projectDir, 'bin', 'Release', 'net8.0', 'ApiDiff.dll');

  let tmpRoot;
  try {
    tmpRoot = mkdtempSync(join(tmpdir(), 'claude-release-apidiff-'));
  } catch (err) {
    warn(`could not create temp dir: ${err.message}`);
    return null;
  }
  const prevDir = join(tmpRoot, 'prev');
  const currDir = join(tmpRoot, 'curr');
  mkdirSync(prevDir, { recursive: true });
  mkdirSync(currDir, { recursive: true });

  try {
    materializeGitRef(previousRef, prevDir);
    if (toRef === WORKTREE_REF) {
      materializeWorktree(currDir);
    } else {
      materializeGitRef(toRef, currDir);
    }

    let stdout;
    try {
      ensureBuilt(projectDir, dllPath);
      stdout = execFileSync(
        'dotnet',
        [dllPath, prevDir, currDir],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (err) {
      const stderr = err.stderr?.toString?.() ?? '';
      warn(`dotnet ApiDiff failed: ${stderr.trim() || err.message}`);
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch (err) {
      warn(`could not parse ApiDiff output as JSON: ${err.message}`);
      return null;
    }

    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.added) || !Array.isArray(parsed.removed) || !Array.isArray(parsed.changed)) {
      warn('ApiDiff output missing expected shape ({added,removed,changed})');
      return null;
    }
    return parsed;
  } catch (err) {
    warn(err.message);
    return null;
  } finally {
    try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
