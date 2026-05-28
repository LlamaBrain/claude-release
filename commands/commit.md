---
description: Propose a Conventional Commit message from the staged diff. LLM-assisted, validated against what the diff actually shows.
allowed-tools: Bash, Read
---

# claude-release:commit

Produce a Conventional Commit message for the currently staged changes. Two stages: a deterministic context-gathering pass, then an LLM proposal that gets cross-checked against the diff before any commit happens.

## 1. Gather context

Run these in parallel:

- `git diff --cached --stat` — file-level summary of what's staged.
- `git diff --cached` — full diff. If output > 30000 chars, truncate and **explicitly note** the truncation in the payload to the model.
- `git branch --show-current` — current branch.
- `git log -5 --pretty=format:'%h %s'` — last five commit subjects for style reference.
- `git status --short` — if there are no staged changes, abort with a friendly message.

## 2. Propose the message

Compose a single Conventional Commit (spec v1.0.0):

```
<type>(<scope>): <subject>

[optional body]

[optional footer: BREAKING CHANGE: <description>]
```

Rules:

- `<type>` ∈ `{feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert}`.
- `<scope>` is optional, lowercase, derived from the most-touched top-level directory or component (e.g. `rag`, `ui`, `controllers`). Skip if it would be vague.
- `<subject>` imperative mood, no trailing period, ≤ 72 chars.
- Body wraps at ~100 cols and explains the *why* when non-obvious. Omit if the subject is sufficient.
- Append `BREAKING CHANGE: <description>` **only** when the diff actually shows a removed/renamed public symbol, removed/renamed exported member, or signature change. Never infer breakage from prose alone.

## 3. Smell test (REQUIRED — gates the commit)

Run the smell test against the drafted message. Pass the message via `--message` and let it inspect the staged diff:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/smell-cli.js" --message "<proposed message>"
```

Exit code = warning count. The five v1 checks cover:

1. `conventional-malformed` — the message must parse as a Conventional Commit.
2. `api-break-no-marker` — the staged diff modifies/removes public API but the message has no `!` and no `BREAKING CHANGE:` footer.
3. `breaking-marker-no-description` — the message uses `!` or `BREAKING CHANGE:` but provides no substantive description of what broke.
4. `thin-subject-on-substantive-diff` — the diff exceeds the file/LOC thresholds but the message has no body.
5. `changelog-misses-breaking-change` — fires only when `CHANGELOG.md` is staged; cross-checks that breaking commits and api-diff breaks are surfaced in the new section.

**If exit code > 0, do NOT commit.** Show the warnings to the user and either:
- Revise the message to fix the smell, then re-run, OR
- If the user explicitly says "ignore smells" / "skip smells" / passes `--ignore-smells` in their invocation, commit anyway. Note in your response which smells were ignored and why.

`--ignore-smells` is the deliberate, noisy override. Do not invoke it without an explicit user instruction. False positives happen; raising the friction prevents drift.

## 4. Apply

Show the final message to the user for approval. On approval:

```bash
git commit -m "$(cat <<'EOF'
<message>
EOF
)"
```

Never push. Never amend without explicit user request.
