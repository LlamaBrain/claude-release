---
description: Preview the next release's manifest, changelog section, and verify report. No staging, no commits, no edits.
allowed-tools: Bash, Read
---

# claude-release:dry-run

## Branch-driven policy routing

First inspect the Captain policy captured from the trusted base, including any committed `commitPolicyPath`. If `commit.mode` is `branch_driven`, use this section and stop before the legacy steps below.

Preview only the configured release-boundary target. Run `lib/build-manifest.js` with the explicit stable baseline and exact target, plus the configured prerelease identifier and compatibility base when applicable. For an explicitly configured initial baseline use its pinned ref, version, surface and optional JSON pointer. Show the full classification, exact revisions, preserved squash changes, and compatibility status. `api_diff: null` or unavailable analysis is missing evidence, not an empty compatible diff.

For a release candidate or stable boundary, `lib/prepare-artifacts.js --request <json>` can preview deterministic proposed surfaces and the configured milestone changelog without writing them. Report that a suspected MAJOR requires Captain?s authenticated compatibility decision. Do not stage, commit, tag, publish, or push.

## Legacy per-commit workflow


Compose the first three steps of `/release` — manifest → section → verify — and print the result. Nothing on disk changes. Use this to iterate on changelog wording before committing to the full release flow.

## Steps

1. **Build the manifest** — identical to `/claude-release:release` Step 1.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" > /tmp/release-manifest.json
   ```

   If `api_diff` is null, report that analysis was unavailable. If `bump_kind = none` and the analyzed arrays are empty, there is no release to preview.

2. **Generate the section** — identical to `/claude-release:changelog` Step 2. Use the same prompt verbatim; write the model output to `/tmp/release-section.md`.

3. **Verify (with coverage on)**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/verify-output.js" \
     --manifest /tmp/release-manifest.json \
     --section  /tmp/release-section.md \
     --coverage
   ```

   `--coverage` is ON for dry-run — maximum signal while iterating. If verify fails, surface the errors but **do not** auto-regenerate; the user is iterating and decides whether to regenerate, edit by hand, or accept a warning as a known heuristic false positive.

4. **Print the result.** Above the section, surface:
   - `next_version` and `bump_kind` from the manifest
   - The verify exit summary (clean / N warnings, with each warning's text)

   Then dump the section inline. No truncation, no editing.

## Never

- Stage, commit, tag, push.
- Edit `CHANGELOG.md`, `VERSION`, or any project file.
- Run the build-gate (that belongs to `/release`; dry-run has no commit to gate).
