---
name: offerkit-package-release
description: Release and verify OfferKit's public npm packages through Changesets and the trusted-publishing GitHub workflow. Use when the user asks to publish or release @offerkit/sdk, @offerkit/cli, or @offerkit/mcp; asks to merge package release changes; or asks to verify a package or live CLI/MCP surface after publication.
---

# OfferKit Package Release

Release only when the user explicitly authorizes it. Treat merged code, a dispatched workflow, and a green build as intermediate states; completion requires npm and public-surface verification.

## 1. Establish release inputs

- Run `git status --short --branch` and `git fetch origin`.
- Inspect `.github/workflows/release.yml`; it is the source of truth if this skill has drifted.
- Run `pnpm changeset status --verbose`.
- Confirm the exact packages, bump types, and expected versions match the request.
- If a public behavior changed without a changeset, add the smallest accurate changeset before proceeding.
- Do not run `pnpm version-packages` locally for the release. The workflow consumes pending changesets in its runner and commits version bumps only after publication succeeds.

Stop if there are no intended pending releases or the calculated package set differs from the requested scope.

## 2. Prepare and merge

- Base release preparation on current `origin/main`; account for detached or stale worktrees.
- Run targeted tests, typechecks, and builds for the packages and shared contracts affected by the release.
- Reuse an existing PR when one already contains the release inputs. Do not create duplicate PRs.
- When the user requested merge, wait for the relevant checks and confirm the PR is merged on GitHub.
- A local worktree error after `gh pr merge` does not prove the GitHub merge failed. Check `gh pr view` before retrying.

## 3. Publish

- Confirm the pending changesets are present on `main`.
- Dispatch `.github/workflows/release.yml` on `main`.
- Monitor the selected run through build, trusted publication, version-bump commit, and GitHub release creation.
- If local `npm whoami` returns `401`, continue through GitHub trusted publishing; local npm authentication is not the release mechanism.
- Do not retry a failed workflow until its failing step and resulting npm/main state are known.

## 4. Verify the published result

For every package expected to publish:

- Verify `npm view <package>@<expected-version> version`.
- Verify the package's GitHub release exists and targets the release commit.
- Verify the workflow's version-bump commit is on `origin/main`.

Also verify the surface that motivated the release:

- For CLI changes, execute the published CLI version or inspect its published command/help surface.
- For MCP changes, run the published MCP package or re-fetch the live MCP tool schema used by the requester.
- For SDK export changes, verify the published package's exports and the relevant import or require path.

Do not substitute the source tree or local workspace package for the published artifact.

## Completion report

Report:

- Published packages and versions
- PR and merge state, when applicable
- Release workflow URL and conclusion
- Release commit on `main`
- Published CLI, MCP, or SDK behavior verified
- Any exact verification that could not be performed

Do not describe the release as complete while any requested package or public surface remains unverified.
