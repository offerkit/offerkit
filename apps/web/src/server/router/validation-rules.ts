import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
  toValidationRule,
  type ValidationRuleRow,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

const list = os.validationRules.list
  .use(requireSession)
  .handler(({ input }) => {
    const search = input.search?.trim();
    return paginatedSoftDeleteList<ValidationRuleRow, ReturnType<typeof toValidationRule>>({
      table: schema.validationRule,
      limit: input.limit,
      cursor: decodeCursor(input.cursor),
      filters: search ? [ilike(schema.validationRule.name, `%${search}%`)] : [],
      toOutput: toValidationRule,
    });
  });

const get = os.validationRules.get
  .use(requireSession)
  .handler(async ({ input }) => {
    const row = await db().query.validationRule.findFirst({
      where: and(
        eq(schema.validationRule.id, input.id),
        isNull(schema.validationRule.deletedAt),
      ),
    });
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Validation rule not found" });
    return toValidationRule(row);
  });

const create = os.validationRules.create
  .use(requireSession)
  .handler(async ({ input }) => {
    const [row] = await db()
      .insert(schema.validationRule)
      .values({
        name: input.name,
        description: input.description ?? null,
        rule: input.rule,
        appliesTo: input.appliesTo ?? "voucher",
      })
      .returning();
    if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
    return toValidationRule(row);
  });

const update = os.validationRules.update
  .use(requireSession)
  .handler(async ({ input }) => {
    const patch: Partial<typeof schema.validationRule.$inferInsert> = { updatedAt: new Date() };
    if (input.patch.name !== undefined) patch.name = input.patch.name;
    if (input.patch.description !== undefined)
      patch.description = input.patch.description ?? null;
    if (input.patch.rule !== undefined) patch.rule = input.patch.rule;
    if (input.patch.appliesTo !== undefined) patch.appliesTo = input.patch.appliesTo;

    const [row] = await db()
      .update(schema.validationRule)
      .set(patch)
      .where(
        and(
          eq(schema.validationRule.id, input.id),
          isNull(schema.validationRule.deletedAt),
        ),
      )
      .returning();
    if (!row) throw new ORPCError("NOT_FOUND", { message: "Validation rule not found" });
    return toValidationRule(row);
  });

const remove = os.validationRules.delete
  .use(requireSession)
  .handler(async ({ input }) => {
    await softDeleteById(schema.validationRule, input.id, "Validation rule not found");
    return { ok: true as const };
  });

export const validationRulesRouter = { list, get, create, update, delete: remove };
