"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Cable, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Connection {
  id: string;
  clientId: string;
  name: string | null;
  uri: string | null;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

async function connections(): Promise<Connection[]> {
  const response = await fetch("/api/oauth/connections", { cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load connections");
  return response.json() as Promise<Connection[]>;
}

export default function ConnectionsPage() {
  const gt = useGT();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["oauth-connections"],
    queryFn: connections,
  });
  const disconnect = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch("/api/oauth/connections", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Unable to revoke connection");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["oauth-connections"] });
      toast.success(gt("Connection revoked"));
    },
    onError: (cause: unknown) =>
      toast.error(cause instanceof Error ? cause.message : gt("Revoke failed")),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Agent connections</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>OAuth access granted to Codex, Claude Code, and other MCP clients.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Connected applications</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              <T>Loading…</T>
            </p>
          ) : error ? (
            <p className="text-sm text-destructive">
              <T>Unable to load agent connections.</T>
            </p>
          ) : data?.length ? (
            <ul className="divide-y">
              {data.map((connection) => (
                <li key={connection.id} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Cable className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {connection.name || gt("MCP client")}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {connection.scopes.map((scope) => (
                        <Badge key={scope} variant="secondary">
                          {scope}
                        </Badge>
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {new Date(connection.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={gt("Revoke connection")}>
                        <Trash2 className="size-4" />
                      </Button>
                    }
                    title={gt("Revoke this connection?")}
                    description={gt(
                      "The client will immediately lose access and must be authorized again.",
                    )}
                    confirmLabel={gt("Revoke")}
                    destructive
                    pending={disconnect.isPending}
                    onConfirm={() => disconnect.mutate(connection.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              <T>No agent connections have been authorized.</T>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
