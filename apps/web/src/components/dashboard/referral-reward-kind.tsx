import { T } from "gt-next/client";

export type ReferralRewardKind = "discount" | "gift_card" | "loyalty_points" | "custom";

export function ReferralRewardKindLabel({ kind }: { kind: ReferralRewardKind }) {
  switch (kind) {
    case "discount":
      return <T>Discount voucher</T>;
    case "gift_card":
      return <T>Gift card</T>;
    case "loyalty_points":
      return <T>Loyalty points</T>;
    case "custom":
      return <T>Custom reward</T>;
  }
}
