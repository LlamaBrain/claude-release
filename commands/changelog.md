---
description: Generate a Keep-a-Changelog v1.1.0 section for the next release. LLM proposes; manifest verifies.
allowed-tools: Bash, Read, Edit
---

# claude-release:changelog

One LLM call, gated on hash-existence and structure cross-checks against the manifest.

## 1. Build the manifest

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" > /tmp/release-manifest.json
```

This is `compute-bump.js`'s output plus parsed commit bodies and (when dotnet + PublicApiAnalyzers are present) an API diff via `api-diff.js`.

## 2. Generate the section

Read `/tmp/release-manifest.json`. Send it to the model with this exact prompt:

> Given this release manifest, produce a Keep-a-Changelog v1.1.0 section for `{next_version}`. Group bullets under: **Added**, **Changed**, **Deprecated**, **Removed**, **Fixed**, **Security**. One bullet per logical change. Every bullet must end with a reference: either `(<hash>)` for an already-committed commit listed in `commits`, **or** `({next_version})` for content that lives in the upcoming release commit (staged work that hasn't been committed yet) or that was derived from `api_diff`. Do **not** introduce claims not supported by `commits` or `api_diff`. Do **not** editorialize about performance, quality, or impact unless a commit body explicitly states it. Markdown only, no preamble.
>
> **`api_diff` handling.** When the manifest's `api_diff` has non-empty arrays, they are a safety net for API-shape changes that commit messages may not have flagged:
> - Entries in `api_diff.added` may support **Added** or **Changed** bullets.
> - Entries in `api_diff.removed` must appear under **Removed** (or be called out as breaking) unless they are clearly internal/non-user-facing.
> - Entries in `api_diff.changed` must appear under **Changed** (or be called out as breaking).
> - Bullets derived from `api_diff` end with `({next_version})` — they describe staged work, not any single commit.
> - Group related entries (e.g. an entire class added with several public methods) into one bullet rather than emitting one bullet per symbol; describe only the symbol-level change, do not invent rationale.

Write the model's output to `/tmp/release-section.md`.

## 3. Verify

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/verify-output.js" \
  --manifest /tmp/release-manifest.json \
  --section  /tmp/release-section.md
```

Checks performed:

- every `(hash)` in the section corresponds to a real `commits[*].hash`
- every bullet ends with a hash reference
- headers are exactly Keep-a-Changelog v1.1.0 groups (empty sections may be omitted)
- no editorializing words (significantly, dramatically, massively, world-class, etc.) **unless** a commit body literally contains them

If verification fails, **regenerate once** with the validator's failure messages pasted into the prompt as feedback. If it fails twice in a row, **stop**: show the manifest and the failed generation to the user; let them write the section by hand rather than thrashing retries.

## 4. Prepend to CHANGELOG.md

On approval, prepend the verified section under the top-of-file `## [Unreleased]` header (or below the file header if no Unreleased section exists). Do not push, do not tag — that's `release`'s job.
