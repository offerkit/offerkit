"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LoyaltyMemberPage({ params }: PageProps) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const gt = useGT();
  const [earnPoints, setEarnPoints] = useState(100);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");
  const [rewardId, setRewardId] = useState("");

  const { data: member, isLoading } = useQuery({
    queryKey: ["loyaltyMembers", id],
    queryFn: () => ovx().loyalty.members.get({ id }),
  });

  const { data: history } = useQuery({
    queryKey: ["loyaltyMembers", id, "history"],
    queryFn: () => ovx().loyalty.members.history({ id }),
  });

  const { data: rewards } = useQuery({
    queryKey: ["loyaltyRewards", member?.programId ?? ""],
    queryFn: () =>
      ovx().loyalty.rewards.list({ programId: member?.programId ?? "" }),
    enabled: !!member,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["loyaltyMembers", id] });
  };

  const earn = useMutation({
    mutationFn: () =>
      ovx().loyalty.members.earn({ memberId: id, basePoints: earnPoints }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Earn failed"));
      else toast.success(gt("Earned {n} points").replace("{n}", String(r.delta)));
      await refresh();
    },
  });

  const adjust = useMutation({
    mutationFn: () =>
      ovx().loyalty.members.adjust({ memberId: id, delta: adjustPoints, note: adjustNote }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Adjust failed"));
      else toast.success(gt("Balance adjusted"));
      await refresh();
    },
  });

  const redeem = useMutation({
    mutationFn: () => ovx().loyalty.members.redeem({ memberId: id, rewardId }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Redeem failed"));
      else toast.success(gt("Reward redeemed"));
      await refresh();
    },
  });

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  if (!member)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Member not found.</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={
              <Link
                href={`/loyalty/${member.programId}`}
                aria-label={gt("Back to program")}
              />
            }
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <T>Loyalty member</T>
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{member.customerId}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="default" className="text-base">
            {member.balance} <T>pts</T>
          </Badge>
          <span className="text-sm text-muted-foreground">
            <T>Lifetime: {member.lifetimePoints}</T>
          </span>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Earn</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="earn-points">
                <T>Base points</T>
              </Label>
              <Input
                id="earn-points"
                type="number"
                min={1}
                value={earnPoints}
                onChange={(e) => setEarnPoints(Number(e.target.value))}
              />
            </div>
            <Button
              type="button"
              onClick={() => earn.mutate()}
              disabled={earn.isPending || earnPoints < 1}
              className="w-full"
            >
              {earn.isPending ? <T>Earning…</T> : <T>Apply earn</T>}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Adjust</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="adjust-delta">
                <T>Delta (signed)</T>
              </Label>
              <Input
                id="adjust-delta"
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjust-note">
                <T>Note</T>
              </Label>
              <Input
                id="adjust-note"
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => adjust.mutate()}
              disabled={adjust.isPending || adjustPoints === 0}
              className="w-full"
            >
              {adjust.isPending ? <T>Saving…</T> : <T>Apply adjustment</T>}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Redeem reward</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>
                <T>Reward</T>
              </Label>
              <Select value={rewardId} onValueChange={(v) => setRewardId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={gt("Pick a reward")} />
                </SelectTrigger>
                <SelectContent>
                  {(rewards?.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.cost} pts)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => redeem.mutate()}
              disabled={redeem.isPending || !rewardId}
              className="w-full"
            >
              {redeem.isPending ? <T>Redeeming…</T> : <T>Redeem</T>}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Ledger</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!history || history.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <T>No transactions yet.</T>
            </p>
          ) : (
            <ul className="divide-y rounded-md border text-sm">
              {history.data.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t.reason}</Badge>
                    {t.note ? (
                      <span className="text-xs text-muted-foreground">{t.note}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="font-mono text-sm">
                    <span className={t.delta < 0 ? "text-red-500" : "text-emerald-500"}>
                      {t.delta > 0 ? "+" : ""}
                      {t.delta}
                    </span>
                    <span className="ml-3 text-muted-foreground">→ {t.balanceAfter}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
