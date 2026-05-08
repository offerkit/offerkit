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

export default function LoyaltyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["loyaltyPrograms"],
    queryFn: () => ovx().loyalty.programs.list({ limit: 25 }),
  });

  const campaignIds = data?.data.map((p) => p.campaignId) ?? [];
  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "byIds", campaignIds],
    queryFn: async () => {
      const list = await ovx().campaigns.list({ limit: 100 });
      return new Map(list.data.map((c) => [c.id, c]));
    },
    enabled: campaignIds.length > 0,
  });

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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <T>Program</T>
              </TableHead>
              <TableHead>
                <T>Expires</T>
              </TableHead>
              <TableHead className="text-right">
                <T>Created</T>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  <T>Loading…</T>
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  <T>No loyalty programs yet.</T>
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((p) => {
                const c = campaigns?.get(p.campaignId);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link className="font-medium hover:underline" href={`/loyalty/${p.id}`}>
                        {c?.name ?? p.id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.pointsExpiryDays ? `${String(p.pointsExpiryDays)} days` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
