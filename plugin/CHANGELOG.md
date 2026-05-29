# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Release-readiness gate — `scripts/verify-release-readiness.mjs`, wired to `npm run check:release` and `prepare:release`.** The script `package.json` already pointed at but that never existed. Two guards, each closing a bug class this project actually shipped: (1) **version consistency** — `plugin/VERSION` is treated as canonical and must match `.claude-plugin/marketplace.json` (the claude-release entry), `plugin/.claude-plugin/plugin.json`, `package.json`, and `package-lock.json` (root and `packages[""]`); (2) **self-contained runtime** — every bundled `plugin/lib/` entry point must exist and import nothing beyond Node builtins, so an un-inlined `semver` / `conventional-commits-parser` can never ship broken again (the `[0.3.1]` / ADR-0009 failure mode). Exits non-zero listing every problem; both guards were negative-tested. This is the release-readiness check `[0.3.2]` flagged for v0.4.0.
- **`scripts/entry-points.mjs`** — single source of truth for the published entry-point list, shared by `scripts/bundle.mjs` (what to build) and the readiness gate (what must exist and be self-contained), so the two can never disagree about what ships.

### Fixed

- **Version-surface drift synced to `0.3.2`.** `plugin/.claude-plugin/plugin.json` had lagged at `0.2.0` and `package.json` / `package-lock.json` at `0.3.1`, while `plugin/VERSION`, the git tag, and `marketplace.json` were already `0.3.2` — the same multi-version-field hazard `[0.3.2]` called out. The new release-readiness gate now fails the release if these ever diverge again.

## [0.3.2] - 2026-05-28

### Fixed

- **Marketplace.json version bumped from `0.2.0` to `0.3.2`.** v0.3.1 shipped with the bundling fix in `plugin/lib/`, the `plugin/VERSION` file bumped, the git tag at the right commit, and a CHANGELOG entry — but `.claude-plugin/marketplace.json` still advertised `0.2.0`. Claude Code's plugin system reads the marketplace version from marketplace.json, so consumers running `/plugin update claude-release` were told "already at the latest version (0.2.0)" and got the unfixed code path. Literally the same shape of bug as ADR-0009 in the captain-sdlc/ docs set — the *published* artifact told a different story than the *source*, *despite* writing the ADR to catch exactly this — caught one publish-version surface but not the other. Treating this as a real lesson: there is more than one "version" field, and a release-readiness check that diffs `package.json` / `VERSION` / `plugin.json` / `marketplace.json` for the *current* tool would have caught it. Adding that check is on the v0.4.0 list.

## [0.3.1] - 2026-05-28

### Fixed

- **Published runtime now actually runs.** v0.1.x through v0.3.0 all shipped with `plugin/lib/*.js` files that import from `semver` and `conventional-commits-parser`, expecting consumers to have `node_modules/` populated. The `.gitignore` excluded `plugin/lib/node_modules/` with a comment ("installed via `npm install` in plugin/lib/"), but Claude Code's plugin install mechanism never runs `npm install`. Every released version up to and including v0.3.0 shipped broken — invoking any entry point (`build-manifest.js`, `audit-commits.js`, `compute-bump.js`, `smell-cli.js`, `verify-output.js`) errored with `ERR_MODULE_NOT_FOUND: semver`.
- **Fix:** moved hand-edited sources from `plugin/lib/*.js` to `src/*.js`, added top-level `package.json` declaring `esbuild` as a build-time dependency, added `scripts/bundle.mjs` (esbuild-driven) that bundles each entry point into a self-contained ESM file with `semver` / `conventional-commits-parser` inlined. Bundled outputs land back at `plugin/lib/*.js`, so command invocations (`node lib/build-manifest.js`) keep working unchanged from the consumer's perspective. The `.NET` `dotnet/` subdirectory is preserved through the bundle's clean step (it has its own on-demand build flow via api-diff.js).
- **Bundling-aware CLI guard** in `src/parse-commits.js`. The previous guard (`endsWith(basename of argv[1])`) was satisfied by any bundle ending in `.js`, so when `parse-commits.js` was inlined into `build-manifest.js`, parse-commits's CLI usage message printed instead of build-manifest's JSON. Replaced with explicit-basename comparison anchored to `parse-commits.js`.
- **Build deps moved to top-level `package.json`.** `plugin/lib/package.json` and `plugin/lib/package-lock.json` are gone — they only existed to declare the runtime deps that are now inlined. Top-level `package.json` declares `semver` + `conventional-commits-parser` as `dependencies` (so esbuild can resolve them at bundle time) and `esbuild` as `devDependencies`.

### Tracked as ADR-0009 in the captain-sdlc/ docs set

Captured the broader lesson: every Captain SDLC tool's release-readiness check must verify the *published* artifact runs end-to-end, not just the source-repo tests. This is the third tool fix this session driven by the same shape of bug (interrogate v0.1.3/v0.1.4 had analogous gaps with command-markdown files and node_modules expectations). The discipline is conceptually Seam 4 (contract testing) applied to each tool's distribution boundary.

## [0.3.0] - 2026-05-28

### Added

- Pre-release identifier flow via `--prerelease <id>` (alias `--pre <id>`) on `build-manifest.js` and `compute-bump.js`. Drives the canonical strict-SemVer pre-release lifecycle: stable → `vX.Y.Z-id.0` (first RC), pre-release → `vX.Y.Z-id.N+1` (next RC in series), pre-release → stable (graduate by re-running without the flag). The manifest carries `prerelease_id` and `previous_is_prerelease` fields so the orchestrator can present an honest plan, and `bump_kind: 'graduate'` is reported when a pre-release version drops its identifier on its way to stable. `release.md` documents the full flow with a transition table. (v0.3.0)
- `--bump major|minor|patch` flag on `build-manifest.js` and `compute-bump.js` as the documented escape hatch for cases the manifest legitimately cannot infer — typically non-Unity projects (where api-diff returns null) with zero commits in range and staged work that is conceptually a feature or breaking change. Short-circuits both the api-diff promotion and the staged-work-→-patch fallback. The orchestrating LLM does **not** invent this flag; the user passes it explicitly to `/release`. Combinable with `--prerelease`. (v0.3.0)
- New `applyBump(prev, kind, prereleaseId)` helper exported from `compute-bump.js` so both `compute-bump` and `build-manifest`'s api-diff promotion path use one canonical version-arithmetic function. Smoke-tested across 13 stable/pre-release/graduation cases. (v0.3.0)
- `release-api-break-not-marked` smell check (`lib/smell.js`) — fires when api-diff reports `removed` or `changed` entries but no commit in the manifest range carries a breaking marker. Catches `fix:` commits that secretly break the public API because the author forgot the `!` marker. Warning-severity; advisory only, not a hard fail. Wired into `runSmellChecks`. Smoke-tested across 3 new scenarios. (v0.3.0)
- `classifyRemovedAddedPairs` helper (`lib/classify-api-diff.js`) — pairs api-diff `removed` + `added` entries by their `Type.MethodName(` FQN prefix and detects strict prefix-superset signature extensions (e.g. `Foo(int)` → `Foo(int, bool = false)`). Such pairs are source-compatible and reclassified out of the breaking-change tally. 52-case smoke test (`test-api-diff-pair-smoke.js`) covers real removals, type-mismatch breaks, multi-level additive extensions, generics with embedded commas, constructors, and overload-soup tiebreaking. (v0.3.0)

### Changed

- The plugin now applies strict SemVer 2.0.0 end-to-end. Pre-release status is expressed via semver pre-release identifiers (e.g. `v1.0.0-rc.1`) — not by sitting at `0.x.y`. The "minor=breaking, patch=everything-else" pre-1.0 shortcut is explicitly not supported; `release.md` directs consumers who want that convention elsewhere. (v0.3.0)
- `release.md` Step 1 names the manifest as the single authoritative source of `bump_kind` and `next_version`. The orchestrating LLM is forbidden from overriding the manifest on its own judgment; the only legitimate fixes are upstream (in `parse-commits.js`, `compute-bump.js`, or `build-manifest.js`'s promotion) or via the explicit user-driven `--bump` flag. Matching guard added under **Never**. (v0.3.0)
- New section in `release.md`: "Tags vs GitHub Releases." Tags are versions (every release gets one); GitHub Releases are reserved for milestones / RCs and are not auto-created. (v0.3.0)
- `build-manifest.js` promotion logic now consumes `classifyRemovedAddedPairs` output: major fires on `realRemoved` (post-additive-pair reclassification) or any `changed` entry; minor fires when the only post-classification signal is `effectiveAdded`. `bump_reason` notes the additive-pair count when applicable. (v0.3.0)

### Fixed

- `api-diff.js` materializeGitRef previously passed `-- '*.cs'` as a pathspec to `git ls-tree -r --name-only`. ls-tree's pathspec semantics don't match ls-files' — `ls-tree -r -- '*.cs'` returned zero files because the glob doesn't traverse subdirectories the way the caller expected. Every prior api-diff was therefore comparing an empty previous-ref tree against the worktree, surfacing the **entire** public API as "added" on every run. This was invisible while the plugin only used api-diff as a hint and let commit signals drive bumps, but became load-bearing once `build-manifest.js` started promoting zero-commit + api-diff-additions to `minor`. Fix: drop the pathspec from both `ls-tree` and `ls-files` calls; let `isIncludedCsPath` filter on extension in JS, which it already did. (v0.3.0)
- `build-manifest.js` zero-commit promotion now classifies per strict semver based on api-diff content: removals or changes → **major** (likely breaking), additions only → **minor** (backwards-compatible feature). Previously promoted everything to `patch`, which was wrong under strict semver and led at least one dogfood release (BTS v0.2.0 → v0.3.0) to need an out-of-band override from the orchestrating LLM. (v0.3.0)
- `build-manifest.js` now also promotes zero-commit + empty-api-diff + staged work to **patch** (e.g. asset-only or internal-refactor releases). Previously these stayed at `bump_kind: none` and forced the orchestrator to either invent a version or abort. (v0.3.0)
- Additive-parameter false positive: when a C# method gains an optional default-valued parameter, the FQN changes (parameter types are baked into it), so the api-diff surfaces 1 removed + 1 added. The conservative promotion treated this as major. The new `classifyRemovedAddedPairs` detects the additive-prefix-superset shape and reclassifies the pair as a minor-bump-worthy addition, leaving only genuine removals on the major-bump tally. (v0.3.0)

## [0.2.0] - 2026-05-28

### Added

- `scope-mismatch` smell check — fires when a Conventional Commit scope (e.g. `feat(ui)`) doesn't appear as a substring of any staged path. Heuristic: scope is lowercased and matched against lowercased paths. Skipped silently when the commit has no scope. (v0.2.0)
- `unrelated-area-bundling` smell check — fires when a commit spans more than `thresholdTopLevelDirs` distinct top-level directories. Default threshold is 5. Skipped when `CHANGELOG.md` is in the staged set, since release-style commits naturally span many areas (per the releases-are-one-commit convention). (v0.2.0)
- `changelog-claims-unbacked` smell check — reverse of `changelog-misses-breaking-change`. For each newly-added `CHANGELOG.md` bullet, requires at least one ≥ 5-char keyword to match somewhere in any commit subject/body or any api-diff fqn. Bullets with no substantive keywords are skipped silently. (v0.2.0)
- `--threshold-top-level-dirs N` CLI flag on `smell-cli.js` (default 5). (v0.2.0)

### Changed

- Smell smoke fixture for the clean baseline switched from `feat(foo):` (which now trips `scope-mismatch`) to scopeless `feat:`. (v0.2.0)
- `runSmellChecks` signature gains `thresholdTopLevelDirs` (default 5). (v0.2.0)

## [0.1.5] - 2026-05-28

### Fixed

- Marketplace `name` was colliding with the plugin `name` (both were `claude-release`), making the install spec `claude-release@claude-release` — every working sibling plugin (`parallel-burn@llamabrain`, `claude-mem@thedotmack`, `claude-interrogate@michael-tiller`) keeps these distinct. Renaming the marketplace to `llamabrain-release` resolves the install ("source type unsupported" was the symptom, name collision was the cause). (v0.1.5)
- plugin.json updated to match the working sibling parallel-burn's shape: `displayName`, full `author` block (name/email/url), and an actual `license` (Apache-2.0) instead of `UNLICENSED`. (v0.1.5)

### Changed

- License set to Apache-2.0. (v0.1.5)
- **BREAKING (install command):** install via `claude-release@llamabrain-release` instead of `claude-release@claude-release`. Existing failed-install state in the user's `installed_plugins.json` for `claude-release@claude-release` is stale and unused. (v0.1.5)

## [0.1.4] - 2026-05-28

### Fixed

- Plugin source path simplified from `./plugins/claude-release` (plural, two-level) to `./plugin` (singular, single-level), matching the pattern every working third-party plugin in this Claude Code's known marketplaces uses (`thedotmack/claude-mem`, `michael-tiller/claude-interrogate`). The two-level path was rejected by Claude Code's plugin source resolver with the generic "source type unsupported" error. Verified by inspecting the live cached marketplaces — every same-repo plugin uses `"./plugin"`. (v0.1.4)

### Changed

- Repo layout: `plugin/` is now the plugin directory (was `plugins/claude-release/`). `marketplace.json` source updated accordingly. `.gitignore` paths updated. (v0.1.4)

## [0.1.3] - 2026-05-28

### Fixed

- v0.1.2's `"source": "./plugins/claude-release"` form was still rejected with "This plugin uses a source type your Claude Code version does not support." The missing pieces vs. known-working plugins (claude-mem, anthropics/claude-plugins-public/agent-sdk-dev) were on the manifest side, not the source-type side: (1) plugin entry in `marketplace.json` needs a `version` field, (2) plugin.json needs an `author` field, (3) plugin.json's `version` was stale at `0.1.0` against the actual VERSION file. All three patched in v0.1.3. (v0.1.3)

### Changed

- plugin.json gains `author`, `repository`, `homepage`, `license`, and `keywords` fields to match the conventional Claude Code plugin manifest schema. (v0.1.3)
- marketplace.json gains the `$schema` reference and a `version` field on the plugin entry, mirroring Anthropic's official `claude-plugins-public` shape. (v0.1.3)

## [0.1.2] - 2026-05-28

### Changed

- Repo restructured to host the plugin under `plugins/claude-release/` (subdirectory layout), with `marketplace.json` at the repo root. Mirrors the layout Anthropic's official `claude-plugins-public` marketplace uses. `marketplace.json` source is now the relative string `"./plugins/claude-release"` — the structured `url` source type from v0.1.1 turned out to be unsupported by older Claude Code versions ("This plugin uses a source type your Claude Code version does not support."). The relative-path string is the oldest, most compatible source form. (v0.1.2)

### Fixed

- v0.1.1's attempted fix (structured `{ "source": "url", "url": "..." }` form) did not resolve the install failure on older Claude Code versions. v0.1.2 supersedes it. (v0.1.2)

## [0.1.1] - 2026-05-28

### Fixed

- `.claude-plugin/marketplace.json` plugin source now uses the canonical structured `{ "source": "url", "url": "..." }` form. The v0.1.0 shorthand (`"source": "."`) was rejected by Claude Code with "This plugin uses a source type your Claude Code version does not support." (v0.1.1)
- **Note:** this fix was later found insufficient on older Claude Code versions and was superseded by v0.1.2's relative-path source.

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

[Unreleased]: https://github.com/LlamaBrain/claude-release/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.2.0
[0.1.5]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.5
[0.1.4]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.4
[0.1.3]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.3
[0.1.2]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.2
[0.1.1]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.1
[0.1.0]: https://github.com/LlamaBrain/claude-release/releases/tag/v0.1.0
