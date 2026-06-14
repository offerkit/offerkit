# @offerkit/sdk

Typed TypeScript client for the OfferKit API.

OfferKit is open-source promotion infrastructure for coupons, gift cards, loyalty, referrals, customer segments, and validation rules. The SDK is generated from the same oRPC contract used by the REST API, so request and response types stay in sync with your OfferKit deployment.

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
- direct input fields for simple list filters, such as `vouchers.list({ limit: 20 })`

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
- Docs: https://github.com/offerkit/offerkit/tree/main/apps/web/content/docs
- License: MIT
