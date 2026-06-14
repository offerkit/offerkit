"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { T } from "gt-next/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const byId = new Map((campaigns?.data ?? []).map((c) => [c.id, c]));

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>Program</T>
              </TableHead>
              <TableHead>
                <T>Referrer reward</T>
              </TableHead>
              <TableHead>
                <T>Referee reward</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Created</T>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  <T>Loading…</T>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                  <T>No referral programs yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/referrals/${p.id}`}>
                      {byId.get(p.campaignId)?.name ?? p.id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rewardLabel(p.referrerReward.kind)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {rewardLabel(p.refereeReward.kind)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
