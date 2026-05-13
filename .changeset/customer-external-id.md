---
"@offerkit/sdk": minor
---

Add `externalId` to the customer model, plus two new SDK routes:

- `customers.upsert({ externalId, email?, name?, … })` — idempotent on `externalId`. Returns `{ customer, created }` so callers can branch on first-vs-subsequent.
- `customers.getByExternalId({ externalId })` — lookup by integrator-supplied id, returns 404 if not found.

`customers.create` and `customers.update` now also accept `externalId`. `customerOutput` returns it as `externalId: string | null`.

This lets integrators stay stateless on their side: pass your own user id as `externalId` and never store the OfferKit-minted UUID. Replaces the email-lookup-then-create pattern that was fragile (substring search, email change handling).
