# OfferKit Agent Instructions

## Task boundaries

- Treat the latest explicit correction as authoritative.
- Preserve the requested mode: a review, investigation, or proposal does not authorize implementation.
- Follow the named scope, exclusions, tools, PR structure, and finish line literally.
- Do not merge, release, deploy, or create external resources unless explicitly requested.
- Once merge, release, or deployment is requested, complete and verify the entire requested workflow.
- Compare the delivered result with every acceptance criterion. Disclose deliberate deviations instead of silently redefining the requirement.

## Current state

- Fetch current remote state before assessing repository readiness or starting implementation.
- Do not validate or report against a stale checkout without identifying it as stale.
- Inspect the workflow, package, deployment, or external configuration that actually controls the requested behavior.

## Feature completeness

For contract or product behavior changes, audit every affected surface:

- Core domain logic
- Database and migrations
- Router and REST API
- Dashboard
- TypeScript SDK
- CLI
- MCP
- Documentation
- Tests
- Changesets

Do not assume support in one surface implies support elsewhere. Prefer a shared implementation or identical contract tests when adapters need the same behavior.

Add a changeset when a public package's behavior or interface changes. If a release is requested, verify the published package and live CLI or MCP surface after the workflow completes.

## Domain invariants

Test the complete data flow across the relevant combinations of:

- Internal customer ID and customer external ID
- Validation, qualification, redemption, stacking, and rollback
- Inline and queued execution
- Active, missing, and soft-deleted dependencies
- First request, retry, and simultaneous requests
- Successful and failed transaction paths

The following rules apply globally:

- Read-only operations perform no persistence.
- Missing or soft-deleted dependencies fail closed.
- Inline and queued execution preserve equivalent payloads and results.
- Idempotency is concurrency-safe.
- Secrets needed later are encrypted, not irreversibly hashed.
- Required audit and background writes are awaited or explicitly observed.
- Soft-deleted records do not prevent valid recreation.
- Money uses workspace currency and correct minor-unit semantics. Never hardcode `$`.

## Scope discipline

- Keep changes at the narrowest correct boundary.
- Do not modify shared shadcn primitives for a consumer-specific issue.
- Do not add database migrations, defaults, abstractions, labels, or generated assets unless required.
- Do not create repositories or platform resources before confirming the workflow requires them.
- If a safe narrow result is useful, deliver it and identify what remains unverified instead of repeating the same blocking question.

## UI and visual work

- Inspect the existing product and assets before redesigning.
- Derive visuals from real checkout, qualification, redemption, gift-card, loyalty, referral, targeting, and stacking flows.
- Avoid fake status overlays, rainbow decoration, excessive glow, pill-heavy layouts, repetitive floating cards, and generic SaaS dashboard mockups.
- Use the requested visual or browser tool exactly.
- Inspect visual work on desktop and mobile through the rendered URL before presenting it as complete.

## Documentation and product copy

- Organize documentation around customer outcomes before integration, deployment, operations, troubleshooting, and reference.
- Keep stable, next, and versioned documentation synchronized when the same content exists in each.
- Keep community and launch copy brief, personal, and concrete.
- When relevant, position OfferKit as an open-source, self-hostable alternative to Voucherify.

## Releases

Do not release packages or images unless explicitly requested.

- For SDK, CLI, or MCP releases, use the `$offerkit-package-release` skill.
- For stable Docker image releases, use the `$offerkit-image-release` skill.

A release is incomplete until the published artifact and its public surface have been verified.
