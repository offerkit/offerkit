"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ovx } from "@/lib/sdk";

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [name, setName] = useState("");
  const [mintedToken, setMintedToken] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => ovx().apiKeys.list({}),
  });

  const create = useMutation({
    mutationFn: () => ovx().apiKeys.create({ name }),
    onSuccess: async (key) => {
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      setMintedToken(key.token);
      setName("");
      toast.success(gt("API key minted — copy it now, it won't be shown again"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => ovx().apiKeys.revoke({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.success(gt("API key revoked"));
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
    },
    {
      accessorKey: "prefix",
      header: () => <T>Prefix</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          offerkit_{row.original.prefix}_...
        </span>
      ),
    },
    {
      accessorKey: "scopes",
      header: () => <T>Scopes</T>,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.scopes.map((scope: string) => (
            <Badge key={scope} variant="secondary">
              {scope}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "lastUsedAt",
      header: () => <T>Last used</T>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.lastUsedAt
            ? new Date(row.original.lastUsedAt).toLocaleString()
            : gt("never")}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" aria-label={gt("Revoke")}>
                <Trash2 className="size-4" />
              </Button>
            }
            title={gt("Revoke this key?")}
            description={gt("Revoked keys cannot be re-enabled. Issue a new one if you need to.")}
            confirmLabel={gt("Revoke")}
            destructive
            pending={revoke.isPending}
            onConfirm={() => revoke.mutate(row.original.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>API keys</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Bearer tokens for the SDK, CLI, and MCP server.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Mint a new key</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor="key-name">
              <T>Name</T>
            </Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={gt("CI bot, local dev, …")}
            />
          </div>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
          >
            <Plus className="size-4" />
            {create.isPending ? <T>Minting…</T> : <T>Mint key</T>}
          </Button>
        </CardContent>
      </Card>

      {mintedToken ? (
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle>
              <T>Copy now — this is the only time it will be shown</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input
              readOnly
              value={mintedToken}
              className="font-mono text-sm"
              onFocus={(e) => e.target.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(mintedToken);
                toast.success(gt("Copied"));
              }}
            >
              <Copy className="size-4" />
              <T>Copy</T>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMintedToken(null)}>
              <T>Dismiss</T>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Active keys</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyMessage={<T>No keys yet.</T>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
