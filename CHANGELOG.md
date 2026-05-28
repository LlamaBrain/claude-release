# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-28

Initial extraction from the BeforeTheShade host project. The plugin previously lived under `<host>/.claude/plugins/claude-release/`; this 0.1.0 release establishes it as a standalone package distributed via its own marketplace.

### Added

- `/claude-release:commit` — propose a Conventional Commit from the staged diff. LLM proposes; the smell test gates the commit. (v0.1.0)
- `/claude-release:smell` — pre-flight quality check on a proposed or existing commit. Advisory; `/commit` calls the same library and blocks on warnings unless `--ignore-smells`. (v0.1.0)
- `/claude-release:bump` — compute next version from commits since last tag. No LLM. `--apply` writes `VERSION`. (v0.1.0)
- `/claude-release:changelog` — generate a Keep-a-Changelog v1.1.0 section. LLM proposes; manifest verifies every hash and structural claim. (v0.1.0)
- `/claude-release:release` — orchestrate bump + changelog + commit + annotated tag, in a single commit. No push. (v0.1.0)
- `/claude-release:audit` — lint commits for Conventional Commit compliance. Pure script, CI-friendly. (v0.1.0)
- `/claude-release:dry-run` — preview the next release's manifest, section, and verify report without staging anything. Coverage check is ON by default for iteration signal. (v0.1.0)
- `lib/api-diff.js` — Roslyn-backed C# API diff comparing the previous tag against the current release-in-flight workspace; surfaces shape changes that commit messages may have missed. Falls back silently when `dotnet` is absent. (v0.1.0)
- `lib/smell.js` — five v1 commit-quality checks: `conventional-malformed`, `api-break-no-marker`, `breaking-marker-no-description`, `thin-subject-on-substantive-diff`, `changelog-misses-breaking-change`. (v0.1.0)
- `lib/verify-output.js --coverage` — opt-in coverage check that groups manifest commits by Conventional-Commit scope and requires each scope to be represented in the section. Heuristic; off by default to avoid regressing existing pipelines. (v0.1.0)
- `commands/release.md` build-gate (Step 3) — verifies the project compiles before staging release artifacts. Unity path uses `assets-refresh` + `console-get-logs`; `--with-tests` opt-in also runs `tests-run` EditMode. Override is `--skip-build "<reason>"`, recorded as a `Skip-build:` footer in the commit body. (v0.1.0)

### Notes on portability

- `lib/dotnet/ApiDiff/` does **not** ship a `NuGet.config`. Consumers with non-default NuGet sources may need to provide one locally. The dotnet build defaults to `nuget.org`.
- `lib/api-diff.js` path filtering (`isIncludedCsPath`) excludes Unity-flavored directories (`Packages/`, `Library/`, `Temp/`) by default. These are sensible no-ops for non-Unity C# repos; consumer-side configuration is a future feature.

[Unreleased]: https://github.com/LlamaBrain/claude-release/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.0
