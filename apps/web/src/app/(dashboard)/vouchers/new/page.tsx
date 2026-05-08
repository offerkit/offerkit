"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { VoucherForm, type VoucherFormState } from "@/components/dashboard/voucher-form";
import { ovx } from "@/lib/sdk";

function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function NewVoucherPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const search = useSearchParams();
  const campaignId = search.get("campaignId") ?? "";

  const create = useMutation({
    mutationFn: (state: VoucherFormState) =>
      ovx().vouchers.create({
        code: state.code || undefined,
        campaignId: state.campaignId || undefined,
        type: state.type,
        discount: {
          type: state.discountKind,
          ...(state.discountKind === "AMOUNT"
            ? { amount: state.discountValue }
            : { percent: state.discountValue }),
          ...(state.maxDiscountAmount !== ""
            ? { maxDiscountAmount: state.maxDiscountAmount }
            : {}),
        },
        redemptionLimit: state.redemptionLimit === "" ? undefined : state.redemptionLimit,
        priority: state.priority,
        exclusive: state.exclusive,
        startDate: toIsoOrUndefined(state.startDate),
        endDate: toIsoOrUndefined(state.endDate),
      }),
    onSuccess: async (voucher) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Voucher created"));
      router.push(`/vouchers/${voucher.code}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
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
      <VoucherForm
        mode="create"
        initial={{
          code: "",
          campaignId,
          type: "DISCOUNT",
          discountKind: "AMOUNT",
          discountValue: 1000,
          maxDiscountAmount: "",
          redemptionLimit: "",
          priority: 0,
          exclusive: false,
          active: true,
          startDate: "",
          endDate: "",
        }}
        submitLabel={gt("Create voucher")}
        pending={create.isPending}
        onSubmit={(state) => create.mutate(state)}
      />
    </div>
  );
}
