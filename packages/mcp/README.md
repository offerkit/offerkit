# @offerkit/mcp

OfferKit MCP server for exposing the OfferKit API as Model Context Protocol tools.

The package connects to an OfferKit deployment, discovers MCP-exposed procedures in the OfferKit contract, and registers them as tools. Tool descriptions and MCP annotations include risk metadata such as `safe`, `mutating`, and `destructive` so hosts and agents can ask for the right confirmation before changing data.

This package provides the local stdio command and a transport-independent server builder. An OfferKit deployment can expose the same tools at `/mcp` with OAuth by setting `OFFERKIT_MCP_ENABLED=true`; that hosted transport runs inside the web image and does not require this command on the client.

A campaign groups an initiative; a voucher is a discount or stored-value code. Loyalty
and referrals have separate programs and customer relationships. Start with
[How objects connect](https://offerkit.dev/docs/reference/relationships/) if those terms
are new, or [build your first offer](https://offerkit.dev/docs/getting-started/).

## Install

Most MCP hosts can run the package directly with `npx`:

```bash
npx -y @offerkit/mcp
```

You can also install it globally:

```bash
npm install -g @offerkit/mcp
```

## Configuration

The server reads these environment variables:

- `OFFERKIT_API_URL`: OfferKit deployment URL. Defaults to `http://localhost:3000`.
- `OFFERKIT_API_KEY`: Required API key. Mint one in the dashboard at `/settings/api-keys`.

## MCP host config

```json
{
  "mcpServers": {
    "offerkit": {
      "command": "npx",
      "args": ["-y", "@offerkit/mcp"],
      "env": {
        "OFFERKIT_API_URL": "https://your-offerkit-deployment",
        "OFFERKIT_API_KEY": "offerkit_..."
      }
    }
  }
}
```

## Tools

Tools are derived from the OfferKit contract at server startup. Explicit MCP risk metadata is used when present; otherwise the server infers risk from the HTTP method: `GET` is `safe`, `DELETE` is `destructive`, and other methods are `mutating`.

Mutating tools describe their risk level and should be confirmed with the user before invocation. Redemption tools accept idempotency keys where supported by the API.

## Links

- Repository: https://github.com/offerkit/offerkit
- Docs: https://offerkit.dev/docs/reference/developer-tools/
- SDK package: https://www.npmjs.com/package/@offerkit/sdk
- License: MIT

## Permissions and business outcomes

A local stdio process uses API-key scopes. Hosted `/mcp` uses the signed-in staff user's
role. A `member` staff role is not read-only. Tool risk labels describe intent and help
the host ask for confirmation; they do not limit what credentials authorize.

Money uses integer minor units and percentages use basis points, just as in the API.
Check `valid` on voucher validation and `ok` on redemption or conversion. An unsuccessful
business result is not necessarily a transport error. Source event IDs and replay keys
have different guarantees; consult [API conventions](https://offerkit.dev/docs/reference/api-reference/)
and [Retries and recovery](https://offerkit.dev/docs/reference/retries-and-recovery/).
