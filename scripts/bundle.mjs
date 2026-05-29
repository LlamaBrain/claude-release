// Bundle each plugin/lib/ entry point into a self-contained Node ESM file that
// inlines all `node_modules` dependencies (semver, conventional-commits-parser).
//
// Background: Claude Code installs plugins by cloning the marketplace repo. It
// does not run `npm install` in the plugin tree, so any runtime that imports
// from `node_modules` ships broken. ADR-0009 (in the Captain SDLC docs set)
// formalizes the discipline: every Captain SDLC tool's release-readiness check
// must confirm the *published artifact* runs end-to-end, not just the source.
//
// This script is the concrete fix for claude-release: bundle source from src/
// into self-contained outputs at plugin/lib/. Commands call `node lib/<name>.js`
// against the bundled outputs in the consumer's clone.

import { build } from "esbuild";
import { rm, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { ENTRY_POINTS } from "./entry-points.mjs";

const root = process.cwd();
const srcDir = path.join(root, "src");
const outDir = path.join(root, "plugin", "lib");
const dotnetSrc = path.join(root, "src", "dotnet");
const dotnetDest = path.join(outDir, "dotnet");

// Clean the output directory but preserve dotnet/ (it has its own build flow).
// Approach: remove everything in plugin/lib/ then restore dotnet/.
const preservedDotnet = await pathExists(dotnetDest);

if (preservedDotnet) {
  // Move dotnet aside before clean.
  await cp(dotnetDest, path.join(root, ".dotnet-tmp"), { recursive: true });
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

if (preservedDotnet) {
  await cp(path.join(root, ".dotnet-tmp"), dotnetDest, { recursive: true });
  await rm(path.join(root, ".dotnet-tmp"), { recursive: true, force: true });
} else if (await pathExists(dotnetSrc)) {
  // First-time bundle: copy dotnet from src/ if it lives there.
  await cp(dotnetSrc, dotnetDest, { recursive: true });
}

// Bundle each entry point.
for (const entry of ENTRY_POINTS) {
  const entryPath = path.join(srcDir, entry);
  if (!(await pathExists(entryPath))) {
    throw new Error(`Entry point missing from src/: ${entry}`);
  }
  await build({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node18",
    outfile: path.join(outDir, entry),
    // The createRequire banner is required because some CJS dependencies
    // (e.g., conventional-commits-parser) use dynamic require("stream") for
    // Node built-ins. esbuild's ESM bundle converts those to a __require shim
    // that fails on built-ins unless we anchor it to a real Node require.
    banner: {
      js: [
        "// claude-release bundled output — DO NOT EDIT. Source in src/.",
        "import { createRequire as __cr } from 'node:module';",
        "const require = __cr(import.meta.url);",
      ].join("\n"),
    },
  });
  console.log(`✓ Bundled lib/${entry}`);
}

console.log(`\nAll ${ENTRY_POINTS.length} entry points bundled to plugin/lib/.`);

async function pathExists(p) {
  try {
    const fs = await import("node:fs/promises");
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}
