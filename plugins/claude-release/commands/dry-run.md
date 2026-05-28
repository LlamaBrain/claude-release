---
description: Preview the next release's manifest, changelog section, and verify report. No staging, no commits, no edits.
allowed-tools: Bash, Read
---

# claude-release:dry-run

Compose the first three steps of `/release` — manifest → section → verify — and print the result. Nothing on disk changes. Use this to iterate on changelog wording before committing to the full release flow.

## Steps

1. **Build the manifest** — identical to `/claude-release:release` Step 1.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" > /tmp/release-manifest.json
   ```

   If `bump_kind = none` and every `api_diff` array (`added`, `removed`, `changed`) is empty, abort cleanly — there is nothing to preview.

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
