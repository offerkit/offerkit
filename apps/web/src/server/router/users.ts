import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { sendEmail } from "@offerkit/core/email";
import type { RequestContext } from "@/server/context";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";

const os = implement(contract).$context<RequestContext>();

interface StaffUserRow {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  mustChangePassword: boolean;
  disabledAt: Date | null;
  createdAt: Date;
}

function toUserOutput(row: StaffUserRow): {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "member";
  mustChangePassword: boolean;
  disabledAt: string | null;
  createdAt: string;
} {
  return {
    id: row.id,
    email: row.email,
    name: row.name && row.name.length > 0 ? row.name : null,
    role: row.role,
    mustChangePassword: row.mustChangePassword,
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

const PASSWORD_ALPHABET =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";

function generatePassword(length = 20): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const byte of bytes) {
    const idx = byte % PASSWORD_ALPHABET.length;
    out += PASSWORD_ALPHABET.charAt(idx);
  }
  return out;
}

function requireAdmin(role: "admin" | "member"): void {
  if (role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "Admin role required" });
  }
}

async function findUserOrThrow(id: string): Promise<StaffUserRow> {
  const row = await db().query.user.findFirst({ where: eq(schema.user.id, id) });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "User not found" });
  return row as StaffUserRow;
}

async function setUserPassword(userId: string, password: string): Promise<void> {
  const hashed = await hashPassword(password);
  const existing = await db().query.account.findFirst({
    where: and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")),
  });
  if (existing) {
    await db()
      .update(schema.account)
      .set({ password: hashed, updatedAt: new Date() })
      .where(eq(schema.account.id, existing.id));
    return;
  }
  await db()
    .insert(schema.account)
    .values({
      id: crypto.randomUUID(),
      userId,
      accountId: userId,
      providerId: "credential",
      password: hashed,
    });
}

const list = os.users.list.use(requireSession).handler(async ({ context }) => {
  requireAdmin(context.user.role);
  const rows = (await db()
    .select()
    .from(schema.user)
    .orderBy(desc(schema.user.createdAt))) as StaffUserRow[];
  return { data: rows.map(toUserOutput) };
});

const create = os.users.create.use(requireSession).handler(async ({ context, input }) => {
  requireAdmin(context.user.role);
  const password = generatePassword();
  const result = await auth().api.signUpEmail({
    body: { email: input.email, password, name: input.name ?? input.email },
  });
  await db()
    .update(schema.user)
    .set({ role: input.role, mustChangePassword: true })
    .where(eq(schema.user.id, result.user.id));
  const row = await findUserOrThrow(result.user.id);
  await sendEmail({
    to: input.email,
    subject: "Your Offerkit account",
    html: `<p>Your account has been created. Sign in with the temporary password: <code>${password}</code></p>`,
    text: `Your temporary password: ${password}`,
  });
  return { ...toUserOutput(row), password };
});

const resetPassword = os.users.resetPassword
  .use(requireSession)
  .handler(async ({ context, input }) => {
    requireAdmin(context.user.role);
    const row = await findUserOrThrow(input.id);
    const password = generatePassword();
    await setUserPassword(row.id, password);
    await db()
      .update(schema.user)
      .set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(schema.user.id, row.id));
    const updated = await findUserOrThrow(row.id);
    await sendEmail({
      to: row.email,
      subject: "Your Offerkit password was reset",
      html: `<p>Your password has been reset. New temporary password: <code>${password}</code></p>`,
      text: `New temporary password: ${password}`,
    });
    return { ...toUserOutput(updated), password };
  });

const setRole = os.users.setRole.use(requireSession).handler(async ({ context, input }) => {
  requireAdmin(context.user.role);
  if (context.user.id === input.id && input.role !== "admin") {
    throw new ORPCError("CONFLICT", { message: "Cannot demote your own account" });
  }
  await db()
    .update(schema.user)
    .set({ role: input.role, updatedAt: new Date() })
    .where(eq(schema.user.id, input.id));
  return toUserOutput(await findUserOrThrow(input.id));
});

const disable = os.users.disable.use(requireSession).handler(async ({ context, input }) => {
  requireAdmin(context.user.role);
  if (context.user.id === input.id) {
    throw new ORPCError("CONFLICT", { message: "Cannot disable your own account" });
  }
  const row = await findUserOrThrow(input.id);
  if (row.disabledAt) return toUserOutput(row);
  // Revoke active sessions so the user can't continue using the app.
  await db().delete(schema.session).where(eq(schema.session.userId, input.id));
  await db()
    .update(schema.user)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.user.id, input.id));
  return toUserOutput(await findUserOrThrow(input.id));
});

const enable = os.users.enable.use(requireSession).handler(async ({ context, input }) => {
  requireAdmin(context.user.role);
  await db()
    .update(schema.user)
    .set({ disabledAt: null, updatedAt: new Date() })
    .where(and(eq(schema.user.id, input.id), isNotNull(schema.user.disabledAt)));
  return toUserOutput(await findUserOrThrow(input.id));
});

export const usersRouter = { list, create, resetPassword, setRole, disable, enable };
