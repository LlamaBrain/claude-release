---
description: Compute the next semver version from Conventional Commits since the last tag. Deterministic, no LLM.
allowed-tools: Bash, Read
---

# claude-release:bump

Pure script. No LLM call. Builds the **release manifest** that `changelog` and `release` consume.

## Run

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/compute-bump.js"
```

The script:

1. `git describe --tags --abbrev=0` → previous tag. If no tags exist, treat the root commit as the boundary and base the bump on `v0.0.0` (next release defaults to `v0.1.0`).
2. `git log <previous>..HEAD` → range.
3. Parse each commit with `parse-commits.js`.
4. Apply semver:
   - any commit with `!` after type/scope, **or** a `BREAKING CHANGE:` footer → **MAJOR**
   - else any `feat:` → **MINOR**
   - else (`fix`, `refactor`, `perf`, `docs`, `chore`, `build`, `ci`, `test`, `style`, `revert`) → **PATCH**
   - no commits in range → **no bump** (exit 0, "nothing to release")

## Output

By default, emit the proposed manifest to stdout. **Read-only.**

With `--apply`, write `VERSION` at the repo root containing `<next_version>\n`. Still emits the manifest.

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/compute-bump.js" --apply
```

## Manifest schema (the contract)

```json
{
  "previous_version": "v0.4.2",
  "next_version": "v0.5.0",
  "bump_kind": "minor",
  "bump_reason": "3 feat commits, no breaking changes",
  "release_date": "YYYY-MM-DD",
  "commits": [
    {
      "hash": "abc1234",
      "type": "feat",
      "scope": "rag",
      "subject": "add HybridRelevanceCalculator",
      "body": "...",
      "breaking": false,
      "issues": ["#42"]
    }
  ],
  "api_diff": { "added": [], "removed": [], "changed": [] },
  "breaking_changes": []
}
```

Everything downstream is gated against this. Hashes that don't appear in `commits[*].hash` are hallucinations; the verifier rejects them.
