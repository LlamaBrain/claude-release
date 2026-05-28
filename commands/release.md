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

   The manifest reads committed history from `<last-tag>..HEAD`. Any staged work goes into the same release because it will be in the next commit.

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

## Why changelog-before-commit

The release artifacts (CHANGELOG entry, VERSION file, language-specific version surface) describe what the release IS. They belong in the commit that creates the release, not in a follow-up. Splitting them produces a transient "v0.1.0 work without v0.1.0 metadata" state on HEAD, which is wrong if anyone reads the tree between the two commits.
