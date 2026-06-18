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

export default function CampaignsPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", { search }],
    queryFn: () => ovx().campaigns.list({ search: search || undefined, limit: 20 }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/campaigns/${row.original.id}`}>
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      header: () => <T>Type</T>,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.type}</span>,
    },
    {
      accessorKey: "status",
      header: () => <T>Status</T>,
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "secondary"}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: "voucherCount",
      header: () => <div className="text-right"><T>Vouchers</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">{row.original.voucherCount}</div>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: () => <div className="text-right"><T>Updated</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Campaigns</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Discount, gift, loyalty, referral and promotion programs.</T>
          </p>
        </div>
        <Button render={<Link href="/campaigns/new" />}>
          <Plus className="size-4" />
          <T>New campaign</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by name")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No campaigns yet.</T>}
      />
    </div>
  );
}
