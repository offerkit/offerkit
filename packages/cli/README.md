# @offerkit/cli

Command-line interface for OfferKit.

OfferKit is open-source promotion infrastructure for coupons, gift cards, loyalty, referrals, customer segments, and validation rules. The CLI uses `@offerkit/sdk` under the hood and talks to the same `/api/v1` API as the dashboard, SDK, and MCP server.

## Install

```bash
npm install -g @offerkit/cli
```

```bash
pnpm add -g @offerkit/cli
```

The installed binary is `offerkit`.

## Configure

Mint an API key in the OfferKit dashboard at `/settings/api-keys`, then save it locally:

```bash
offerkit login --url https://your-offerkit-deployment --api-key offerkit_...
```

This writes `~/.offerkitrc` with file mode `0600`.

You can also use environment variables:

```bash
export OFFERKIT_API_URL=https://your-offerkit-deployment
export OFFERKIT_API_KEY=offerkit_...
```

Environment variables override values from `~/.offerkitrc`.

## Commands

```bash
offerkit vouchers list
offerkit vouchers list --search SUMMER
offerkit vouchers get SUMMER10
offerkit vouchers validate SUMMER10 --amount 9999 --currency USD
offerkit vouchers redeem SUMMER10 --amount 9999 --currency USD --idempotency-key order-42
```

```bash
offerkit campaigns list
offerkit campaigns create --name "Spring 2026" --type DISCOUNT --currency USD
```

```bash
offerkit customers list
offerkit customers list --search alice
offerkit customers get 00000000-0000-0000-0000-000000000000
```

All command output is formatted JSON.

## Links

- Repository: https://github.com/offerkit/offerkit
- SDK package: https://www.npmjs.com/package/@offerkit/sdk
- License: MIT
