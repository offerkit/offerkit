import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_OVX_PUBLIC_URL"] ?? "",
});

export const { signIn, changePassword } = authClient;
