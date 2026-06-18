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

export default function SegmentsPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["segments", { search }],
    queryFn: () => ovx().segments.list({ search: search || undefined, limit: 20 }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/segments/${row.original.id}`}>
          {row.original.name}
        </Link>
      ),
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
            <T>Segments</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Reusable JSON Logic rules over customer attributes.</T>
          </p>
        </div>
        <Button render={<Link href="/segments/new" />}>
          <Plus className="size-4" />
          <T>New segment</T>
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
        emptyMessage={<T>No segments yet.</T>}
      />
    </div>
  );
}
