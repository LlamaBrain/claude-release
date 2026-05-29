# claude-release

Conventional Commits → semver → Keep-a-Changelog release flow for [Claude Code](https://claude.com/claude-code), with manifest-verified LLM output. Seven slash commands; only two (`/commit` and `/changelog`) touch an LLM.

## Install

```
/plugin marketplace add LlamaBrain/claude-release
/plugin install claude-release@llamabrain-release
```

Requires Node ≥ 18. No `npm install` step — `lib/` ships pre-bundled with its dependencies inlined, so the plugin runs as soon as it is installed.

For the optional API-diff feature, the .NET SDK (`dotnet` on `PATH`) is required; first run does a one-time NuGet restore.

## Commands

- `/claude-release:commit` — propose a Conventional Commit from the staged diff. LLM proposes; the smell test gates the commit.
- `/claude-release:smell` — pre-flight quality check on a proposed or existing commit. Advisory; `/commit` calls the same library and blocks on warnings.
- `/claude-release:bump` — compute next version from commits since last tag. **No LLM.** `--apply` writes `VERSION`.
- `/claude-release:changelog` — generate a Keep-a-Changelog section. LLM proposes; manifest verifies every hash and structural claim.
- `/claude-release:release` — orchestrate bump + changelog + build-gate + commit + annotated tag, in a single commit. **No push.**
- `/claude-release:dry-run` — preview the next release's manifest, section, and verify report with coverage on. **No staging.**
- `/claude-release:audit` — lint commits for Conventional Commit compliance. Pure script, CI-friendly.

## The contract is the manifest

`bump` builds it. `changelog` consumes it. Every claim in the generated changelog must trace back to either `manifest.commits[*]` or `manifest.api_diff` — `verify-output.js` enforces this.

- Hallucinated hashes fail.
- Editorializing not present in any commit body fails.
- Headers outside the Keep-a-Changelog v1.1.0 vocabulary fail.
- With `--coverage`, every Conventional-Commit scope must be represented by at least one bullet (hash ref or ≥5-char subject-keyword match).

The LLM writes prose; the script adjudicates truth. That cross-check is the actual differentiator versus tools that generate prose and trust the output.

## API diff (optional)

`api-diff.js` runs a Roslyn-backed C# diff when the .NET SDK is available, surfacing API-shape changes that commit messages may have missed (a renamed public method, a removed `[SerializeField]`, a parameter added to a public ctor, etc.). It compares the previous tag against the **current release-in-flight workspace** — `/changelog` and `/release` run before the release commit, so HEAD would miss the staged work the manifest is meant to describe.

- **Requires** the .NET SDK on PATH. First run does a one-time NuGet restore (~10s); subsequent runs are subsecond on a small tree.
- Scans tracked `.cs` files at the previous ref and in the worktree; ignores untracked-only files so scratch code doesn't leak into release notes.
- Excludes `Packages/`, `Library/`, `obj/`, `bin/`, `Temp/`, any `Editor/` or `Tests/` segment, and generated filenames (`*.Generated.cs`, `*.Designer.cs`, `*.g.cs`, etc.). These defaults are Unity-flavored but no-op cleanly on non-Unity C# repos.
- Includes `[SerializeField]` private/internal fields — they are Unity's prefab/scene contract, and silently renaming one breaks every prefab that references it.
- **Conditional code (`#if UNITY_EDITOR`, platform symbols, custom defines) is parsed with default preprocessor settings**, so conditional APIs may be over-reported. Project-aware parsing is a future concern.
- Falls back silently (single stderr warning) when `dotnet` is absent or any step fails. Commands then degrade to commit-message signals — the same path non-C# repos take.

A scripted smoke test for it lives in the source repo at `tests/test-api-diff-smoke.js`.

## Build-gate (Unity-specific path)

`/claude-release:release` Step 3 verifies the project compiles before staging release artifacts. For Unity projects, it invokes the host's `assets-refresh` and `console-get-logs` skills; with `--with-tests` it also runs `tests-run` (EditMode). Override is `--skip-build "<reason>"` — the reason is required and lands as a `Skip-build:` footer in the commit body, permanently auditable in `git log`. Non-Unity projects defer to a future `.claude-release.json` `build-command` field (placeholder; not yet implemented).

## Edge cases handled

- **Squash merges** — full body parsed; multi-CC bodies surface the top-level type, raw kept for re-parse.
- **Reverts** — detected via `Revert "<header>"` pattern; both revert and target dropped from the manifest so they don't show as a doubled non-event.
- **No prior tag** — first-release path defaults next version to `v0.1.0`.
- **Empty bumps** — `bump_kind: "none"`; `release` aborts cleanly without a no-op tag.
- **Non-conventional commits in range** — `audit` reports them; downstream commands include them implicitly only via their hashes (the changelog model will be unable to bucket them without a Conventional type, surfacing the problem in verification).

## What it deliberately does **not** do

- Push to remote.
- Amend or rewrite tags.
- Skip git hooks.
- Force-push.
- Retry LLM generation more than once on validation failure (after two failures, the human writes it).
- Bypass the build-gate without a recorded `--skip-build "<reason>"`.

## Roadmap

See `ROADMAP.md` for shipped and planned work.
