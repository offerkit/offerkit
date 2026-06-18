"use client";

import Link from "next/link";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Plus, Search } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ovx } from "@/lib/sdk";

export default function VouchersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", { search }],
    queryFn: () => ovx().vouchers.list({ search: search || undefined, limit: 25 }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "code",
      header: () => <T>Code</T>,
      cell: ({ row }) => (
        <Link className="font-mono text-sm hover:underline" href={`/vouchers/${row.original.code}`}>
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      header: () => <T>Type</T>,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.type}</span>,
    },
    {
      id: "discount",
      header: () => <T>Discount</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.discount?.type === "AMOUNT"
            ? String((row.original.discount.amount ?? 0) / 100)
            : row.original.discount?.type === "PERCENTAGE"
              ? `${String((row.original.discount.percent ?? 0) / 100)}%`
              : "-"}
        </span>
      ),
    },
    {
      accessorKey: "redemptionCount",
      header: () => <div className="text-right"><T>Redemptions</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {row.original.redemptionCount}
          {row.original.redemptionLimit ? ` / ${String(row.original.redemptionLimit)}` : ""}
        </div>
      ),
    },
    {
      accessorKey: "active",
      header: () => <div className="text-right"><T>Active</T></div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Badge variant={row.original.active ? "default" : "secondary"}>
            {row.original.active ? gt("yes") : gt("no")}
          </Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Vouchers</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Flat list across campaigns. Search by code.</T>
          </p>
        </div>
        <Button render={<Link href="/vouchers/new" />}>
          <Plus className="size-4" />
          <T>New voucher</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by code")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No vouchers yet.</T>}
      />
    </div>
  );
}
