import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { oauthProvider } from "@better-auth/oauth-provider";
import { schema } from "@offerkit/db";
import { sendEmail } from "@offerkit/core/email";
import { db } from "./db.ts";
import {
  HOSTED_MCP_SCOPE,
  hostedMcpResourceUrl,
  isHostedMcpEnabled,
  offerKitPublicUrl,
} from "./hosted-mcp.ts";

let cached: ReturnType<typeof build> | undefined;

function build() {
  const baseURL = offerKitPublicUrl();
  const secret = process.env["BETTER_AUTH_SECRET"];
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not set");
  }
  return betterAuth({
    baseURL,
    secret,
    disabledPaths: isHostedMcpEnabled() ? ["/token"] : [],
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        jwks: schema.jwks,
        oauthClient: schema.oauthClient,
        oauthRefreshToken: schema.oauthRefreshToken,
        oauthAccessToken: schema.oauthAccessToken,
        oauthConsent: schema.oauthConsent,
      },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your Offerkit password",
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
    plugins: isHostedMcpEnabled()
      ? [
          jwt({
            disableSettingJwtHeader: true,
            jwt: {
              issuer: baseURL,
              audience: hostedMcpResourceUrl(),
            },
          }),
          oauthProvider({
            loginPage: "/sign-in",
            consentPage: "/oauth/consent",
            allowPublicClientPrelogin: true,
            allowDynamicClientRegistration: true,
            allowUnauthenticatedClientRegistration: true,
            silenceWarnings: {
              oauthAuthServerConfig: true,
              openidConfig: true,
            },
            grantTypes: ["authorization_code", "refresh_token"],
            postLogin: {
              page: "/change-password",
              consentReferenceId: () => undefined,
              shouldRedirect: ({ user }) => user.mustChangePassword === true,
            },
            scopes: ["openid", "profile", "email", "offline_access", HOSTED_MCP_SCOPE],
            clientRegistrationDefaultScopes: [HOSTED_MCP_SCOPE, "offline_access"],
            clientRegistrationAllowedScopes: [
              "openid",
              "profile",
              "email",
              "offline_access",
              HOSTED_MCP_SCOPE,
            ],
            validAudiences: [hostedMcpResourceUrl()],
          }),
        ]
      : [],
  });
}

export type Auth = ReturnType<typeof build>;

export function auth(): Auth {
  cached ??= build();
  return cached;
}
