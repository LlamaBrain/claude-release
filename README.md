# claude-release

Conventional Commits → semver → Keep-a-Changelog release flow for [Claude Code](https://claude.com/claude-code), with **manifest-verified LLM output**. Seven slash commands; only two (`/commit` and `/changelog`) touch an LLM — and even those are adjudicated against a manifest of real commit hashes, so the model writes the prose but a script decides what is true.

This is the development repository. For the full plugin reference — every command in depth, the API-diff feature, the build-gate, edge cases — see **[`plugin/README.md`](plugin/README.md)**.

## Install

```
/plugin marketplace add LlamaBrain/claude-release
/plugin install claude-release@llamabrain-release
```

Requires Node ≥ 18. There is **no `npm install` step**: `plugin/lib/` ships pre-bundled with its dependencies inlined, so the plugin runs the moment it is installed. The optional API-diff feature additionally needs the .NET SDK (`dotnet` on `PATH`); its first run does a one-time NuGet restore.

## Commands

| Command | What it does | LLM |
|---------|--------------|:---:|
| `/claude-release:commit`    | Propose a Conventional Commit from the staged diff; the smell test gates it. | ✅ |
| `/claude-release:changelog` | Generate a Keep-a-Changelog section; the manifest verifies every hash and claim. | ✅ |
| `/claude-release:smell`     | Advisory quality check on a proposed or existing commit. | — |
| `/claude-release:bump`      | Compute the next semver from commits since the last tag. | — |
| `/claude-release:release`   | Orchestrate bump + changelog + build-gate + commit + annotated tag, in one commit. No push. | — |
| `/claude-release:dry-run`   | Preview the next manifest, section, and verify report. No staging. | — |
| `/claude-release:audit`     | Lint commits for Conventional Commit compliance. CI-friendly. | — |

Each command is documented in full in [`plugin/README.md`](plugin/README.md).

## The contract is the manifest

`bump` builds a manifest from the commits since the last tag; `changelog` consumes it. Every bullet in a generated changelog must trace back to a real `manifest.commits[*].hash` or to `manifest.api_diff` — `verify-output.js` enforces this and rejects:

- hallucinated commit hashes,
- editorializing not present in any commit body,
- headers outside the Keep-a-Changelog v1.1.0 vocabulary,
- (with `--coverage`) any Conventional-Commit scope that no bullet represents.

The LLM writes prose; the script adjudicates truth. That cross-check is the differentiator versus tools that generate notes and trust them.

## Repository layout

```
src/                              Hand-edited sources (the real code)
scripts/
  bundle.mjs                      esbuild — bundles each entry point into plugin/lib/
  entry-points.mjs                Canonical list of shipped entry points (single source of truth)
  verify-release-readiness.mjs    The release-readiness gate
plugin/                           The published plugin (this is what the marketplace installs)
  lib/*.js                        Self-contained bundles built from src/ (deps inlined)
  lib/dotnet/ApiDiff/             Roslyn-backed C# API differ (built on demand)
  commands/*.md                   The seven slash commands
  .claude-plugin/plugin.json
  README.md  CHANGELOG.md  ROADMAP.md  VERSION
.claude-plugin/marketplace.json   Marketplace manifest (points at ./plugin)
tests/                            Smoke tests
```

`src/` is edited by hand; `plugin/lib/` is **generated** — never edit it directly. `scripts/bundle.mjs` inlines `semver` and `conventional-commits-parser` so the published runtime needs no `node_modules`.

## Developing

```bash
npm install                # build-time deps (esbuild + the libraries to inline)
npm run bundle             # src/ → plugin/lib/*.js
npm run check:release      # gate: version consistency + self-contained bundles
npm run prepare:release    # bundle + check:release

node tests/test-smell-smoke.js          # smell checks
node tests/test-api-diff-pair-smoke.js  # additive-pair API classifier
node tests/test-release-gates-smoke.js  # release-gate primitives
node tests/test-api-diff-smoke.js       # Roslyn API differ (requires dotnet)
```

`check:release` treats `plugin/VERSION` as canonical and fails if any of the six version surfaces (`VERSION`, `marketplace.json`, `plugin.json`, `package.json`, and `package-lock.json` ×2) drift, or if any bundled entry point imports something beyond the Node builtins.

## Releasing

This repo releases itself with its own `/claude-release:release`: the changelog entry and version bumps ship in the **same commit** as the work, followed by an annotated tag. It never pushes — that stays a deliberate, manual `git push --follow-tags origin main`. See [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) for history and [`plugin/ROADMAP.md`](plugin/ROADMAP.md) for shipped and planned work.

## Part of Captain SDLC

claude-release is the **release blade** of [Captain SDLC](https://github.com/LlamaBrain/captain-sdlc), an AI-driven SDLC tooling pipeline: independent tools that share conventions (trace schemas, fenced-block formats), not code, so each can be adopted on its own. Sibling tools: [claude-interrogate](https://github.com/michael-tiller/claude-interrogate-src) (design), [ai-test-harness](https://github.com/LlamaBrain/ai-test-harness) (QA), and [MToolKit](https://github.com/michael-tiller/MToolKit) (runtime foundation).

## License

Released under the [MIT License](LICENSE.md). © 2026 Michael Tiller.
