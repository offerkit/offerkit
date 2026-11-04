"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { useApiErrorMessage } from "@/lib/api-error-message";
import { toast } from "sonner";
import { VoucherForm, type VoucherFormState } from "@/components/dashboard/voucher-form";
import {
  campaignCurrencyMissing,
  isCampaignId,
  voucherFormToCreateInput,
} from "@/lib/forms/voucher";
import { ovx } from "@/lib/sdk";

export default function NewVoucherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const apiError = useApiErrorMessage();
  const search = useSearchParams();
  const campaignId = search.get("campaignId") ?? "";

  const { data: campaign, isPending: campaignPending } = useQuery({
    queryKey: ["campaigns", campaignId],
    queryFn: () => ovx().campaigns.get({ params: { id: campaignId } }),
    enabled: campaignId !== "",
  });

  // Money precision follows the campaign the form will submit, which the user
  // can change from the one in the URL. The form reports its own Campaign ID
  // (on mount, reset and edit), so this always names the submitted campaign.
  // Shares the query cache with `campaign`.
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaignId);
  // Mount the form once per URL campaign, after its first lookup settles, so
  // its type can seed the defaults. Later refetches (e.g. retrying a failed
  // lookup) must not unmount it and discard edits.
  const [formMountedFor, setFormMountedFor] = useState<string | null>(
    campaignId === "" ? "" : null,
  );
  if (formMountedFor !== campaignId && (campaignId === "" || !campaignPending)) {
    setFormMountedFor(campaignId);
  }
  const selectedIsCampaign = isCampaignId(selectedCampaignId);
  const { data: selectedCampaign } = useQuery({
    queryKey: ["campaigns", selectedCampaignId],
    queryFn: () => ovx().campaigns.get({ params: { id: selectedCampaignId } }),
    enabled: selectedIsCampaign,
  });

  const create = useMutation({
    mutationFn: (state: VoucherFormState) =>
      ovx().vouchers.create(voucherFormToCreateInput(state)),
    onSuccess: async (voucher) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Voucher created"));
      router.push(`/vouchers/${voucher.code}`);
    },
    onError: (err: unknown) => {
      toast.error(apiError(err, gt("Create failed")));
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New voucher</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Configure a single voucher. Use bulk generate on the campaign for batches.</T>
        </p>
      </header>
      {formMountedFor !== campaignId ? (
        <p className="text-sm text-muted-foreground">
          <T>Loading…</T>
        </p>
      ) : (
        <VoucherForm
          key={campaignId}
          mode="create"
          currency={selectedIsCampaign ? selectedCampaign?.currency : undefined}
          currencyMissing={campaignCurrencyMissing(
            selectedCampaignId,
            selectedIsCampaign ? selectedCampaign?.currency : undefined,
          )}
          onCampaignIdChange={setSelectedCampaignId}
          initial={{
            code: "",
            campaignId,
            type: campaign?.type === "GIFT_VOUCHERS" ? "GIFT_CARD" : "DISCOUNT",
            discountKind: "AMOUNT",
            discountValue: 1000,
            maxDiscountAmount: "",
            giftBalance: campaign?.type === "GIFT_VOUCHERS" ? 10000 : "",
            redemptionLimit: "",
            perUserRedemptionLimit: "",
            customerId: "",
            priority: 0,
            exclusive: false,
            active: true,
            startDate: "",
            endDate: "",
          }}
          submitLabel={gt("Create voucher")}
          pending={create.isPending}
          onSubmit={(state) => {
            // Defensive: never submit amounts scaled for a different campaign.
            if (state.campaignId !== selectedCampaignId) return;
            create.mutate(state);
          }}
        />
      )}
    </div>
  );
}
