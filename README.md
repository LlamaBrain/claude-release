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

## API compatibility evidence

`node plugin/lib/build-manifest.js --baseline v1.2.3 --target <revision>` compares an existing stable SemVer tag against an exact target commit. Use `--baseline latest-stable` to select the highest reachable stable tag; equally ranked aliases are rejected. Both must resolve, and the baseline must be an ancestor. `--type-map <trusted-policy-json>` optionally supplies an object mapping Conventional Commit types to `none`, `patch`, or `minor`; explicit breaking changes and API evidence still take precedence. The caller must source this mapping from trusted repository policy. The manifest records the resolved `baseline_revision` and `target_revision`; release version is derived from the baseline tag. `--prerelease rc` generates an RC version. Without explicit revisions, legacy calls still use the latest reachable tag and the working tree. For a repository with no prior release tag, configure an explicit initial baseline using `--baseline-ref <full-oid> --baseline-version <stable-version> --baseline-surface <path> --target <revision>`. The baseline commit must contain that version in the named text file; for JSON add `--baseline-pointer /version`. This declares a starting point and does not create or imply a historical release tag.

For a Captain-created landing preview only, the trusted host can pass `--preview-wrapper <full-oid>` together with that exact `--target` and its parent as `--compatibility-base`. The engine verifies the fixed preview commit shape and retains all transported source changes, while excluding the synthetic wrapper summary. The manifest records `preview_wrapper`; the host must authenticate the preview and reject an unexpected selector. This option is not an authorization mechanism.

`api_analysis.status` is `analyzed` or `unavailable`. On unavailable analysis, `api_diff` is null, not evidence of compatibility. API removals or signature changes raise PATCH or MINOR to MAJOR; additions can raise PATCH to MINOR. The default `--api-posture binary` conservatively treats changed signatures as binary breaks. `--api-posture source` permits only detected optional appended parameters as source compatible; choose it only when binary compatibility is not a supported contract. Existing `--bump` cannot lower commit or API evidence. For a task-specific comparison, add `--compatibility-base <revision>`: `compatibility_analysis` and `compatibility_diff` separately describe that exact base and target, while stable-baseline analysis remains in force. Consumers must check both statuses when both are requested. For exact committed comparisons, each analyzed report also includes `source_fingerprints` with SHA-256 values for the base and target content selected by the same Roslyn C# path filter. A null fingerprint means it was unavailable. These fingerprints support authenticated revalidation only; they do not cover serialization, saves, mod APIs, or other configured contracts. Graduating a prerelease fails when API analysis is unavailable or detects changes that need a stable baseline.

Squash commits can preserve original messages with a single `Captain-Changes` trailer containing base64url UTF-8 JSON `{ "schema_version": 1, "commits": [{ "oid": "<full source OID>", "message": "<full Conventional Commit message>" }] }`. The manifest expands these messages and rejects malformed entries or duplicate source IDs. This payload alone does not prove the host retained the expected content: Captain must compare the landed trailer to its verified change set.

The API analyzer covers C# source symbols only; it does not establish Unity serialization, player-save, package, mod, or other consumer contract compatibility. Callers must require and report their configured evidence. In particular, a project may treat unreleased internal save schemas as outside its supported compatibility contract.

`adjudicateRelease` is an in-process API exported by the finalizer module. Its caller must authenticate the signed decision against the exact observed report, compatibility base and target and explicitly confirm that it covers **all findings**. A rejection recomputes the effective version from the remaining non-breaking evidence while retaining the original major classification and decision provenance. A request to revise returns no release manifest. A raw request JSON file cannot authorize this operation; Captain must sign the resulting effective manifest before it is used. Projects with an explicitly not-applicable C# contract must supply their captured-policy rationale through the trusted verifier callback.

`node plugin/lib/prepare-artifacts.js --request request.json` returns a JSON map of proposed file contents without writing files. The request contains the exact manifest, `surfaces` entries with `path`, `kind` (`text`, `unity`, `doxygen`, `json`, or `literal`) and current `content`, and a `changelog` with `path` and `content`. JSON surfaces use `pointer` and optional `mirrors` arrays of RFC 6901 pointers; JSON is reserialized on change. Literal surfaces use nonempty `prefix` and `suffix` strings and must match exactly once. It rejects unavailable API analysis, stale version surfaces and release-version collisions. This is a preview/preparation operation; Captain must validate the evidence for all supported contracts and gate any breaking change before promotion.

`node plugin/lib/finalize-release.js --request request.json` checks the exact release commit, the caller-supplied verified revision, the local production branch, provenance and configured artifacts without creating a tag. It derives expected version surfaces and changelog contents from the immutable source revision, rejecting deleted or rewritten history and file-mode changes; a new changelog is seeded as `# Changelog\n`. Its request supplies `repo`, `manifest`, `releaseRevision`, `verifiedRevision`, `branchRef`, `surfaces` (path and kind), and `changelogPath`. Append `--tag` only when the caller has validated the trusted verification receipt and has authority to tag: the action creates or verifies an annotated local tag in a transaction that checks the branch ref. The verified revision argument is an assertion, not authenticated proof. The CLI requires the release target to be an ancestor; ancestry-losing squash promotions fail closed. The module API accepts an optional trusted in-process `verifySquash(context)` callback for a non-ancestor target; it must validate Captain signed evidence, actual landed payload and footer relationships at the exact source and destination before returning `true`. Request JSON cannot supply this callback. Captain must compose and authenticate that callback before using it.

For staging RCs, provide `--candidate-ref refs/heads/<stage> --candidate-head <full-oid> --candidate-version-surface <path> --candidate-changelog <path> --prerelease rc`, with `--candidate-pointer` for a JSON version surface. The engine reads only that pinned Git tree, reuses the same RC for the same target, increments a changed target in the same series, and rejects a moved stage ref. The promotion coordinator must compare-and-swap against the pinned stage head; this local check alone cannot reserve a remote version.

These commands do not create promotion PRs, authenticate compatibility decisions, publish artifacts, or verify remote branch protections. Those workflows require integration with Captain.
## Releasing

This repo releases itself with its own `/claude-release:release`: the changelog entry and version bumps ship in the **same commit** as the work, followed by an annotated tag. It never pushes — that stays a deliberate, manual `git push --follow-tags origin main`. See [`plugin/CHANGELOG.md`](plugin/CHANGELOG.md) for history and [`plugin/ROADMAP.md`](plugin/ROADMAP.md) for shipped and planned work.

## Part of Captain SDLC

claude-release is the **release blade** of [Captain SDLC](https://github.com/LlamaBrain/captain-sdlc), an AI-driven SDLC tooling pipeline: independent tools that share conventions (trace schemas, fenced-block formats), not code, so each can be adopted on its own. Sibling tools: [claude-interrogate](https://github.com/michael-tiller/claude-interrogate-src) (design), [ai-test-harness](https://github.com/LlamaBrain/ai-test-harness) (QA), and [MToolKit](https://github.com/michael-tiller/MToolKit) (runtime foundation).

## License

Released under the [MIT License](LICENSE.md). © 2026 Michael Tiller.
