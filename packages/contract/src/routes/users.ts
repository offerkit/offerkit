import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  userCreateInput,
  userCreateOutput,
  userOutput,
  userRole,
} from "../schemas/user.ts";

export const users = {
  list: oc
    .route({ method: "GET", path: "/users", summary: "List staff users (admin)" })
    .output(z.object({ data: z.array(userOutput) })),
  create: oc
    .route({ method: "POST", path: "/users", summary: "Create staff user (admin)" })
    .input(userCreateInput)
    .output(userCreateOutput),
  resetPassword: oc
    .route({
      method: "POST",
      path: "/users/{id}/reset-password",
      summary: "Reset a staff user's password (admin)",
    })
    .input(z.object({ id: z.string() }))
    .output(userCreateOutput),
  setRole: oc
    .route({
      method: "PATCH",
      path: "/users/{id}/role",
      summary: "Change a staff user's role (admin)",
    })
    .input(z.object({ id: z.string(), role: userRole }))
    .output(userOutput),
  disable: oc
    .route({
      method: "POST",
      path: "/users/{id}/disable",
      summary: "Disable a staff user (admin)",
    })
    .input(z.object({ id: z.string() }))
    .output(userOutput),
  enable: oc
    .route({
      method: "POST",
      path: "/users/{id}/enable",
      summary: "Re-enable a staff user (admin)",
    })
    .input(z.object({ id: z.string() }))
    .output(userOutput),
};
