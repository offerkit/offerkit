# @offerkit/cli

Command-line interface for OfferKit.

OfferKit is open-source promotion infrastructure for coupons, gift cards, loyalty, referrals, customer segments, and validation rules. The CLI uses `@offerkit/sdk` under the hood and talks to the same `/api/v1` API as the dashboard, SDK, and MCP server.

A campaign groups an initiative; a voucher is a discount or stored-value code. Loyalty
and referrals have separate programs and customer relationships. Start with
[How objects connect](https://offerkit.dev/docs/reference/relationships/) if those terms
are new, or [build your first offer](https://offerkit.dev/docs/getting-started/).

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

Inspect the active local configuration without making an API call:

```bash
offerkit config
```

Check the configured deployment and authenticated workspace:

```bash
offerkit doctor
offerkit whoami
```

## Commands

Most write-heavy commands accept `--data` with inline JSON, `@file.json`, or `-`
to read JSON from stdin. Command output is formatted JSON.

Feature-rich resource commands cover vouchers, campaigns, validation rules,
customers, segments, promotion tiers, reward types, referrals, loyalty,
webhooks, events, orders, API keys, users, workspace settings, audit log, and
insights. The generic `api` command is available as a fallback for exact SDK
procedure calls.

Amounts and `--amount` values use minor units: `25000` EUR is EUR 250.00 and `2500`
is EUR 25.00. Percentages use basis points (`1000` = 10%). The dashboard's discount input
uses display amounts instead. `appliesTo: "voucher"` labels a rule; attaching the rule's
ID to the campaign makes voucher decisions enforce it.

Call any OfferKit API procedure by SDK path:

```bash
offerkit api validationRules.create \
  --input '{"name":"WAPP25 min spend","appliesTo":"voucher","rule":{">=":[{"var":"order.amount"},25000]}}'

offerkit api campaigns.create \
  --input '{"name":"WAPP25","type":"DISCOUNT","currency":"EUR","validationRuleId":"<RULE_ID>"}'

offerkit api vouchers.create \
  --input '{"code":"WAPP25","campaignId":"<CAMPAIGN_ID>","type":"DISCOUNT","discount":{"type":"AMOUNT","amount":2500}}'
```

Copy the returned rule ID into `<RULE_ID>` and campaign ID into `<CAMPAIGN_ID>`.
Activate the campaign before redeeming:

```bash
offerkit campaigns update <CAMPAIGN_ID> --status active
```

`--input` accepts inline JSON, `@file.json`, or `-` to read JSON from stdin.

Convenience commands:

```bash
offerkit vouchers list
offerkit vouchers list --search SUMMER
offerkit vouchers get SUMMER10
offerkit vouchers create --code WAPP25 --campaign-id <CAMPAIGN_ID> --discount-amount 2500
offerkit vouchers update WAPP25 --data '{"redemptionLimit":1}'
offerkit vouchers bulk --campaign-id <CAMPAIGN_ID> --count 100 --discount-amount 2500
offerkit vouchers validate SUMMER10 --amount 9999 --currency USD
offerkit vouchers redeem SUMMER10 --amount 9999 --currency USD --idempotency-key order-42
offerkit vouchers qualify --data @qualify.json
offerkit vouchers stack-redeem --data @stack-redemption.json
```

```bash
offerkit campaigns list
offerkit campaigns get <CAMPAIGN_ID>
offerkit campaigns create --name "Spring 2026" --type DISCOUNT --currency USD --code-prefix SPRING
offerkit campaigns update <CAMPAIGN_ID> --status active --validation-rule-id <RULE_ID>
offerkit campaigns delete <CAMPAIGN_ID>
```

```bash
offerkit validation-rules list
offerkit validation-rules create \
  --name "Minimum spend" \
  --rule '{">=":[{"var":"order.amount"},25000]}'
offerkit validation-rules update <RULE_ID> --data '{"description":"EUR 250 minimum"}'
```

```bash
offerkit customers list
offerkit customers list --search alice
offerkit customers get 00000000-0000-0000-0000-000000000000
offerkit customers upsert --data '{"externalId":"user_123","email":"alice@example.com"}'
```

```bash
offerkit segments list
offerkit promotions tiers create --data @tier.json
offerkit referrals issue --data @referral.json
offerkit loyalty members earn --data @earn-points.json
offerkit webhooks create --data @webhook.json
offerkit orders create --data @order.json
offerkit api-keys create --data '{"name":"Checkout","scopes":["customers:write","vouchers:validate","vouchers:redeem"]}'
```

## Links

- Repository: https://github.com/offerkit/offerkit
- Docs: https://offerkit.dev/docs/reference/developer-tools/
- SDK package: https://www.npmjs.com/package/@offerkit/sdk
- License: MIT

## Example input files

Replace UUID placeholders with IDs returned by your deployment. Save each JSON block
under the filename shown before using its `--data @filename` command.

`qualify.json`:

```json
{"customerExternalId":"user-42","order":{"amount":5000,"currency":"USD","items":[]},"filters":{"includeSkipped":true}}
```

`stack-redemption.json`:

```json
{"codes":["WELCOME10","MEMBER5"],"customerExternalId":"user-42","order":{"amount":5000,"currency":"USD","items":[]},"externalOrderId":"order-42","idempotencyKey":"order-42:stack"}
```

`tier.json` (the campaign must be `PROMOTION` with `autoApply: true`):

```json
{"campaignId":"<PROMOTION_CAMPAIGN_ID>","name":"Ten off","effect":{"type":"AMOUNT","amount":1000},"priority":10}
```

`referral.json`:

```json
{"programId":"<REFERRAL_PROGRAM_ID>","referrerCustomerId":"<CUSTOMER_ID>","prefix":"MAYA"}
```

`earn-points.json`:

```json
{"memberId":"<LOYALTY_MEMBER_ID>","basePoints":50,"eventId":"order-42","applyMultiplier":true}
```

`webhook.json`:

```json
{"name":"Order events","url":"https://shop.example/offerkit-webhook","events":["voucher.redeemed","voucher.stack.redeemed"]}
```

`order.json`:

```json
{"externalId":"order-42","customerId":"<CUSTOMER_ID>","amount":5000,"currency":"USD","items":[{"name":"Shirt","quantity":1,"unitPrice":5000}],"status":"CREATED"}
```

An earning `eventId` records its source; it does not stop duplicate earning. Do not
blindly rerun the earning command after a timeout. See [Retries and recovery](https://offerkit.dev/docs/reference/retries-and-recovery/).
