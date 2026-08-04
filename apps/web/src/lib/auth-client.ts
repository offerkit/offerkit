import { createAuthClient } from "better-auth/react";
import { oauthProviderClient } from "@better-auth/oauth-provider/client";

export const authClient = createAuthClient({
  baseURL: process.env["NEXT_PUBLIC_OFFERKIT_PUBLIC_URL"] ?? "",
  plugins: [oauthProviderClient()],
});

export const { signIn, signOut, changePassword, oauth2 } = authClient;
