"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ovx } from "@/lib/sdk";

interface WorkspaceData {
  name: string;
  defaultCurrency: string;
  defaultTimezone: string;
  emailProvider: "resend" | "log";
}

export default function WorkspaceSettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get({}),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Workspace</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Defaults that apply to new campaigns and the dashboard chrome.</T>
        </p>
      </header>

      {isLoading || !data ? (
        <p className="text-sm text-muted-foreground">
          <T>Loading…</T>
        </p>
      ) : (
        <WorkspaceForm
          key={`${data.name}|${data.defaultCurrency}|${data.defaultTimezone}`}
          initial={data}
        />
      )}
    </div>
  );
}

function WorkspaceForm({ initial }: { initial: WorkspaceData }) {
  const gt = useGT();
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial.name);
  const [currency, setCurrency] = useState(initial.defaultCurrency);
  const [timezone, setTimezone] = useState(initial.defaultTimezone);

  const save = useMutation({
    mutationFn: () =>
      ovx().workspace.update({
        name,
        defaultCurrency: currency,
        defaultTimezone: timezone,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(gt("Workspace settings saved"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Save failed")),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            <T>General</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ws-name">
                <T>Name</T>
              </Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-currency">
                <T>Default currency (ISO 4217)</T>
              </Label>
              <Input
                id="ws-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                maxLength={3}
                className="uppercase"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-tz">
              <T>Default timezone (IANA)</T>
            </Label>
            <Input
              id="ws-tz"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder={gt("e.g. UTC, Europe/Berlin, America/Los_Angeles")}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-4" />
              {save.isPending ? <T>Saving…</T> : <T>Save</T>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Email</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={initial.emailProvider === "resend" ? "default" : "secondary"}>
              {initial.emailProvider}
            </Badge>
            {initial.emailProvider === "resend" ? (
              <span>
                <T>Transactional emails delivered via Resend.</T>
              </span>
            ) : (
              <span>
                <T>RESEND_API_KEY is unset — emails are logged to stdout.</T>
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Account</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <T>Change your sign-in password.</T>
          </p>
          <Button variant="outline" render={<Link href="/change-password" />}>
            <T>Change password</T>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
