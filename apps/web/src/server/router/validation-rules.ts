import { ORPCError, implement } from "@orpc/server";
import { and, eq, ilike, isNull } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
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
        eq(schema.validationRule.id, input.params.id),
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
    const { patch: inputPatch } = input.body;
    if (inputPatch.name !== undefined) patch.name = inputPatch.name;
    if (inputPatch.description !== undefined)
      patch.description = inputPatch.description ?? null;
    if (inputPatch.rule !== undefined) patch.rule = inputPatch.rule;
    if (inputPatch.appliesTo !== undefined) patch.appliesTo = inputPatch.appliesTo;

    const [row] = await db()
      .update(schema.validationRule)
      .set(patch)
      .where(
        and(
          eq(schema.validationRule.id, input.params.id),
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
    await softDeleteById(schema.validationRule, input.params.id, "Validation rule not found");
    return { ok: true as const };
  });

export const validationRulesRouter = { list, get, create, update, delete: remove };
