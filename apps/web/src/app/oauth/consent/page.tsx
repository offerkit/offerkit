import { notFound } from "next/navigation";
import { isHostedMcpEnabled } from "@/lib/hosted-mcp";
import { OAuthConsent } from "./oauth-consent";

export default function OAuthConsentPage() {
  if (!isHostedMcpEnabled()) notFound();
  return <OAuthConsent />;
}
