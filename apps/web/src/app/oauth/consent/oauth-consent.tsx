"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Check, ShieldCheck } from "lucide-react";
import { oauth2 } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PublicClient {
  client_name?: string;
  client_uri?: string;
}

const SCOPE_LABELS: Record<string, string> = {
  offerkit: "View and manage OfferKit data using the tools available to your account",
  offline_access: "Stay connected when you are not actively using the agent",
  openid: "Confirm your OfferKit identity",
  profile: "Read your name and profile",
  email: "Read your email address",
};

export function OAuthConsent() {
  const params = useSearchParams();
  const clientId = params.get("client_id") ?? "";
  const scopes = useMemo(
    () => (params.get("scope") ?? "offerkit").split(/\s+/).filter(Boolean),
    [params],
  );
  const [client, setClient] = useState<PublicClient | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    void oauth2
      .publicClient({ query: { client_id: clientId } })
      .then((result) => {
        if (result.data) setClient(result.data);
        if (result.error) setError(result.error.message ?? "Unable to load application details");
      });
  }, [clientId]);

  async function decide(accept: boolean) {
    setSubmitting(true);
    setError(null);
    const result = await oauth2.consent({ accept });
    if (result.error) {
      setError(result.error.message ?? "Unable to complete authorization");
      setSubmitting(false);
    }
  }

  const clientName = client?.client_name?.trim() || "An AI assistant";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-6" />
          </div>
          <div>
            <CardTitle className="text-lg">Connect {clientName} to OfferKit?</CardTitle>
            <CardDescription className="mt-1">
              Only continue if you started this connection from your MCP client.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-3 text-sm font-medium">This connection will be able to:</p>
            <ul className="space-y-3">
              {scopes.map((scope) => (
                <li key={scope} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                  <span>{SCOPE_LABELS[scope] ?? scope}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              The assistant receives your current OfferKit role. Mutating operations remain audited,
              and you can revoke this connection later.
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => void decide(false)}>
            Deny
          </Button>
          <Button disabled={submitting || !clientId} onClick={() => void decide(true)}>
            {submitting ? "Connecting…" : "Allow access"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
