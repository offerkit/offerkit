"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ReferralReward = {
  kind: "discount" | "gift_card" | "loyalty_points" | "custom";
  discount?: { type: "AMOUNT" | "PERCENTAGE"; amount?: number; percent?: number };
  creditCents?: number;
  loyaltyProgramId?: string;
  loyaltyPoints?: number;
  typeKey?: string;
};

type ReferralOutcome = {
  kind: "discount" | "gift_card" | "loyalty_points" | "custom";
  voucherCode?: string;
  loyaltyTransactionId?: string;
  payload?: Record<string, unknown>;
};

type LastConversion = {
  conversionId?: string;
  code?: string;
  referrerReward?: ReferralOutcome;
  refereeReward?: ReferralOutcome;
};

function cents(value: number | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value / 100);
}

function rewardKindLabel(kind: ReferralReward["kind"]): string {
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

function rewardDescription(reward: ReferralReward): string {
  if (reward.kind === "discount") {
    if (reward.discount?.type === "PERCENTAGE") {
      return `${(reward.discount.percent ?? 0) / 100}% off`;
    }
    return `${cents(reward.discount?.amount)} off`;
  }
  if (reward.kind === "gift_card") return `${cents(reward.creditCents)} credit`;
  if (reward.kind === "loyalty_points") return `${reward.loyaltyPoints ?? 0} points`;
  return reward.typeKey || "Custom payload";
}

function RewardSummary({ title, reward }: { title: string; reward: ReferralReward }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge variant="secondary">{rewardKindLabel(reward.kind)}</Badge>
        <p className="text-sm font-medium">{rewardDescription(reward)}</p>
        {reward.kind === "loyalty_points" && reward.loyaltyProgramId ? (
          <p className="font-mono text-xs text-muted-foreground">{reward.loyaltyProgramId}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function OutcomeSummary({ label, outcome }: { label: string; outcome: ReferralOutcome | undefined }) {
  if (!outcome) return null;
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{rewardKindLabel(outcome.kind)}</Badge>
        {outcome.voucherCode ? (
          <Link className="font-mono text-sm hover:underline" href={`/vouchers/${outcome.voucherCode}`}>
            {outcome.voucherCode}
          </Link>
        ) : null}
        {outcome.loyaltyTransactionId ? (
          <span className="font-mono text-xs text-muted-foreground">
            {outcome.loyaltyTransactionId}
          </span>
        ) : null}
        {outcome.kind === "custom" ? (
          <span className="text-sm text-muted-foreground">Custom payload emitted</span>
        ) : null}
      </div>
    </div>
  );
}

export default function ReferralProgramDetail({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [referrerCustomerId, setReferrerCustomerId] = useState("");
  const [convertCode, setConvertCode] = useState("");
  const [refereeCustomerId, setRefereeCustomerId] = useState("");
  const [lastIssued, setLastIssued] = useState<{ codeId?: string; code?: string } | null>(null);
  const [lastConversion, setLastConversion] = useState<LastConversion | null>(null);

  const { data: program, isLoading } = useQuery({
    queryKey: ["referralPrograms", id],
    queryFn: () => ovx().referrals.programs.get({ params: { id } }),
  });

  const codesQuery = useQuery({
    queryKey: ["referralCodes", id],
    queryFn: () => ovx().referrals.listCodes({ params: { programId: id }, query: { limit: 50 } }),
  });
  const { data: list } = codesQuery;

  const conversionsQuery = useQuery({
    queryKey: ["referralConversions", "program", id],
    queryFn: () =>
      ovx().referrals.listProgramConversions({
        params: { programId: id },
        query: { limit: 25 },
      }),
  });

  const issue = useMutation({
    mutationFn: () =>
      ovx().referrals.issue({ programId: id, referrerCustomerId }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Issue failed"));
      else {
        setLastIssued({ codeId: r.codeId, code: r.code });
        toast.success(r.code ? `Code issued: ${r.code}` : gt("Code issued"));
        setReferrerCustomerId("");
        await codesQuery.refetch();
      }
    },
  });

  const convert = useMutation({
    mutationFn: () =>
      ovx().referrals.convert({ code: convertCode, refereeCustomerId }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Convert failed"));
      else {
        setLastConversion({
          conversionId: r.conversionId,
          code: r.code,
          referrerReward: r.referrerReward,
          refereeReward: r.refereeReward,
        });
        toast.success(gt("Conversion succeeded"));
        setConvertCode("");
        setRefereeCustomerId("");
        await Promise.all([
          conversionsQuery.refetch(),
          queryClient.invalidateQueries({ queryKey: ["vouchers"] }),
        ]);
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().referrals.programs.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["referralPrograms"] });
      toast.success(gt("Program deleted"));
      router.push("/referrals");
    },
  });

  if (isLoading)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Loading…</T>
      </p>
    );
  if (!program)
    return (
      <p className="text-sm text-muted-foreground">
        <T>Program not found.</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/referrals" aria-label={gt("Back to referrals")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <T>Referral program</T>
            </h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated {new Date(program.updatedAt).toLocaleString()}</T>
            </p>
          </div>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={remove.isPending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this program?")}
          description={gt(
            "Soft-delete. Existing codes and conversions stay intact for audit but no new codes can be issued.",
          )}
          confirmLabel={gt("Delete program")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <RewardSummary title={gt("Referrer reward")} reward={program.referrerReward} />
        <RewardSummary title={gt("Referee reward")} reward={program.refereeReward} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Issue code</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor="referrer-id">
              <T>Referrer customer ID</T>
            </Label>
            <Input
              id="referrer-id"
              value={referrerCustomerId}
              onChange={(e) => setReferrerCustomerId(e.target.value)}
              placeholder={gt("Customer UUID")}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={() => issue.mutate()}
            disabled={issue.isPending || !referrerCustomerId.trim()}
          >
            <Plus className="size-4" />
            {issue.isPending ? <T>Issuing…</T> : <T>Issue code</T>}
          </Button>
          {lastIssued?.code ? (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                <T>Issued</T>
              </span>{" "}
              <span className="font-mono">{lastIssued.code}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Convert</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor="convert-code">
              <T>Referral code</T>
            </Label>
            <Input
              id="convert-code"
              value={convertCode}
              onChange={(e) => setConvertCode(e.target.value)}
              placeholder="ALICE-7K3PQ9LM"
              className="font-mono"
            />
          </div>
          <div className="space-y-2 flex-1">
            <Label htmlFor="referee-id">
              <T>Referee customer ID</T>
            </Label>
            <Input
              id="referee-id"
              value={refereeCustomerId}
              onChange={(e) => setRefereeCustomerId(e.target.value)}
              placeholder={gt("Customer UUID")}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={() => convert.mutate()}
            disabled={convert.isPending || !convertCode.trim() || !refereeCustomerId.trim()}
          >
            {convert.isPending ? <T>Converting…</T> : <T>Convert</T>}
          </Button>
        </CardContent>
      </Card>

      {lastConversion ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Latest conversion</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {lastConversion.code ? (
                <span>
                  <T>Code</T> <span className="font-mono">{lastConversion.code}</span>
                </span>
              ) : null}
              {lastConversion.conversionId ? (
                <span>
                  <T>Conversion</T>{" "}
                  <span className="font-mono">{lastConversion.conversionId.slice(0, 8)}…</span>
                </span>
              ) : null}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <OutcomeSummary label={gt("Referrer reward")} outcome={lastConversion.referrerReward} />
              <OutcomeSummary label={gt("Referee reward")} outcome={lastConversion.refereeReward} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Referral codes</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T>Code</T>
                  </TableHead>
                  <TableHead>
                    <T>Referrer</T>
                  </TableHead>
                  <TableHead className="text-right">
                    <T>Created</T>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!list || list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      <T>No codes yet.</T>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.referrerCustomerId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Recent conversions</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <T>Code</T>
                  </TableHead>
                  <TableHead>
                    <T>Referrer reward</T>
                  </TableHead>
                  <TableHead>
                    <T>Referee reward</T>
                  </TableHead>
                  <TableHead className="text-right">
                    <T>Converted</T>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!conversionsQuery.data || conversionsQuery.data.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      <T>No conversions yet.</T>
                    </TableCell>
                  </TableRow>
                ) : (
                  conversionsQuery.data.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-mono text-sm">{r.code}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {r.refereeCustomerId.slice(0, 8)}…
                        </div>
                      </TableCell>
                      <TableCell>
                        <OutcomeSummary label={gt("Referrer")} outcome={r.referrerOutcome} />
                      </TableCell>
                      <TableCell>
                        <OutcomeSummary label={gt("Referee")} outcome={r.refereeOutcome} />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {new Date(r.convertedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
