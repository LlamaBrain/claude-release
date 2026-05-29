// Release-readiness gate for claude-release. Two guards, each born from a real
// shipped bug:
//
//   1. Version consistency — every version surface (plugin/VERSION,
//      marketplace.json, plugin.json, package.json, package-lock.json) must
//      agree. v0.3.2 shipped with marketplace.json stuck at 0.2.0, so
//      `/plugin update claude-release` told consumers they were already current
//      and handed them the unfixed code path. (CHANGELOG [0.3.2].)
//
//   2. Self-contained runtime — every bundled plugin/lib/ entry point must exist
//      and import nothing outside Node builtins. v0.1.x–v0.3.0 shipped lib files
//      that imported `semver` / `conventional-commits-parser` with no
//      node_modules present, so every command errored ERR_MODULE_NOT_FOUND.
//      (CHANGELOG [0.3.1] / ADR-0009; the same lesson scripts/bundle.mjs cites.)
//
// Run from the repo root (npm run check:release). Exit 0 = ready;
// exit 1 = not ready, with every problem listed.

import { readFile, access } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { ENTRY_POINTS } from "./entry-points.mjs";

const root = process.cwd();
const errors = [];
const ok = [];

await checkVersionConsistency();
await checkSelfContainedRuntime();

if (errors.length > 0) {
  console.error("✗ Release readiness FAILED:\n");
  for (const e of errors) console.error("  • " + e);
  console.error(`\n${errors.length} problem(s) — fix before releasing.`);
  process.exit(1);
}

for (const line of ok) console.log(line);
console.log("\n✓ Release readiness OK — safe to release.");

// ---------------------------------------------------------------------------

// Guard 1: the canonical version (plugin/VERSION) must match every published
// version surface. Mismatches are collected and reported together.
async function checkVersionConsistency() {
  const canonical = normalizeVersion(await readText("plugin/VERSION"));
  if (!canonical) {
    errors.push("plugin/VERSION is empty or unreadable — cannot establish the canonical version");
    return;
  }

  const pkg = await readJson("package.json");
  const lock = await readJson("package-lock.json");
  const pluginManifest = await readJson("plugin/.claude-plugin/plugin.json");
  const marketplace = await readJson(".claude-plugin/marketplace.json");

  const mpEntry = marketplace?.plugins?.find((p) => p.name === "claude-release");

  const surfaces = [
    ["package.json", pkg?.version],
    ["package-lock.json (root)", lock?.version],
    ["package-lock.json (packages[''])", lock?.packages?.[""]?.version],
    ["plugin/.claude-plugin/plugin.json", pluginManifest?.version],
    [".claude-plugin/marketplace.json (claude-release entry)", mpEntry?.version],
  ];

  let consistent = true;
  for (const [label, value] of surfaces) {
    if (value === undefined || value === null) {
      errors.push(`version surface missing: ${label} has no version field`);
      consistent = false;
    } else if (normalizeVersion(value) !== canonical) {
      errors.push(`version mismatch: ${label} = ${value}, expected ${canonical} (from plugin/VERSION)`);
      consistent = false;
    }
  }

  if (consistent) {
    ok.push(`✓ version consistent at ${canonical} across ${surfaces.length + 1} surfaces`);
  }
}

// Guard 2: every bundled entry point must exist and pull in nothing beyond Node
// builtins — i.e. esbuild actually inlined the third-party deps.
async function checkSelfContainedRuntime() {
  const builtin = new Set(builtinModules);
  let allClean = true;

  for (const entry of ENTRY_POINTS) {
    const rel = path.join("plugin", "lib", entry);
    if (!(await exists(rel))) {
      errors.push(`missing bundled entry point: ${rel} (run \`npm run bundle\`)`);
      allClean = false;
      continue;
    }

    const source = await readText(rel);
    const external = externalSpecifiers(source, builtin);
    if (external.length > 0) {
      errors.push(
        `${rel} imports un-inlined dependenc${external.length > 1 ? "ies" : "y"}: ${external.join(", ")} ` +
          `— this ships broken (no node_modules at consumer install). Re-run \`npm run bundle\`.`,
      );
      allClean = false;
    }
  }

  if (allClean) {
    ok.push(`✓ ${ENTRY_POINTS.length} bundled entry points present and self-contained`);
  }
}

// Collect import/require/dynamic-import specifiers that resolve outside the
// project: not relative, not absolute, not a Node builtin (with or without the
// node: prefix). Returns the offending bare package roots, de-duplicated.
function externalSpecifiers(source, builtin) {
  const specifiers = new Set();
  const patterns = [
    /(?:^|[^.\w])(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']/g, // import/export ... from "x"
    /(?:^|[^.\w])import\s*["']([^"']+)["']/g, //                          bare import "x"
    /(?:^|[^.\w])import\s*\(\s*["']([^"']+)["']\s*\)/g, //                dynamic import("x")
    /(?:^|[^.\w])require\s*\(\s*["']([^"']+)["']\s*\)/g, //               require("x")
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(source)) !== null) {
      const spec = m[1];
      if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("node:")) continue;
      const root = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0];
      if (!builtin.has(root)) specifiers.add(root);
    }
  }
  return [...specifiers];
}

function normalizeVersion(v) {
  return String(v ?? "").trim().replace(/^v/, "");
}

async function readText(rel) {
  try {
    return await readFile(path.join(root, rel), "utf8");
  } catch {
    return "";
  }
}

async function readJson(rel) {
  try {
    return JSON.parse(await readFile(path.join(root, rel), "utf8"));
  } catch {
    return null;
  }
}

async function exists(rel) {
  try {
    await access(path.join(root, rel));
    return true;
  } catch {
    return false;
  }
}
