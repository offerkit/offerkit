"use client";

import Link from "next/link";
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

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [eventsCsv, setEventsCsv] = useState("*");
  const [mintedSecret, setMintedSecret] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => ovx().webhooks.list({}),
  });

  const create = useMutation({
    mutationFn: () =>
      ovx().webhooks.create({
        name,
        url,
        events: eventsCsv
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        active: true,
      }),
    onSuccess: async (wh) => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setMintedSecret(wh.secret);
      setName("");
      setUrl("");
      setEventsCsv("*");
      toast.success(gt("Webhook created — copy the secret now"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ovx().webhooks.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/webhooks/${row.original.id}`}>
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "url",
      header: () => <T>URL</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.url}</span>
      ),
    },
    {
      accessorKey: "events",
      header: () => <T>Events</T>,
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.events.map((event: string) => (
            <Badge key={event} variant="secondary">
              {event}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "active",
      header: () => <T>Active</T>,
      cell: ({ row }) => (
        <Badge variant={row.original.active ? "default" : "secondary"}>
          {row.original.active ? gt("yes") : gt("no")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon">
                <Trash2 className="size-4" />
              </Button>
            }
            title={gt("Delete this webhook?")}
            description={gt("Soft-delete. Pending deliveries will be marked dead.")}
            confirmLabel={gt("Delete")}
            destructive
            pending={remove.isPending}
            onConfirm={() => remove.mutate(row.original.id)}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Webhooks</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>HTTP endpoints subscribed to event types. Stripe-style HMAC-SHA256 signed.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Add a webhook</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="wh-name">
              <T>Name</T>
            </Label>
            <Input id="wh-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wh-url">
              <T>Endpoint URL</T>
            </Label>
            <Input
              id="wh-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/ovx-webhook"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="wh-events">
              <T>Event types (comma-separated, * for all)</T>
            </Label>
            <Input
              id="wh-events"
              value={eventsCsv}
              onChange={(e) => setEventsCsv(e.target.value)}
              className="font-mono text-sm"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending || !name.trim() || !url.trim()}
            >
              <Plus className="size-4" />
              {create.isPending ? <T>Creating…</T> : <T>Create webhook</T>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {mintedSecret ? (
        <Card className="border-emerald-500/40">
          <CardHeader>
            <CardTitle>
              <T>Signing secret — copy now</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Input readOnly value={mintedSecret} className="font-mono text-sm" />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(mintedSecret);
                toast.success(gt("Copied"));
              }}
            >
              <Copy className="size-4" />
              <T>Copy</T>
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMintedSecret(null)}>
              <T>Dismiss</T>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Endpoints</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data?.data ?? []}
            isLoading={isLoading}
            emptyMessage={<T>No webhooks yet.</T>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
