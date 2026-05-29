// Canonical list of plugin/lib/ entry points that the release ships.
//
// Single source of truth: scripts/bundle.mjs builds exactly these, and
// scripts/verify-release-readiness.mjs asserts exactly these were published and
// are self-contained. Keeping the list in one place means the bundler and the
// release gate can never disagree about what must ship.
export const ENTRY_POINTS = [
  "audit-commits.js",
  "build-manifest.js",
  "compute-bump.js",
  "smell-cli.js",
  "verify-output.js",
];
