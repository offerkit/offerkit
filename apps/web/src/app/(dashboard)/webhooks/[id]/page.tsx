"use client";

import Link from "next/link";
import { use } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, RotateCw } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WebhookDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data: webhook } = useQuery({
    queryKey: ["webhooks", id],
    queryFn: () => ovx().webhooks.get({ params: { id } }),
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhooks", id, "deliveries"],
    queryFn: () => ovx().webhooks.deliveries({ params: { id }, query: { limit: 50 } }),
    refetchInterval: 5_000,
  });

  const replay = useMutation({
    mutationFn: (deliveryId: string) => ovx().webhooks.replay({ params: { id: deliveryId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["webhooks", id, "deliveries"] });
      toast.success(gt("Re-enqueued"));
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "eventType",
      header: () => <T>Event</T>,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.eventType}</span>,
    },
    {
      accessorKey: "status",
      header: () => <T>Status</T>,
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === "succeeded"
              ? "default"
              : row.original.status === "dead"
                ? "destructive"
                : "secondary"
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "attempts",
      header: () => <div className="text-right"><T>Attempts</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">{row.original.attempts}</div>
      ),
    },
    {
      id: "response",
      header: () => <T>Response</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.responseStatus
            ? `HTTP ${String(row.original.responseStatus)}`
            : (row.original.error ?? "-")}
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <T>Created</T>,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => replay.mutate(row.original.id)}
            aria-label={gt("Replay")}
            disabled={replay.isPending}
          >
            <RotateCw className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!webhook)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          render={<Link href="/webhooks" aria-label={gt("Back")} />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{webhook.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{webhook.url}</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Recent deliveries</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={deliveries?.data ?? []}
            emptyMessage={<T>No deliveries yet.</T>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
