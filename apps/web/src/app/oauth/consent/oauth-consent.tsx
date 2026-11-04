"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Check, ShieldCheck } from "lucide-react";
import { T, useGT, Var } from "gt-next/client";
import { oauth2 } from "@/lib/auth-client";
import { useApiErrorMessage } from "@/lib/api-error-message";
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

export function OAuthConsent() {
  const params = useSearchParams();
  const gt = useGT();
  const apiError = useApiErrorMessage();
  const scopeLabels: Record<string, string> = {
    offerkit: gt("View and manage OfferKit data using the tools available to your account"),
    offline_access: gt("Stay connected when you are not actively using the agent"),
    openid: gt("Confirm your OfferKit identity"),
    profile: gt("Read your name and profile"),
    email: gt("Read your email address"),
  };
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
        if (result.error) setError(apiError(result.error, gt("Unable to load application details")));
      });
  }, [clientId, apiError, gt]);

  async function decide(accept: boolean) {
    setSubmitting(true);
    setError(null);
    const result = await oauth2.consent({ accept });
    if (result.error) {
      setError(apiError(result.error, gt("Unable to complete authorization")));
      setSubmitting(false);
    }
  }

  const clientName = client?.client_name?.trim();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Bot className="size-6" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {clientName ? (
                <T>
                  Connect <Var>{clientName}</Var> to OfferKit?
                </T>
              ) : (
                <T>Connect an AI assistant to OfferKit?</T>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              <T>Only continue if you started this connection from your MCP client.</T>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-background p-4">
            <p className="mb-3 text-sm font-medium">
              <T>This connection will be able to:</T>
            </p>
            <ul className="space-y-3">
              {scopes.map((scope) => (
                <li key={scope} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                  <span>{scopeLabels[scope] ?? scope}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              <T>
                The assistant receives your current OfferKit role. Mutating operations remain
                audited, and you can revoke this connection later.
              </T>
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline" disabled={submitting} onClick={() => void decide(false)}>
            <T>Deny</T>
          </Button>
          <Button disabled={submitting || !clientId} onClick={() => void decide(true)}>
            {submitting ? <T>Connecting…</T> : <T>Allow access</T>}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
