---
description: Orchestrate the release in a single commit. Changelog and VERSION ship with the work, not after it. No push.
allowed-tools: Bash, Read, Edit
---

# claude-release:release

**The flow is changelog-before-commit.** Build the manifest from staged work + already-committed history since the last tag, generate the section, stage the artifacts, then make ONE commit covering the work + VERSION + CHANGELOG. Tag.

The chore-release-after-the-fact pattern produces a noisy two-commit cluster (one for the work, one for the release artifacts) and is no longer the recommended path.

## Preflight

- Working tree must have **either** staged work (the release-in-flight case) **or** non-empty commits since the last tag (the accumulated case). Abort if neither.
- Untracked files unrelated to the release must be handled by the user first (e.g. via `.gitignore` or `git add -N`).

## Steps

1. **Build the manifest**

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" > /tmp/release-manifest.json
   ```

   If the user passed `--prerelease <id>` (or `--pre <id>`) to `/release`, forward it:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" --prerelease <id> > /tmp/release-manifest.json
   ```

   If the user passed `--bump major|minor|patch` to `/release`, forward it. This is the documented escape hatch — see "Bump-kind authority" below for when it is legitimate.

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/build-manifest.js" --bump <kind> > /tmp/release-manifest.json
   ```

   Flags can be combined: `--bump minor --prerelease rc` for the first RC of a feature release.

   The manifest reads committed history from `<last-tag>..HEAD`. Any staged work goes into the same release because it will be in the next commit.

   **Trust `manifest.next_version` and `manifest.bump_kind` verbatim. Never override them.** The manifest implements strict SemVer 2.0.0 end-to-end and is the single source of truth for the next version.

   How the manifest classifies (combined `compute-bump.js` + `build-manifest.js`):
   - Any commit in range has a breaking marker (`!` or `BREAKING CHANGE:` footer)  → **major**
   - Any `feat:` commit in range, no breaking                                       → **minor**
   - Other Conventional Commit types in range (fix, perf, refactor, …)             → **patch**
   - Zero commits in range, api-diff has removals or changes                       → **major** (likely breaking)
   - Zero commits in range, api-diff has only additions                            → **minor** (backwards-compatible feature)
   - Zero commits in range, staged work but empty api-diff                         → **patch** (non-API change)
   - Nothing staged, nothing committed                                             → abort

   You **may not** substitute your own semver opinion for the manifest's. "This feels like a feature" / "this is just a fix" / "we should hold back the minor bump" are not valid reasons. If the manifest produces a number you think is wrong, fix the manifest classifier (`compute-bump.js` / `build-manifest.js` / `parse-commits.js`) and rerun — do not patch the JSON.

   The only legitimate override paths are upstream of the manifest:
   - A breaking-change marker that `parse-commits.js` failed to detect → fix the parser.
   - An api-diff entry classified wrong by `build-manifest.js`'s promotion → fix the promotion.
   - A user explicit `--bump major|minor|patch` flag passed to `/release` (and forwarded to `build-manifest.js`). This is the documented escape hatch for cases the manifest legitimately cannot infer — typically non-Unity projects where api-diff returns null and the orchestrator has no commit signal yet (zero commits in range + staged work that is conceptually a `feat:` or breaking change). `--bump` short-circuits both the api-diff promotion and the staged-work-→-patch fallback. The user must pass it explicitly; the orchestrator does NOT invent it.

   **Pre-release status uses semver pre-release identifiers** (e.g. `v1.0.0-rc.1`, `v2.0.0-alpha.3`). It is NOT expressed by sitting at `0.x.y`. Pre-1.0 as a "we haven't stabilized yet" signal is not used by this plugin.

   The `--prerelease <id>` flag drives the pre-release flow:

   | Previous tag       | Flag passed       | Resulting `next_version`                |
   |--------------------|-------------------|-----------------------------------------|
   | `v0.3.0` (stable)  | `--prerelease rc` | `v1.0.0-rc.0` (when manifest says major) |
   | `v0.3.0` (stable)  | `--prerelease rc` | `v0.4.0-rc.0` (when manifest says minor) |
   | `v1.0.0-rc.0`      | `--prerelease rc` | `v1.0.0-rc.1` (next RC in same series)   |
   | `v1.0.0-rc.0`      | `--prerelease beta` | `v1.0.0-beta.0` (rename the pre-release series) |
   | `v1.0.0-rc.5`      | *(no flag)*       | `v1.0.0` (graduate to stable; the commit-signal `kind` is reported as `graduate` and is informational only) |
   | `v0.3.0` (stable)  | *(no flag)*       | bump per commit signal (the normal flow) |

   "Graduate" is the official term in the manifest — `bump_kind: 'graduate'` signals the orchestrator that the version is dropping its pre-release identifier rather than incrementing a number. Treat it the same as any other manifest-decided bump: use it verbatim.

2. **Generate the section**

   See `changelog.md` for the prompt and validation. The model may use `(v<next_version>)` as a reference token for bullets describing content that lives in the about-to-be-made commit. Bullets describing already-committed work in the range must use the real commit hash.

3. **Build-gate (REQUIRED unless `--skip-build`)**

   Verify the project compiles before staging release artifacts. A release that doesn't compile is the worst kind of release commit — the gate runs *before* anything is staged so a failure costs zero churn.

   For Unity projects:

   - Invoke the `assets-refresh` skill — triggers a domain reload and waits for compilation via the request's `requestId`. Returns when Unity finishes.
   - Invoke `console-get-logs` filtered to `Error` log type since the refresh started. **Any errors → gate FAILS.** Surface every error to the user verbatim.
   - If the user invoked `/release` with `--with-tests`, also run `tests-run` mode=`EditMode`. **Any failed tests → gate FAILS.**

   For non-Unity projects: defer to the build command declared in `.claude-release.json` (consumer-side config; not yet implemented in v0.1.x). If no config and no MCP skills are available, emit a one-line warning and continue — *do not* silently treat absence-of-toolchain as a passing gate.

   **If the gate fails:**
   - Print the errors. Do not stage anything. Abort the flow.
   - The user fixes the failure and re-invokes, OR explicitly re-invokes with `--skip-build "<reason>"`.

   **If `--skip-build "<reason>"` is supplied:**
   - The reason is required (no bare flag). Reject the flag and abort if it's empty or missing.
   - The release commit body **MUST** include a `Skip-build: <reason>` footer line. This makes the override permanently auditable via `git log`. Compose the footer into the proposed commit message in Step 5.

3.5. **Release gates (REQUIRED — refuses an inconsistent ship)**

   After the build compiles but *before* staging, evaluate the Captain SDLC release gates against HEAD. They read upstream signals — ATH smoke results (from the `.captain-sdlc/` trace) and a dependency audit — and refuse a release that contradicts them. Like the build-gate, they run before anything is staged, so a block costs zero churn. (Seam 3 — see `seam-release-gates.md` in the Captain SDLC docs.)

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/evaluate-gates.js" > /tmp/release-gates.json; echo "exit: $?"
   ```

   Forward any override flags the user passed to `/release` verbatim, e.g.:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/lib/evaluate-gates.js" \
     --force-release --override 'smoke_results_pass:known flake, manually verified' \
     > /tmp/release-gates.json; echo "exit: $?"
   ```

   The tool prints a JSON summary (`decision`, an `aggregate` verdict in the standard gate shape, each gate's verdict, and `overridden_blockers`) and exits:
   - **exit 0** — `decision: "proceed"`. All gates pass, or every blocking failure was explicitly overridden. Continue to Step 4.
   - **exit 1** — `decision: "blocked"`. A blocking gate failed and was not overridden. **Print the failing gate(s) and their `reason` verbatim. Do not stage anything. Abort the flow.** The user fixes the upstream problem and re-invokes, OR re-invokes with an explicit per-gate `--override`.
   - **exit 2** — usage/config error (empty override reason, override of a non-blocking gate, `--override` without `--force-release`, or a malformed `.captain-sdlc/release-gates.yaml`). Surface the stderr message; do not proceed until it's corrected.

   Gate config is read from `.captain-sdlc/release-gates.yaml` if present; absent, defaults apply (`smoke_results_pass` blocking; `dependency_audit` blocking, but `not_applicable` when there's no `package.json`).

   **If any `--override` was used (exit 0 with a non-empty `overridden_blockers`):**
   - The reason is required and was already validated by the tool.
   - The release commit body **MUST** include one `Gate-override: <gate> <reason>` footer line per overridden gate — permanently auditable via `git log`, mirroring `Skip-build:`. Compose these into the proposed commit message in Step 5.
   - The per-release `release.gate.summary` / `release.gate.override` trace events are a planned fast-follow (now that M2 ships the trace substrate); this cut records the override in the commit message only.

4. **Stage the release artifacts alongside the work**

   ```bash
   # VERSION file at repo root
   printf '%s\n' "<next_version>" > VERSION

   # Prepend the verified section to CHANGELOG.md (under the file header, above prior releases)
   # ... see CHANGELOG.md handling in changelog.md

   git add VERSION CHANGELOG.md
   ```

   Plus any project-specific version surfaces (e.g. for Unity, `ProjectSettings/ProjectSettings.asset` `bundleVersion`; for Node, `package.json` `version`). The skill does not auto-edit those — flag them in the plan so the user knows what to bump.

5. **Show the plan and require explicit confirmation:**

   - Files to be staged (work + VERSION + CHANGELOG.md + any project version file)
   - Commit subject: a Conventional Commit summarizing the release
     - For releases that introduce new functionality: `feat: <subject>` (or `feat(<scope>):`)
     - For pure maintenance/cleanup releases with no staged work: `chore(release): <next_version>`
   - If `--skip-build` was used, the commit body MUST include the `Skip-build: <reason>` footer — show it to the user as part of the plan.
   - If any release gate was overridden, the commit body MUST include a `Gate-override: <gate> <reason>` footer per override — show them as part of the plan.
   - Annotated tag: `<next_version>` with message `Release <next_version>`

6. **Apply in order:** commit, then tag.

7. **Print** (do not run):

   ```
   git push --follow-tags origin <branch>
   ```

## Aborts

- Dirty unstaged changes that aren't part of the release → abort with a message; user stashes or stages.
- Empty manifest AND no staged work → abort cleanly, no no-op tag.
- `changelog` validation fails twice → abort, do not commit or tag.

## Never

- Push to remote.
- Amend or rewrite existing tags.
- Force-push.
- Skip git hooks.
- Bypass the build-gate without a `--skip-build "<reason>"` invocation. A silently-skipped gate is a gate that decays.
- Bypass a *blocking* release gate without an explicit, reason-carrying `--override`. There is no force-everything flag; override per gate, and the reason lands in the commit body.
- Override `manifest.bump_kind` or `manifest.next_version` on your own semver judgment. The manifest is authoritative; see Step 1 for the only valid override conditions.

## Why changelog-before-commit

The release artifacts (CHANGELOG entry, VERSION file, language-specific version surface) describe what the release IS. They belong in the commit that creates the release, not in a follow-up. Splitting them produces a transient "v0.1.0 work without v0.1.0 metadata" state on HEAD, which is wrong if anyone reads the tree between the two commits.

## Tags vs GitHub Releases

This plugin creates **annotated git tags** for every release. Git tags are the canonical, immutable record of every version — one tag per `manifest.next_version`, applied to the release commit.

**GitHub Releases** (the `gh release create` surface) are reserved for **milestones and release candidates** — curated markers like `v1.0.0-rc.1`, `v1.0.0`, or a major roadmap milestone. Not every tag becomes a GitHub Release. This plugin does **not** auto-create GitHub Releases; that's the user's call per milestone.

Practical implication: when you run `/release`, expect a tag and only a tag. If a milestone or RC is being cut, the user follows up with `gh release create <tag> --notes-from-tag` (or equivalent) separately.
