"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DataTable, type DataTableRow } from "@/components/dashboard/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CampaignForm,
  type CampaignFormState,
} from "@/components/dashboard/campaign-form";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

function fromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  // datetime-local needs `YYYY-MM-DDTHH:mm` without seconds/timezone.
  return new Date(iso).toISOString().slice(0, 16);
}

function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function CampaignDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkDiscountAmount, setBulkDiscountAmount] = useState(1000);
  const [bulkGiftBalance, setBulkGiftBalance] = useState(10000);

  const { data, isLoading } = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => ovx().campaigns.get({ params: { id } }),
  });

  const { data: vouchers } = useQuery({
    queryKey: ["vouchers", { campaignId: id }],
    queryFn: () => ovx().vouchers.list({ campaignId: id, limit: 50 }),
    enabled: !!data,
  });

  const update = useMutation({
    mutationFn: (state: CampaignFormState) =>
      ovx().campaigns.update({
        params: { id },
        body: {
          patch: {
            name: state.name,
            description: state.description || undefined,
            status: state.status,
            currency: state.currency,
            timezone: state.timezone || undefined,
            startDate: toIsoOrUndefined(state.startDate),
            endDate: toIsoOrUndefined(state.endDate),
            perUserRedemptionLimit:
              state.perUserRedemptionLimit === "" ? undefined : state.perUserRedemptionLimit,
            autoApply: state.autoApply,
            codeConfig: {
              length: state.codeLength,
              prefix: state.codePrefix || undefined,
            },
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(gt("Campaign updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().campaigns.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(gt("Campaign deleted"));
      router.push("/campaigns");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Delete failed"));
    },
  });

  const bulk = useMutation({
    mutationFn: (input: {
      count: number;
      discount?: { type: "AMOUNT"; amount: number };
      giftBalance?: number;
    }) => ovx().vouchers.bulk({ campaignId: id, ...input }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      await queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
      toast.success(
        res.jobId
          ? gt("Bulk generation queued")
          : `Generated ${res.generated} voucher${res.generated === 1 ? "" : "s"}`,
      );
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Bulk generate failed"));
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
        <T>Campaign not found.</T>
      </p>
    );

  const cfg = data.codeConfig as { length?: number; prefix?: string };
  const supportsVouchers = data.type === "DISCOUNT" || data.type === "GIFT_VOUCHERS";
  const isGiftVoucherCampaign = data.type === "GIFT_VOUCHERS";
  const bulkValueInvalid = isGiftVoucherCampaign
    ? bulkGiftBalance < 1
    : bulkDiscountAmount < 1;
  const voucherColumns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "code",
      header: () => <T>Code</T>,
      cell: ({ row }) => (
        <Link className="font-mono text-sm hover:underline" href={`/vouchers/${row.original.code}`}>
          {row.original.code}
        </Link>
      ),
    },
    {
      accessorKey: "type",
      header: () => <T>Type</T>,
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.type}</span>,
    },
    {
      accessorKey: "redemptionCount",
      header: () => <div className="text-right"><T>Redemptions</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {row.original.redemptionCount}
          {row.original.redemptionLimit ? ` / ${String(row.original.redemptionLimit)}` : ""}
        </div>
      ),
    },
    {
      accessorKey: "active",
      header: () => <div className="text-right"><T>Active</T></div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Badge variant={row.original.active ? "default" : "secondary"}>
            {row.original.active ? gt("yes") : gt("no")}
          </Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/campaigns" aria-label={gt("Back to campaigns")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated {new Date(data.updatedAt).toLocaleString()}</T>
            </p>
          </div>
          <Badge variant={data.status === "active" ? "default" : "secondary"}>
            {data.status}
          </Badge>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={remove.isPending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this campaign?")}
          description={gt(
            "The campaign and its vouchers will be soft-deleted. Existing redemptions stay intact.",
          )}
          confirmLabel={gt("Delete campaign")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <CampaignForm
        key={data.updatedAt}
        mode="edit"
        initial={{
          name: data.name,
          description: data.description ?? "",
          type: data.type,
          status: data.status,
          currency: data.currency,
          timezone: data.timezone,
          startDate: fromIso(data.startDate),
          endDate: fromIso(data.endDate),
          perUserRedemptionLimit: data.perUserRedemptionLimit ?? "",
          autoApply: data.autoApply,
          codeLength: cfg.length ?? 8,
          codePrefix: cfg.prefix ?? "",
        }}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />

      {supportsVouchers ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Vouchers</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-count">
                  <T>Bulk generate</T>
                </Label>
                <Input
                  id="bulk-count"
                  type="number"
                  min={1}
                  max={100000}
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Number(e.target.value))}
                  className="w-32"
                />
              </div>
              {isGiftVoucherCampaign ? (
                <div className="space-y-2">
                  <Label htmlFor="bulk-gift-balance">
                    <T>Gift card balance (cents)</T>
                  </Label>
                  <Input
                    id="bulk-gift-balance"
                    type="number"
                    min={1}
                    value={bulkGiftBalance}
                    onChange={(e) => setBulkGiftBalance(Number(e.target.value))}
                    className="w-44"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="bulk-discount-amount">
                    <T>Discount amount (cents)</T>
                  </Label>
                  <Input
                    id="bulk-discount-amount"
                    type="number"
                    min={1}
                    value={bulkDiscountAmount}
                    onChange={(e) => setBulkDiscountAmount(Number(e.target.value))}
                    className="w-44"
                  />
                </div>
              )}
              <Button
                type="button"
                onClick={() =>
                  bulk.mutate(
                    isGiftVoucherCampaign
                      ? { count: bulkCount, giftBalance: bulkGiftBalance }
                      : {
                          count: bulkCount,
                          discount: { type: "AMOUNT", amount: bulkDiscountAmount },
                        },
                  )
                }
                disabled={bulk.isPending || bulkCount < 1 || bulkValueInvalid}
              >
                <Plus className="size-4" />
                {bulk.isPending ? <T>Generating…</T> : <T>Generate codes</T>}
              </Button>
              <Button variant="outline" render={<Link href={`/vouchers/new?campaignId=${id}`} />}>
                <T>Single voucher</T>
              </Button>
            </div>

            <DataTable
              columns={voucherColumns}
              data={vouchers?.data ?? []}
              emptyMessage={<T>No vouchers in this campaign.</T>}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
