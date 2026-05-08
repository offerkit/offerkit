import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

let cached: ReturnType<typeof toNextJsHandler> | undefined;

function handler() {
  cached ??= toNextJsHandler(auth());
  return cached;
}

export async function GET(req: Request): Promise<Response> {
  return handler().GET(req);
}

export async function POST(req: Request): Promise<Response> {
  return handler().POST(req);
}
