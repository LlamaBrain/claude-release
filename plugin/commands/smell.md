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
- `--threshold-top-level-dirs N` — top-level-directory threshold for unrelated-area-bundling (default 5)

## What it checks

| # | Check | Fires when |
|---|---|---|
| 1 | `conventional-malformed` | Message doesn't parse as a Conventional Commit |
| 2 | `api-break-no-marker` | Diff modifies/removes public API but no `!` or `BREAKING CHANGE:` |
| 3 | `breaking-marker-no-description` | `!` / `BREAKING CHANGE:` present but no substantive description |
| 4 | `thin-subject-on-substantive-diff` | Diff exceeds thresholds but message has no body |
| 5 | `changelog-misses-breaking-change` | `CHANGELOG.md` staged but new section omits a breaking commit or api-diff break |
| 6 | `scope-mismatch` | Conventional Commit scope (e.g. `ui`) doesn't appear as a substring of any staged path |
| 7 | `unrelated-area-bundling` | Commit spans > `--threshold-top-level-dirs` distinct top-level directories. Skipped when `CHANGELOG.md` is in the staged set (release-commit convention) |
| 8 | `changelog-claims-unbacked` | New `CHANGELOG.md` bullets contain ≥ 5-char keywords that match nothing in any commit subject/body or api-diff fqn |

Checks 6–8 are heuristics with measurable false-positive risk; they're default-on so the gate has signal, and `--ignore-smells` remains the documented escape hatch for known-good commits the heuristics misjudge.
