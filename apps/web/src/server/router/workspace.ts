import { ORPCError, implement } from "@orpc/server";
import { eq } from "drizzle-orm";
import { schema } from "@open-voucherify/db";

const WORKSPACE_SETTING_ID = "workspace";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";

const os = implement(contract).$context<RequestContext>();

type WorkspaceRow = typeof schema.workspaceSetting.$inferSelect;

function emailProvider(): "resend" | "log" {
  return process.env["RESEND_API_KEY"] ? "resend" : "log";
}

function toWorkspace(row: WorkspaceRow) {
  return {
    name: row.name,
    defaultCurrency: row.defaultCurrency,
    defaultTimezone: row.defaultTimezone,
    emailProvider: emailProvider(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadOrSeed(): Promise<WorkspaceRow> {
  const row = await db().query.workspaceSetting.findFirst({
    where: eq(schema.workspaceSetting.id, WORKSPACE_SETTING_ID),
  });
  if (row) return row;
  const [seeded] = await db()
    .insert(schema.workspaceSetting)
    .values({ id: WORKSPACE_SETTING_ID })
    .onConflictDoNothing()
    .returning();
  if (seeded) return seeded;
  // Lost the race; another caller seeded first. Re-read.
  const reread = await db().query.workspaceSetting.findFirst({
    where: eq(schema.workspaceSetting.id, WORKSPACE_SETTING_ID),
  });
  if (!reread) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Workspace seed failed" });
  return reread;
}

const get = os.workspace.get.use(requireSession).handler(async () => toWorkspace(await loadOrSeed()));

const update = os.workspace.update.use(requireSession).handler(async ({ context, input }) => {
  if (context.user.role !== "admin") {
    throw new ORPCError("FORBIDDEN", { message: "Admin role required" });
  }
  await loadOrSeed();
  const patch: Partial<typeof schema.workspaceSetting.$inferInsert> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name;
  if (input.defaultCurrency !== undefined) patch.defaultCurrency = input.defaultCurrency.toUpperCase();
  if (input.defaultTimezone !== undefined) patch.defaultTimezone = input.defaultTimezone;
  const [row] = await db()
    .update(schema.workspaceSetting)
    .set(patch)
    .where(eq(schema.workspaceSetting.id, WORKSPACE_SETTING_ID))
    .returning();
  if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Update failed" });
  return toWorkspace(row);
});

export const workspaceRouter = { get, update };
