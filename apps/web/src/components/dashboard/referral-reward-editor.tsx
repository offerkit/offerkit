"use client";

import { T, useGT } from "gt-next/client";
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

export type ReferralRewardKind = "discount" | "gift_card" | "loyalty_points" | "custom";

export interface ReferralRewardState {
  kind: ReferralRewardKind;
  // discount
  discountKind: "AMOUNT" | "PERCENTAGE";
  discountValue: number;
  // gift_card
  creditCents: number;
  // loyalty_points
  loyaltyProgramId: string;
  loyaltyPoints: number;
  // custom
  typeKey: string;
}

export const blankReferralReward: ReferralRewardState = {
  kind: "discount",
  discountKind: "AMOUNT",
  discountValue: 1000,
  creditCents: 0,
  loyaltyProgramId: "",
  loyaltyPoints: 0,
  typeKey: "",
};

export function ReferralRewardEditor({
  title,
  state,
  onChange,
}: {
  title: string;
  state: ReferralRewardState;
  onChange: (next: ReferralRewardState) => void;
}) {
  const gt = useGT();
  const set = <K extends keyof ReferralRewardState>(k: K, v: ReferralRewardState[K]) =>
    onChange({ ...state, [k]: v });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>
            <T>Kind</T>
          </Label>
          <Select
            value={state.kind}
            onValueChange={(v) => set("kind", (v ?? "discount") as ReferralRewardKind)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="discount">{gt("Discount voucher")}</SelectItem>
              <SelectItem value="gift_card">{gt("Gift card")}</SelectItem>
              <SelectItem value="loyalty_points">{gt("Loyalty points")}</SelectItem>
              <SelectItem value="custom">{gt("Custom (emit only)")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.kind === "discount" ? (
          <>
            <div className="space-y-2">
              <Label>
                <T>Discount type</T>
              </Label>
              <Select
                value={state.discountKind}
                onValueChange={(v) =>
                  set("discountKind", (v ?? "AMOUNT") as "AMOUNT" | "PERCENTAGE")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AMOUNT">{gt("Amount (cents)")}</SelectItem>
                  <SelectItem value="PERCENTAGE">{gt("Percentage (basis points)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                <T>Value</T>
              </Label>
              <Input
                type="number"
                min={0}
                value={state.discountValue}
                onChange={(e) => set("discountValue", Number(e.target.value))}
              />
            </div>
          </>
        ) : null}

        {state.kind === "gift_card" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>
              <T>Credit (cents)</T>
            </Label>
            <Input
              type="number"
              min={0}
              value={state.creditCents}
              onChange={(e) => set("creditCents", Number(e.target.value))}
            />
          </div>
        ) : null}

        {state.kind === "loyalty_points" ? (
          <>
            <div className="space-y-2">
              <Label>
                <T>Loyalty program ID</T>
              </Label>
              <Input
                value={state.loyaltyProgramId}
                onChange={(e) => set("loyaltyProgramId", e.target.value)}
                placeholder={gt("UUID of an enrolled loyalty program")}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label>
                <T>Points</T>
              </Label>
              <Input
                type="number"
                min={0}
                value={state.loyaltyPoints}
                onChange={(e) => set("loyaltyPoints", Number(e.target.value))}
              />
            </div>
          </>
        ) : null}

        {state.kind === "custom" ? (
          <div className="space-y-2 sm:col-span-2">
            <Label>
              <T>Reward type key</T>
            </Label>
            <Input
              value={state.typeKey}
              onChange={(e) => set("typeKey", e.target.value.toUpperCase())}
              placeholder="FREE_SHIPPING"
              className="font-mono"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function rewardStateToWire(s: ReferralRewardState): {
  kind: ReferralRewardKind;
  discount?: { type: "AMOUNT" | "PERCENTAGE"; amount?: number; percent?: number };
  creditCents?: number;
  loyaltyProgramId?: string;
  loyaltyPoints?: number;
  typeKey?: string;
} {
  if (s.kind === "discount") {
    return {
      kind: "discount",
      discount:
        s.discountKind === "AMOUNT"
          ? { type: "AMOUNT", amount: s.discountValue }
          : { type: "PERCENTAGE", percent: s.discountValue },
    };
  }
  if (s.kind === "gift_card") return { kind: "gift_card", creditCents: s.creditCents };
  if (s.kind === "loyalty_points")
    return {
      kind: "loyalty_points",
      loyaltyProgramId: s.loyaltyProgramId,
      loyaltyPoints: s.loyaltyPoints,
    };
  return { kind: "custom", typeKey: s.typeKey };
}
