"use client";

import Link from "next/link";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Search } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ovx } from "@/lib/sdk";

type Status = "" | "CREATED" | "PAID" | "CANCELED" | "FULFILLED";

const STATUS_BADGE: Record<Exclude<Status, "">, "default" | "secondary" | "destructive" | "outline"> = {
  CREATED: "secondary",
  PAID: "default",
  FULFILLED: "default",
  CANCELED: "destructive",
};

function formatCents(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency}`;
  }
}

export default function OrdersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["orders", { search, status, cursor }],
    queryFn: () =>
      ovx().orders.list({
        search: search || undefined,
        status: status || undefined,
        cursor,
        limit: 20,
      }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "externalId",
      header: () => <T>External ID</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/orders/${row.original.id}`}>
          {row.original.externalId ?? row.original.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: () => <T>Status</T>,
      cell: ({ row }) => {
        const status = row.original.status as Exclude<Status, "">;
        return <Badge variant={STATUS_BADGE[status]}>{status}</Badge>;
      },
    },
    {
      accessorKey: "amount",
      header: () => <div className="text-right"><T>Amount</T></div>,
      cell: ({ row }) => (
        <div className="text-right font-mono">
          {formatCents(row.original.amount, row.original.currency)}
        </div>
      ),
    },
    {
      accessorKey: "discountAmount",
      header: () => <div className="text-right"><T>Discount</T></div>,
      cell: ({ row }) => (
        <div className="text-right font-mono text-muted-foreground">
          {row.original.discountAmount > 0
            ? formatCents(row.original.discountAmount, row.original.currency)
            : "-"}
        </div>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right"><T>Created</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Orders</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Orders that touched a redemption — useful for support and refund workflows.</T>
        </p>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={gt("Search by external ID")}
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCursor(undefined);
            }}
          />
        </div>
        <Select
          items={[
            { label: gt("All statuses"), value: "" },
            { label: gt("Created"), value: "CREATED" },
            { label: gt("Paid"), value: "PAID" },
            { label: gt("Fulfilled"), value: "FULFILLED" },
            { label: gt("Canceled"), value: "CANCELED" },
          ]}
          value={status}
          onValueChange={(v) => {
            setStatus(v as Status);
            setCursor(undefined);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder={gt("All statuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{gt("All statuses")}</SelectItem>
            <SelectItem value="CREATED">{gt("Created")}</SelectItem>
            <SelectItem value="PAID">{gt("Paid")}</SelectItem>
            <SelectItem value="FULFILLED">{gt("Fulfilled")}</SelectItem>
            <SelectItem value="CANCELED">{gt("Canceled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No orders yet.</T>}
      />

      {data?.next ? (
        <div className="flex justify-end">
          <Button variant="outline" disabled={isFetching} onClick={() => setCursor(data.next)}>
            <T>Next page</T>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
