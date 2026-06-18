"use client";

import Link from "next/link";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Plus, Search } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ovx } from "@/lib/sdk";

export default function RewardTypesPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["rewardTypes", { search }],
    queryFn: () => ovx().rewardTypes.list({ search: search || undefined, limit: 25 }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "key",
      header: () => <T>Key</T>,
      cell: ({ row }) => (
        <Link className="font-mono text-sm hover:underline" href={`/rewards/${row.original.id}`}>
          {row.original.key}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
    },
    {
      accessorKey: "description",
      header: () => <T>Description</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.description ?? "-"}</span>
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
            <T>Reward types</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>
              Custom non-numeric rewards (FREE_SHIPPING, …). The engine emits
              {" {type, payload}"}; your storefront honors them.
            </T>
          </p>
        </div>
        <Button render={<Link href="/rewards/new" />}>
          <Plus className="size-4" />
          <T>New reward type</T>
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
        emptyMessage={<T>No reward types yet.</T>}
      />
    </div>
  );
}
