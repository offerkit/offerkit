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

export default function CustomersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customers", { search, cursor }],
    queryFn: () => ovx().customers.list({ search: search || undefined, cursor, limit: 20 }),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "email",
      header: () => <T>Email</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/customers/${row.original.id}`}>
          {row.original.email ?? <T>(no email)</T>}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: () => <T>Name</T>,
      cell: ({ row }) => row.original.name ?? "-",
    },
    {
      accessorKey: "phone",
      header: () => <T>Phone</T>,
      cell: ({ row }) => row.original.phone ?? "-",
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Customers</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>People who can redeem vouchers and earn loyalty points.</T>
          </p>
        </div>
        <Button render={<Link href="/customers/new" />}>
          <Plus className="size-4" />
          <T>New customer</T>
        </Button>
      </header>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={gt("Search by email or name")}
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCursor(undefined);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={search ? <T>No customers match your search.</T> : <T>No customers yet.</T>}
        getRowClassName={() => "cursor-pointer"}
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
