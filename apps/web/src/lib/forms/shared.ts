import { z } from "zod";

export const optionalLocalDateTime = z.union([
  z.literal(""),
  z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "Enter a valid date and time",
  }),
]);

export function toIsoOrUndefined(local: string): string | undefined {
  return local ? new Date(local).toISOString() : undefined;
}

export function validateDateRange(
  value: { startDate: string; endDate: string },
  context: z.RefinementCtx,
): void {
  if (
    value.startDate &&
    value.endDate &&
    new Date(value.endDate).getTime() < new Date(value.startDate).getTime()
  ) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be after the start date",
    });
  }
}
