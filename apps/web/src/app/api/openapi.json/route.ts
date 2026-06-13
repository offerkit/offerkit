import { NextResponse } from "next/server";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { router } from "@/server/router";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

export async function GET(): Promise<NextResponse> {
  const spec = await generator.generate(router, {
    info: {
      title: "offerkit",
      version: "0.0.0",
      description:
        "Typed OpenAPI surface for the Offerkit promotions, loyalty, referral, and voucher APIs.",
    },
  });

  return NextResponse.json(spec, { status: 200 });
}
