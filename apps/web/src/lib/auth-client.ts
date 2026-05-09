import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_OFFERKIT_PUBLIC_URL"] ?? "",
});

export const { signIn, signOut, changePassword } = authClient;
