"use client";

import Link from "next/link";
import { use } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ovx } from "@/lib/sdk";

function formatCents(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const gt = useGT();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => ovx().orders.get({ params: { id } }),
  });

  const { data: redemptions } = useQuery({
    queryKey: ["order", id, "redemptions"],
    queryFn: () => ovx().orders.redemptions({ params: { id } }),
  });

  const fulfill = useMutation({
    mutationFn: () => ovx().orders.fulfill({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success(gt("Marked fulfilled"));
    },
  });

  const cancel = useMutation({
    mutationFn: () => ovx().orders.cancel({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success(gt("Order canceled"));
    },
  });

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        <T>Order not found.</T>
      </p>
    );
  }

  const canTransition = data.status === "CREATED" || data.status === "PAID";
  const itemColumns: ColumnDef<DataTableRow>[] = [
    { accessorKey: "name", header: () => <T>Name</T> },
    {
      accessorKey: "sku",
      header: "SKU",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.sku ?? "-"}</span>
      ),
    },
    {
      accessorKey: "quantity",
      header: () => <div className="text-right"><T>Qty</T></div>,
      cell: ({ row }) => <div className="text-right">{row.original.quantity}</div>,
    },
    {
      accessorKey: "unitPrice",
      header: () => <div className="text-right"><T>Unit price</T></div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {formatCents(row.original.unitPrice, data.currency)}
        </div>
      ),
    },
  ];
  const redemptionColumns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "voucherCode",
      header: () => <T>Voucher</T>,
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.voucherCode}</span>,
    },
    {
      accessorKey: "result",
      header: () => <T>Result</T>,
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.result === "SUCCESS"
              ? "default"
              : row.original.result === "ROLLBACK"
                ? "secondary"
                : "destructive"
          }
        >
          {row.original.result}
        </Badge>
      ),
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right"><T>Amount</T></div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {row.original.amount != null ? formatCents(row.original.amount, data.currency) : "-"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right"><T>When</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {data.externalId ?? id.slice(0, 8)}
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Order detail</T>
          </p>
        </div>
        <div className="flex gap-2">
          {canTransition ? (
            <Button onClick={() => fulfill.mutate()} disabled={fulfill.isPending}>
              <T>Mark fulfilled</T>
            </Button>
          ) : null}
          {data.status !== "CANCELED" ? (
            <ConfirmDialog
              trigger={
                <Button variant="destructive">
                  <T>Cancel order</T>
                </Button>
              }
              title={gt("Cancel this order?")}
              description={gt(
                "This marks the order canceled. Redemptions stay attached for the audit trail.",
              )}
              confirmLabel={gt("Cancel order")}
              destructive
              pending={cancel.isPending}
              onConfirm={() => cancel.mutate()}
            />
          ) : null}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Status</T>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge>{data.status}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Amount</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono">{formatCents(data.amount, data.currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Discount</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono">
            {data.discountAmount > 0 ? formatCents(data.discountAmount, data.currency) : "—"}
          </CardContent>
        </Card>
      </div>

      {data.customerId ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Customer</T>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link className="font-medium hover:underline" href={`/customers/${data.customerId}`}>
              {data.customerId}
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Items</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={itemColumns} data={data.items} emptyMessage={<T>No items.</T>} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Redemptions</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={redemptionColumns}
            data={redemptions?.data ?? []}
            emptyMessage={<T>No redemptions attached to this order.</T>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
