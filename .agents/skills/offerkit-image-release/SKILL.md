---
name: offerkit-image-release
description: Release and verify a stable OfferKit Docker image through the repository's versioned image workflow. Use when the user asks to publish or re-publish a stable OfferKit image version, create its GitHub release, change the latest stable image, or verify GHCR tags, visibility, digest, platform, or runtime contents after an image release.
---

# OfferKit Image Release

Release only when the user explicitly authorizes it. Use `.github/workflows/release-image.yml` for stable versions; do not replace this with the edge-image workflow.

## 1. Establish release inputs

- Run `git status --short --branch` and `git fetch origin`.
- Inspect `.github/workflows/release-image.yml`; it is the source of truth if this skill has drifted.
- Confirm the requested version is plain semver such as `0.2.0` and confirm the exact source ref or commit.
- Resolve the ref to an immutable commit and report it before dispatch.
- Check whether `v<version>` already exists. Stop if it points to a different commit.

## 2. Verify the documentation snapshot

The stable image workflow requires documentation for the release minor:

- Confirm `apps/site/versions.json` names the release minor as `latest`.
- Confirm `apps/site/content/versions/<minor>/index.mdx` exists.
- If the snapshot is missing, stop and prepare or request the documentation promotion before releasing.

## 3. Publish

- Dispatch `.github/workflows/release-image.yml` with the confirmed version and ref.
- Monitor the selected run through tag creation, Docker build, GHCR push, and GitHub release creation.
- The supported platform is `linux/amd64`. Do not add ARM or change platforms unless explicitly requested.
- The released image remains the single runtime image for both web and worker.
- Do not retry a failed workflow until its tag, GHCR, and GitHub release side effects are known.

## 4. Verify GHCR and the release

Verify all tags expected from the workflow:

- `ghcr.io/offerkit/offerkit:v<version>`
- `ghcr.io/offerkit/offerkit:<version>`
- `ghcr.io/offerkit/offerkit:latest`
- `ghcr.io/offerkit/offerkit:sha-<short-source-sha>`

Then verify:

- The tags resolve to the workflow's published digest.
- The runtime manifest advertises `linux/amd64` unless the request changed the platform contract. Ignore BuildKit provenance entries reported as `unknown/unknown` when identifying runtime platforms.
- An unauthenticated client can inspect or pull the image. Use an isolated empty Docker config so cached credentials do not make this check pass falsely.
- The GitHub release `v<version>` exists, is marked latest, targets the source revision, and includes the digest and deployment notes.

If a Docker daemon is available, pull the versioned image and verify the built artifact:

- The configured default command starts `apps/web/server.js`.
- `apps/web/server.js` exists.
- `apps/worker/dist/index.js` exists and can be selected as the worker command.

Do not substitute a local source build for verification of the published digest. If the daemon or deployment environment is unavailable, report that exact gap rather than calling the artifact exercised.

## 5. Verify deployments when included

When the request includes deployment, verify the actual public environment rather than stopping at GHCR:

- Preserve the configured service and Worker names.
- Preserve web and worker commands, domains, health checks, and shared secrets.
- Exercise the public URL and the relevant readiness or health surface.

Deployment verification is required only when deployment is part of the user's requested finish line.

## Completion report

Report:

- Version and immutable source revision
- Workflow URL and conclusion
- GHCR digest, tags, platform, and anonymous availability
- GitHub release URL and state
- Runtime artifact or deployment checks performed
- Any exact verification that could not be performed

Do not describe the release as complete while the published image or any requested deployment surface remains unverified.
