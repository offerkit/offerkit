import { oc } from "@orpc/contract";
import { z } from "zod";

const workspaceOutput = z.object({
  name: z.string(),
  defaultCurrency: z.string(),
  defaultTimezone: z.string(),
  emailProvider: z.enum(["resend", "log"]),
  updatedAt: z.string().datetime(),
});

const workspaceUpdateInput = z.object({
  name: z.string().min(1).max(120).optional(),
  defaultCurrency: z.string().length(3).optional(),
  defaultTimezone: z.string().min(1).max(64).optional(),
});

export const workspace = {
  get: oc
    .route({ method: "GET", path: "/workspace", summary: "Workspace settings" })
    .output(workspaceOutput),
  update: oc
    .route({ method: "PATCH", path: "/workspace", summary: "Update workspace settings (admin)" })
    .input(workspaceUpdateInput)
    .output(workspaceOutput),
};
