"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Search } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ovx } from "@/lib/sdk";

export default function EventsPage() {
  const gt = useGT();
  const [type, setType] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["events", { type }],
    queryFn: () =>
      ovx().events.list({ limit: 50, ...(type ? { type } : {}) }),
    refetchInterval: 5_000,
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "type",
      header: () => <T>Type</T>,
      cell: ({ row }) => (
        <Badge variant="secondary" className="font-mono">
          {row.original.type}
        </Badge>
      ),
    },
    {
      accessorKey: "entityId",
      header: () => <T>Entity</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.entityId ? `${row.original.entityId.slice(0, 8)}...` : "-"}
        </span>
      ),
    },
    {
      accessorKey: "payload",
      header: () => <T>Payload</T>,
      cell: ({ row }) => (
        <pre className="max-w-prose overflow-auto rounded-md border bg-muted/40 p-2 text-xs">
          {JSON.stringify(row.original.payload, null, 2)}
        </pre>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right"><T>Created</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-xs text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleString()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Events</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Append-only log of domain events emitted by the system.</T>
        </p>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Filter by exact type, e.g. voucher.redeemed")}
          className="pl-9 font-mono text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No events yet.</T>}
      />
    </div>
  );
}
