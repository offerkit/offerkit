import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodSmartCoercionPlugin } from "@orpc/zod";
import { router } from "@/server/router";

const handler = new OpenAPIHandler(router, {
  plugins: [new ZodSmartCoercionPlugin()],
});

async function handle(request: Request): Promise<Response> {
  const { response } = await handler.handle(request, {
    prefix: "/api/v1",
    context: {},
  });
  return response ?? new Response("Not Found", { status: 404 });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
