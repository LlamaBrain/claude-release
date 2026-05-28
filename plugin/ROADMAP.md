# claude-release roadmap

Planned work, in rough priority order. None of these block the plugin's current use; they're improvements that came out of dogfooding.

## Shipped

### Smell test (`/claude-release:smell` + `/commit` gate) — v0.1.x
Pre-flight quality check. Five v1 checks (`conventional-malformed`, `api-break-no-marker`, `breaking-marker-no-description`, `thin-subject-on-substantive-diff`, `changelog-misses-breaking-change`). Standalone command is advisory; `/claude-release:commit` calls the same library and blocks on warnings unless the user explicitly passes `--ignore-smells`. Validated end-to-end: smell-test against the v0.1.1 release commit correctly flags it as thin (179 files, 66k LOC, no body) — i.e. the gate would have caught what we shipped without it.

### Changelog coverage check (`verify-output.js --coverage`)
Inverse of the existing reference check. Opt-in via `--coverage`. Groups `manifest.commits[*]` by Conventional-Commit scope (`(no scope)` bucket for nulls) and requires at least one commit per scope to be surfaced in the section — either by hash reference or by a subject-keyword match (≥5-char tokens), reusing the heuristic from `changelog-misses-breaking-change`. Off by default so existing pipelines don't regress; callers (e.g. `/release`) opt in. Falsy commit subjects and unscoped commits are handled; coverage failures append to the same error list and exit non-zero like every other verify check.

### Build-gate before `/release` commits
A release that doesn't compile is the worst kind of release commit. Implemented as a doc-level gate in `commands/release.md` Step 3 — runs *before* staging release artifacts so a failure costs zero churn. For Unity projects: `assets-refresh` triggers a domain reload and waits for compilation, then `console-get-logs` filtered to `Error` surfaces any compile failures verbatim; `--with-tests` opt-in also runs `tests-run` EditMode. Override is `--skip-build "<reason>"` — reason is required (no bare flag), and the release commit body MUST carry a `Skip-build: <reason>` footer so the override is permanently auditable in `git log`. Non-Unity projects defer to a future `.claude-release.json` build-command field (placeholder for the migration in Bucket 2); absent toolchain is **not** treated as a passing gate.

### Standalone `/claude-release:dry-run`
Preview command for iterating on changelog wording without staging anything. Composes `build-manifest.js` → changelog prompt → `verify-output.js --coverage` and prints the result inline. `--coverage` is ON in dry-run by default for maximum signal during iteration. Verify failures surface but do not auto-regenerate — the user decides whether to regenerate, hand-edit, or accept a heuristic warning. Defined in `commands/dry-run.md`; nothing on disk changes, no commits, no tags, no build-gate (dry-run has no commit to gate).

### Smell test v0.2 heuristics — v0.2.0
Three new checks added to `lib/smell.js`, all default-on, all heuristic. `scope-mismatch` fires when the Conventional Commit scope doesn't appear as a substring of any staged path. `unrelated-area-bundling` fires when a commit spans more than `--threshold-top-level-dirs` distinct top-level directories (default 5), with a built-in skip when `CHANGELOG.md` is in the staged set so release commits don't false-positive. `changelog-claims-unbacked` reverses `changelog-misses-breaking-change`: for each newly-added CHANGELOG bullet, requires at least one ≥ 5-char keyword to match somewhere in a commit subject/body or api-diff fqn. All three add smoke scenarios (now 15/15 green). `--ignore-smells` remains the user-side escape hatch for known false positives.

## Cross-cutting design notes

- **Every blocking gate needs an explicit override flag** (`--skip-build`, `--skip-coverage`, etc.) and the override must be visible in the commit body or PR description. A gate you can silently bypass is a gate that decays.
- **Prefer slash commands over git hooks.** Hooks get bypassed; commands get used. The exception is parse-commits.js as a commit-msg hook for catching malformed Conventional Commits — that's mechanical enough to belong in a hook.
- **Reuse the api-diff seam.** It's the most expensive piece of infrastructure in this plugin; new features should consume it (smell test, coverage check) rather than re-deriving the same signal.
