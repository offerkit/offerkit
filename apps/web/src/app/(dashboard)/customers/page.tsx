"use client";

import Link from "next/link";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Plus, Search } from "lucide-react";
import { DataTable } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCursorPagination } from "@/hooks/use-cursor-pagination";
import { type ApiListItem, type OfferKitClient, ovx } from "@/lib/sdk";

type CustomerRow = ApiListItem<OfferKitClient["customers"]["list"]>;

export default function CustomersPage() {
  const gt = useGT();
  const [search, setSearch] = useState("");
  const pagination = useCursorPagination();
  const { cursor } = pagination;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customers", { search, cursor }],
    queryFn: () => ovx().customers.list({ search: search || undefined, cursor, limit: 20 }),
  });
  const columns: ColumnDef<CustomerRow>[] = [
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
            pagination.reset();
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={search ? <T>No customers match your search.</T> : <T>No customers yet.</T>}
        getRowClassName={() => "cursor-pointer"}
        pagination={{
          type: "cursor",
          canPrevious: pagination.canPrevious,
          canNext: Boolean(data?.next),
          onPrevious: pagination.previous,
          onNext: () => {
            if (data?.next) pagination.next(data.next);
          },
          pending: isFetching,
        }}
      />
    </div>
  );
}
