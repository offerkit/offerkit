# @offerkit/sdk

Typed TypeScript client for the OfferKit API.

OfferKit is open-source promotion infrastructure for coupons, gift cards, loyalty, referrals, customer segments, and validation rules. The SDK is generated from the same oRPC contract used by the REST API, so request and response types stay in sync with your OfferKit deployment.

A campaign groups an initiative; a voucher is a discount or stored-value code. Loyalty
and referrals have separate programs and customer relationships. Start with
[How objects connect](https://offerkit.dev/docs/reference/relationships/) if those terms
are new, or [build your first offer](https://offerkit.dev/docs/getting-started/).

## Install

```bash
npm install @offerkit/sdk
```

```bash
pnpm add @offerkit/sdk
```

## Usage

```ts
import { createClient } from "@offerkit/sdk";

const offerkit = createClient({
  baseUrl: "https://your-offerkit-deployment",
  apiKey: process.env.OFFERKIT_API_KEY,
});

const vouchers = await offerkit.vouchers.list({
  limit: 20,
  search: "SUMMER",
});

const validation = await offerkit.vouchers.validate({
  params: { code: "SUMMER10" },
  body: {
    order: {
      amount: 9999,
      currency: "USD",
      items: [],
    },
  },
});

const redemption = await offerkit.vouchers.redeem({
  params: { code: "SUMMER10" },
  body: {
    order: {
      amount: 9999,
      currency: "USD",
      items: [],
    },
    idempotencyKey: "order-42",
  },
});
```

Path-bearing procedures use oRPC's detailed input shape:

- `params` for path values, such as `{ code }` or `{ id }`
- `body` for request payloads
- `query` for filters on path-bearing lists, such as `referrals.listCodes({ params: { programId }, query: { limit: 20 } })`
- direct input fields for simple list filters, such as `vouchers.list({ limit: 20 })`

Most updates, including campaigns, vouchers, orders, customers, programs, and webhooks,
use `body: { patch: { ... } }`. Workspace updates take direct fields. A staff role change
uses `body: { role: "member" }`. Check the method's input type when using another route.

Amounts use integer minor units: `9999` USD is USD 99.99. Percentages use basis points:
`1000` means 10%. `validation.valid` and `redemption.ok` are separate business-result flags;
a successful HTTP request can still reject an offer. See [API conventions](https://offerkit.dev/docs/reference/api-reference/).

The examples follow the current contract. Voucher `customerExternalId` requires SDK 0.3.0
or later and a server that accepts it. Package and image versions advance separately;
check the running deployment's `/api/openapi.json` before using a new field.

## Webhook signatures

```ts
import { verifyWebhook } from "@offerkit/sdk";

const valid = verifyWebhook(rawBody, request.headers.get("x-offerkit-signature")!, secret);

if (!valid) {
  throw new Error("Invalid OfferKit webhook signature");
}
```

`verifyWebhook` checks the `X-Offerkit-Signature` header using HMAC-SHA256 and rejects stale signatures by default after 300 seconds.

## API keys

Mint an API key in the OfferKit dashboard at `/settings/api-keys`, then pass it as `apiKey` or set `OFFERKIT_API_KEY` in your runtime environment.

## Links

- Repository: https://github.com/offerkit/offerkit
- Docs: https://offerkit.dev/docs
- License: MIT
