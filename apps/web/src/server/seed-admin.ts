import { schema } from "@open-voucherify/db";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@open-voucherify/core/observability";

const log = logger.child({ component: "seed-admin" });

export async function seedAdmin(): Promise<void> {
  const userCount = await db().$count(schema.user);
  if (userCount > 0) return;

  const email = process.env["ADMIN_EMAIL"];
  const password = process.env["ADMIN_PASSWORD"];

  if (!email || !password) {
    throw new Error(
      "No users found in database. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the initial admin.",
    );
  }

  log.info({ email }, "creating initial admin user");

  await auth().api.signUpEmail({
    body: { email, password, name: "Admin" },
  });

  await db()
    .update(schema.user)
    .set({ role: "admin", mustChangePassword: true })
    .where(eq(schema.user.email, email));

  log.info(
    { email },
    "admin user created — password change will be required on first login",
  );
}
