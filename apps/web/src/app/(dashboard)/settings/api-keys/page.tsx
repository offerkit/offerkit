"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
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
    mutationFn: (id: string) => ovx().apiKeys.revoke({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.success(gt("API key revoked"));
    },
  });

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>Name</T>
                </TableHead>
                <TableHead>
                  <T>Prefix</T>
                </TableHead>
                <TableHead>
                  <T>Scopes</T>
                </TableHead>
                <TableHead>
                  <T>Last used</T>
                </TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    <T>Loading…</T>
                  </TableCell>
                </TableRow>
              ) : !data || data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    <T>No keys yet.</T>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>{k.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      offerkit_{k.prefix}_…
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="secondary">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {k.lastUsedAt
                        ? new Date(k.lastUsedAt).toLocaleString()
                        : gt("never")}
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" aria-label={gt("Revoke")}>
                            <Trash2 className="size-4" />
                          </Button>
                        }
                        title={gt("Revoke this key?")}
                        description={gt(
                          "Revoked keys cannot be re-enabled. Issue a new one if you need to.",
                        )}
                        confirmLabel={gt("Revoke")}
                        destructive
                        pending={revoke.isPending}
                        onConfirm={() => revoke.mutate(k.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
