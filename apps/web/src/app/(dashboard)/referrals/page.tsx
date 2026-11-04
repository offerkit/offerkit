"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { T, DateTime } from "gt-next/client";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/dashboard/data-table";
import { ReferralRewardKindLabel } from "@/components/dashboard/referral-reward-kind";
import { Button } from "@/components/ui/button";
import { type ApiListItem, type OfferKitClient, ovx } from "@/lib/sdk";
import { DATE_FORMAT } from "@/lib/date-format";

type ReferralProgramRow = ApiListItem<OfferKitClient["referrals"]["programs"]["list"]>;

export default function ReferralsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["referralPrograms"],
    queryFn: () => ovx().referrals.programs.list({ limit: 25 }),
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "for-referrals"],
    queryFn: () => ovx().campaigns.list({ limit: 100 }),
  });
  const byId = new Map((campaigns?.data ?? []).map((campaign) => [campaign.id, campaign]));
  const columns: ColumnDef<ReferralProgramRow>[] = [
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
          <ReferralRewardKindLabel kind={row.original.referrerReward.kind} />
        </span>
      ),
    },
    {
      id: "refereeReward",
      header: () => <T>Referee reward</T>,
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          <ReferralRewardKindLabel kind={row.original.refereeReward.kind} />
        </span>
      ),
    },
    {
      accessorKey: "createdAt",
      header: () => <div className="text-right"><T>Created</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          <DateTime options={DATE_FORMAT}>{new Date(row.original.createdAt)}</DateTime>
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
