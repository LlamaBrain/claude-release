---
description: Lint commits in a range for Conventional Commit compliance. Pure script, no LLM, CI-friendly.
allowed-tools: Bash, Read
---

# claude-release:audit

Walk `git log` over a range (default: since last tag) and report any non-conventional commits.

## Run

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/audit-commits.js" [<range>]
```

- `<range>` defaults to `<last-tag>..HEAD`. If no tag exists, defaults to `HEAD` (all commits).
- Pass any git revision range to override: `HEAD~20..HEAD`, `main..feature/x`, `origin/main..HEAD`.

## Output

For each malformed commit, one line:

```
<short-hash> <subject> :: <reason>
```

Exit code:

- `0` — all commits valid (or range empty)
- `1` — one or more malformed commits

## CI usage

CI runs outside Claude Code, so `${CLAUDE_PLUGIN_ROOT}` is not set. Replace `path/to/claude-release` below with whatever path your CI checkout uses for the plugin:

```yaml
- name: Conventional Commits audit
  run: node path/to/claude-release/lib/audit-commits.js origin/main..HEAD
```
