"use client";

import Link from "next/link";
import { use } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>Name</T>
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">
                  <T>Qty</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>Unit price</T>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    <T>No items.</T>
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item, i) => (
                  <TableRow key={`${item.sku ?? item.productId ?? item.name}-${i}`}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.sku ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCents(item.unitPrice, data.currency)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Redemptions</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <T>Voucher</T>
                </TableHead>
                <TableHead>
                  <T>Result</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>Amount</T>
                </TableHead>
                <TableHead className="text-right">
                  <T>When</T>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!redemptions || redemptions.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    <T>No redemptions attached to this order.</T>
                  </TableCell>
                </TableRow>
              ) : (
                redemptions.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.voucherCode}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.result === "SUCCESS"
                            ? "default"
                            : r.result === "ROLLBACK"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {r.result}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {r.amount != null ? formatCents(r.amount, data.currency) : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">
                      {new Date(r.createdAt).toLocaleString()}
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
