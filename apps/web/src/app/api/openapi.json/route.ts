import { NextResponse } from "next/server";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { router } from "@/server/router";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

// `@orpc/openapi`'s "compact" input structure (the default oRPC uses) and
// the @orpc/zod converter for Zod 4 don't currently agree on how to map
// `z.object({ id: z.string().uuid() })` into an OpenAPI path-param: the
// generator sees the rendered schema and rejects it with "input schema
// must be an object with all dynamic params as required". 40+ procedures
// trip this. The proper fix is to migrate every path-bearing route to
// `inputStructure: 'detailed'` (caller passes `{params, body}`), but that
// changes the public API shape and invalidates the typed SDK contract.
//
// For now we emit a stub spec with an honest description pointing to the
// human-readable reference. The typed SDK derives its types from the
// oRPC contract directly, not from the OpenAPI document, so consumers of
// `@offerkit/sdk` are unaffected. External tools that need the
// full spec should follow the migration path linked in the description.
export function GET(): NextResponse {
  void generator;
  void router;
  return NextResponse.json(
    {
      openapi: "3.1.0",
      info: {
        title: "offerkit",
        version: "0.0.0",
        description:
          "The typed SDK in @offerkit/sdk derives from the oRPC contract directly. " +
          "The auto-generated OpenAPI document is currently disabled pending a migration of " +
          "path-bearing procedures to oRPC's 'detailed' input structure. See /docs/api-reference " +
          "for the canonical surface.",
      },
      paths: {},
    },
    { status: 200 },
  );
}
