---
description: Smell-test a commit message against the staged diff (or audit an existing commit). Advisory; does not block.
allowed-tools: Bash, Read
---

# claude-release:smell

Pre-flight quality check on a proposed or existing commit. Catches: missing breaking-change markers, breaking markers with no description, thin commits on substantial diffs, malformed Conventional Commit messages, and (when `CHANGELOG.md` is staged) breaking changes that the changelog fails to surface.

Advisory by design — exits with the warning count but does not block anything itself. `/claude-release:commit` calls the same library and **does** block on warnings; this command is for asking "would my next commit be clean?" without going through the commit flow.

## Three modes

### A. Audit a proposed message against staged changes

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/smell-cli.js" --message "<proposed message>"
```

Use when you're drafting a commit and want a sanity check before invoking `/claude-release:commit`.

### B. Audit the message currently in `.git/COMMIT_EDITMSG`

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/smell-cli.js" --staged-msg-file .git/COMMIT_EDITMSG
```

Use when a commit message is already drafted in the editor file (e.g. via `git commit --edit` aborted partway).

### C. Audit an existing commit

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/smell-cli.js" <ref>
```

Use to retroactively check a single commit (`HEAD`, `<hash>`, `HEAD~1`, etc.). Useful for "did the last commit slip past the gate?"

## Flags

- `--json` — structured output for tooling
- `--threshold-files N` — file-count threshold for the thin-subject check (default 5)
- `--threshold-loc N` — LOC threshold for the thin-subject check (default 100)

## What it checks

| # | Check | Fires when |
|---|---|---|
| 1 | `conventional-malformed` | Message doesn't parse as a Conventional Commit |
| 2 | `api-break-no-marker` | Diff modifies/removes public API but no `!` or `BREAKING CHANGE:` |
| 3 | `breaking-marker-no-description` | `!` / `BREAKING CHANGE:` present but no substantive description |
| 4 | `thin-subject-on-substantive-diff` | Diff exceeds thresholds but message has no body |
| 5 | `changelog-misses-breaking-change` | `CHANGELOG.md` staged but new section omits a breaking commit or api-diff break |

## What it does NOT check (v0.2 roadmap)

- Scope mismatches (e.g. `feat(ui)` touching no UI paths) — too noisy without tuning.
- Unrelated-area bundling — needs better heuristics.
- Changelog claims not backed by api_diff/commits (reverse direction of #5) — false-positive prone with natural-language descriptions.
