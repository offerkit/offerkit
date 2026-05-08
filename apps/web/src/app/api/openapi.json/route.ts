import { NextResponse } from "next/server";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { router } from "@/server/router";

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

export async function GET(): Promise<NextResponse> {
  const spec = await generator.generate(router, {
    info: {
      title: "open-voucherify",
      version: "0.0.0",
      description: "Self-hostable promotion engine",
    },
    servers: [{ url: process.env["OVX_PUBLIC_URL"] ?? "http://localhost:3000" }],
  });
  return NextResponse.json(spec);
}
