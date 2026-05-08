"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  VoucherForm,
  type VoucherFormState,
} from "@/components/dashboard/voucher-form";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ code: string }>;
}

function fromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function VoucherDetailPage({ params }: PageProps) {
  const { code } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [orderAmount, setOrderAmount] = useState(10000);
  const [redeemKey, setRedeemKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vouchers", "code", code],
    queryFn: () => ovx().vouchers.get({ code }),
  });

  const update = useMutation({
    mutationFn: (state: VoucherFormState) =>
      ovx().vouchers.update({
        code,
        patch: {
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
          active: state.active,
          startDate: toIsoOrUndefined(state.startDate),
          endDate: toIsoOrUndefined(state.endDate),
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Voucher updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().vouchers.delete({ code }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      toast.success(gt("Voucher deleted"));
      router.push("/vouchers");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Delete failed"));
    },
  });

  const validatePreview = useMutation({
    mutationFn: (amount: number) =>
      ovx().vouchers.validate({
        code,
        order: { amount, currency: "USD", items: [] },
      }),
  });

  const redeem = useMutation({
    mutationFn: (vars: { amount: number; idempotencyKey?: string }) =>
      ovx().vouchers.redeem({
        code,
        order: { amount: vars.amount, currency: "USD", items: [] },
        idempotencyKey: vars.idempotencyKey,
      }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers", "code", code] });
      if (res.ok) toast.success(gt("Redemption succeeded"));
      else toast.error(res.message ?? gt("Redemption failed"));
    },
  });

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  if (!data)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Voucher not found.</T>
      </p>
    );

  const discount = data.discount;
  const initial: VoucherFormState = {
    code: data.code,
    campaignId: data.campaignId ?? "",
    type: data.type,
    discountKind: discount?.type ?? "AMOUNT",
    discountValue:
      discount?.type === "AMOUNT"
        ? (discount.amount ?? 0)
        : (discount?.percent ?? 0),
    maxDiscountAmount: discount?.maxDiscountAmount ?? "",
    redemptionLimit: data.redemptionLimit ?? "",
    priority: data.priority,
    exclusive: data.exclusive,
    active: data.active,
    startDate: fromIso(data.startDate),
    endDate: fromIso(data.endDate),
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/vouchers" aria-label={gt("Back to vouchers")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.code}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated {new Date(data.updatedAt).toLocaleString()}</T>
            </p>
          </div>
          <Badge variant={data.active ? "default" : "secondary"}>
            {data.active ? gt("active") : gt("inactive")}
          </Badge>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={remove.isPending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this voucher?")}
          description={gt(
            "The voucher is soft-deleted. Redemption history is preserved.",
          )}
          confirmLabel={gt("Delete voucher")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <VoucherForm
        key={data.updatedAt}
        mode="edit"
        initial={initial}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Test redemption</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="order-amount">
                <T>Order amount (cents)</T>
              </Label>
              <Input
                id="order-amount"
                type="number"
                min={0}
                value={orderAmount}
                onChange={(e) => setOrderAmount(Number(e.target.value))}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="idempotency-key">
                <T>Idempotency key</T>
              </Label>
              <Input
                id="idempotency-key"
                value={redeemKey}
                onChange={(e) => setRedeemKey(e.target.value)}
                placeholder={gt("Optional, replays on duplicate")}
                className="w-64"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => validatePreview.mutate(orderAmount)}
              disabled={validatePreview.isPending}
            >
              {validatePreview.isPending ? <T>Validating…</T> : <T>Validate</T>}
            </Button>
            <Button
              type="button"
              onClick={() =>
                redeem.mutate({
                  amount: orderAmount,
                  idempotencyKey: redeemKey || undefined,
                })
              }
              disabled={redeem.isPending}
            >
              {redeem.isPending ? <T>Redeeming…</T> : <T>Redeem</T>}
            </Button>
          </div>

          {validatePreview.data ? (
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(validatePreview.data, null, 2)}
            </pre>
          ) : null}
          {redeem.data ? (
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(redeem.data, null, 2)}
            </pre>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
