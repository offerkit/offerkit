import { ORPCError, os } from "@orpc/server";
import type { RequestContext } from "@/server/context";
import { auth } from "@/lib/auth";

export interface AuthedContext extends RequestContext {
  user: { id: string; email: string; role: "admin" | "member" };
}

export const requireSession = os
  .$context<RequestContext>()
  .middleware(async ({ context, next }) => {
    const session = await auth().api.getSession({ headers: context.headers });
    if (!session) {
      throw new ORPCError("UNAUTHORIZED", { message: "Sign in required" });
    }
    return next({
      context: {
        user: {
          id: session.user.id,
          email: session.user.email,
          role: (session.user as { role?: "admin" | "member" }).role ?? "member",
        },
      },
    });
  });
