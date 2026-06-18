"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T } from "gt-next/client";
import { Plus } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { ovx } from "@/lib/sdk";

export default function LoyaltyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["loyaltyPrograms"],
    queryFn: () => ovx().loyalty.programs.list({ limit: 25 }),
  });

  const campaignIds = data?.data.map((program: DataTableRow) => program.campaignId) ?? [];
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "byIds", campaignIds],
    queryFn: async () => {
      const list = await ovx().campaigns.list({ limit: 100 });
      return new Map(list.data.map((campaign: DataTableRow) => [campaign.id, campaign]));
    },
    enabled: campaignIds.length > 0,
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      id: "program",
      header: () => <T>Program</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/loyalty/${row.original.id}`}>
          {campaigns?.get(row.original.campaignId)?.name ?? row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: "pointsExpiryDays",
      header: () => <T>Expires</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.pointsExpiryDays ? `${String(row.original.pointsExpiryDays)} days` : "-"}
        </span>
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
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <T>Loyalty programs</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Tiered programs with points ledgers and configurable rewards.</T>
          </p>
        </div>
        <Button render={<Link href="/loyalty/new" />}>
          <Plus className="size-4" />
          <T>New program</T>
        </Button>
      </header>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No loyalty programs yet.</T>}
      />
    </div>
  );
}
