import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { schema } from "@open-voucherify/db";
import { sendEmail } from "@open-voucherify/core/email";
import { db } from "./db.ts";

let cached: ReturnType<typeof build> | undefined;

function build() {
  const baseURL = process.env["OVX_PUBLIC_URL"] ?? "http://localhost:3000";
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your open-voucherify password",
          html: `<p>Open this link to reset your password: <a href="${url}">${url}</a></p>`,
          text: `Reset your password: ${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "member", input: false },
        mustChangePassword: {
          type: "boolean",
          required: false,
          defaultValue: false,
          input: false,
        },
        disabledAt: { type: "date", required: false, input: false },
      },
    },
  });
}

export type Auth = ReturnType<typeof build>;

export function auth(): Auth {
  cached ??= build();
  return cached;
}
