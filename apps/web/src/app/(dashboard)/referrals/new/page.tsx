"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReferralRewardEditor,
  blankReferralReward,
  rewardStateToWire,
  type ReferralRewardState,
} from "@/components/dashboard/referral-reward-editor";
import { ovx } from "@/lib/sdk";

export default function NewReferralProgramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [campaignId, setCampaignId] = useState("");
  const [referrerReward, setReferrerReward] = useState<ReferralRewardState>(blankReferralReward);
  const [refereeReward, setRefereeReward] = useState<ReferralRewardState>(blankReferralReward);

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "for-referrals-new"],
    queryFn: () => ovx().campaigns.list({ limit: 100 }),
  });
  const eligible = (campaigns?.data ?? []).filter((c) => c.type === "REFERRAL_PROGRAM");

  const create = useMutation({
    mutationFn: () =>
      ovx().referrals.programs.create({
        campaignId,
        referrerReward: rewardStateToWire(referrerReward),
        refereeReward: rewardStateToWire(refereeReward),
      }),
    onSuccess: async (program) => {
      await queryClient.invalidateQueries({ queryKey: ["referralPrograms"] });
      toast.success(gt("Program created"));
      router.push(`/referrals/${program.id}`);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New referral program</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Bind a REFERRAL_PROGRAM campaign and configure both rewards.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Campaign</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label>
              <T>Campaign</T>
            </Label>
            <Select
              items={eligible.map((c) => ({ label: c.name, value: c.id }))}
              value={campaignId}
              onValueChange={(v) => setCampaignId(v ?? "")}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    eligible.length === 0
                      ? gt("Create a REFERRAL_PROGRAM campaign first")
                      : gt("Pick a campaign")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <ReferralRewardEditor
          title={gt("Referrer reward")}
          state={referrerReward}
          onChange={setReferrerReward}
        />
        <ReferralRewardEditor
          title={gt("Referee reward")}
          state={refereeReward}
          onChange={setRefereeReward}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || !campaignId}
        >
          {create.isPending ? <T>Creating…</T> : <T>Create program</T>}
        </Button>
      </div>
    </div>
  );
}
