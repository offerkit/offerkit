import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(): Promise<NextResponse> {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sign in required" } }, { status: 401 });
  }
  await db()
    .update(schema.user)
    .set({ mustChangePassword: false })
    .where(eq(schema.user.id, session.user.id));
  return NextResponse.json({ ok: true });
}
