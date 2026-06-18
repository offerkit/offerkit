"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T } from "gt-next/client";
import { Plus } from "lucide-react";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Button } from "@/components/ui/button";
import { ovx } from "@/lib/sdk";

function rewardLabel(kind: "discount" | "gift_card" | "loyalty_points" | "custom"): string {
  switch (kind) {
    case "discount":
      return "Discount voucher";
    case "gift_card":
      return "Gift card";
    case "loyalty_points":
      return "Loyalty points";
    case "custom":
      return "Custom reward";
  }
}

export default function ReferralsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["referralPrograms"],
    queryFn: () => ovx().referrals.programs.list({ limit: 25 }),
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "for-referrals"],
    queryFn: () => ovx().campaigns.list({ limit: 100 }),
  });
  const byId = new Map((campaigns?.data ?? []).map((campaign: DataTableRow) => [campaign.id, campaign]));
  const columns: ColumnDef<DataTableRow>[] = [
    {
      id: "program",
      header: () => <T>Program</T>,
      cell: ({ row }) => (
        <Link className="font-medium hover:underline" href={`/referrals/${row.original.id}`}>
          {byId.get(row.original.campaignId)?.name ?? row.original.id}
        </Link>
      ),
    },
    {
      id: "referrerReward",
      header: () => <T>Referrer reward</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {rewardLabel(row.original.referrerReward.kind)}
        </span>
      ),
    },
    {
      id: "refereeReward",
      header: () => <T>Referee reward</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {rewardLabel(row.original.refereeReward.kind)}
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
            <T>Referral programs</T>
          </h1>
          <p className="text-sm text-muted-foreground">
            <T>Customer-shared codes with dual rewards on conversion.</T>
          </p>
        </div>
        <Button render={<Link href="/referrals/new" />}>
          <Plus className="size-4" />
          <T>New program</T>
        </Button>
      </header>

      <DataTable
        columns={columns}
        data={data?.data ?? []}
        isLoading={isLoading}
        emptyMessage={<T>No referral programs yet.</T>}
      />
    </div>
  );
}
