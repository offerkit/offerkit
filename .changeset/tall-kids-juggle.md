---
"@offerkit/sdk": patch
"@offerkit/mcp": patch
"@offerkit/cli": patch
---

Path-bearing SDK procedures now use oRPC's detailed input structure. Pass path values under `params`, request payloads under `body`, and query parameters under `query` for routes such as `vouchers.get({ params: { code } })`, `campaigns.update({ params: { id }, body: { patch } })`, and `referrals.listCodes({ params: { programId }, query: { limit } })`.

CLI and MCP callers were updated for the detailed contract shape, and `/api/openapi.json` now emits the generated OpenAPI document instead of an empty stub.
