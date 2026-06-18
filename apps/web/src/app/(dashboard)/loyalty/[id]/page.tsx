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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LoyaltyProgramPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data: program, isLoading } = useQuery({
    queryKey: ["loyaltyPrograms", id],
    queryFn: () => ovx().loyalty.programs.get({ params: { id } }),
  });

  const remove = useMutation({
    mutationFn: () => ovx().loyalty.programs.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyPrograms"] });
      toast.success(gt("Program deleted"));
      router.push("/loyalty");
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
            render={<Link href="/loyalty" aria-label={gt("Back to loyalty")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              <T>Loyalty program</T>
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
            "Soft-delete. Member ledgers stay intact for audit but no new earning happens.",
          )}
          confirmLabel={gt("Delete program")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tiers">
            <T>Tiers</T>
          </TabsTrigger>
          <TabsTrigger value="rules">
            <T>Earning rules</T>
          </TabsTrigger>
          <TabsTrigger value="rewards">
            <T>Rewards</T>
          </TabsTrigger>
          <TabsTrigger value="members">
            <T>Members</T>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tiers">
          <TiersTab programId={id} />
        </TabsContent>
        <TabsContent value="rules">
          <EarningRulesTab programId={id} />
        </TabsContent>
        <TabsContent value="rewards">
          <RewardsTab programId={id} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab programId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TiersTab({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(0);
  const [multiplier, setMultiplier] = useState(10000);

  const { data } = useQuery({
    queryKey: ["loyaltyTiers", programId],
    queryFn: () => ovx().loyalty.tiers.list({ params: { programId } }),
  });

  const create = useMutation({
    mutationFn: () =>
      ovx().loyalty.tiers.create({
        programId,
        name,
        threshold,
        earnMultiplier: multiplier,
        sortOrder: 0,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyTiers", programId] });
      setName("");
      setThreshold(0);
      setMultiplier(10000);
      toast.success(gt("Tier added"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const remove = useMutation({
    mutationFn: (tierId: string) => ovx().loyalty.tiers.delete({ params: { id: tierId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyTiers", programId] });
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    { accessorKey: "name", header: () => <T>Name</T> },
    {
      accessorKey: "threshold",
      header: () => <div className="text-right"><T>Threshold</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">{row.original.threshold}</div>
      ),
    },
    {
      accessorKey: "earnMultiplier",
      header: () => <div className="text-right"><T>Multiplier</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">
          {(row.original.earnMultiplier / 10000).toFixed(2)}x
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate(row.original.id)}
            aria-label={gt("Delete tier")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Tiers</T>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="tier-name">
              <T>Name</T>
            </Label>
            <Input
              id="tier-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bronze"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier-threshold">
              <T>Threshold</T>
            </Label>
            <Input
              id="tier-threshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier-multiplier">
              <T>Multiplier (bps)</T>
            </Label>
            <Input
              id="tier-multiplier"
              type="number"
              min={0}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending || !name.trim()}
            >
              <Plus className="size-4" />
              <T>Add</T>
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          emptyMessage={<T>No tiers yet.</T>}
        />
      </CardContent>
    </Card>
  );
}

function EarningRulesTab({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [name, setName] = useState("");
  const [event, setEvent] = useState("order.paid");
  const [kind, setKind] = useState<"fixed" | "per_cents" | "custom">("per_cents");
  const [value, setValue] = useState(1);
  const [divisor, setDivisor] = useState(100);

  const { data } = useQuery({
    queryKey: ["loyaltyEarningRules", programId],
    queryFn: () => ovx().loyalty.earningRules.list({ params: { programId } }),
  });

  const create = useMutation({
    mutationFn: () =>
      ovx().loyalty.earningRules.create({
        programId,
        name,
        event,
        formula: { kind, value, divisor },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyEarningRules", programId] });
      setName("");
      toast.success(gt("Rule added"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ovx().loyalty.earningRules.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyEarningRules", programId] });
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    { accessorKey: "name", header: () => <T>Name</T> },
    {
      accessorKey: "event",
      header: () => <T>Event</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.original.event}</span>
      ),
    },
    {
      accessorKey: "formula",
      header: () => <T>Formula</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {JSON.stringify(row.original.formula)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate(row.original.id)}
            aria-label={gt("Delete rule")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Earning rules</T>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="rule-name">
              <T>Name</T>
            </Label>
            <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-event">
              <T>Event</T>
            </Label>
            <Input
              id="rule-event"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="order.paid"
            />
          </div>
          <div className="space-y-2">
            <Label>
              <T>Kind</T>
            </Label>
            <Select
              items={[
                { label: gt("Fixed"), value: "fixed" },
                { label: gt("Per cents"), value: "per_cents" },
                { label: gt("Custom"), value: "custom" },
              ]}
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">{gt("Fixed")}</SelectItem>
                <SelectItem value="per_cents">{gt("Per cents")}</SelectItem>
                <SelectItem value="custom">{gt("Custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rule-value">
              {kind === "per_cents" ? <T>Divisor</T> : <T>Value</T>}
            </Label>
            <Input
              id="rule-value"
              type="number"
              min={1}
              value={kind === "per_cents" ? divisor : value}
              onChange={(e) =>
                kind === "per_cents"
                  ? setDivisor(Number(e.target.value))
                  : setValue(Number(e.target.value))
              }
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending || !name.trim() || !event.trim()}
            >
              <Plus className="size-4" />
              <T>Add</T>
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          emptyMessage={<T>No rules yet.</T>}
        />
      </CardContent>
    </Card>
  );
}

function RewardsTab({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [name, setName] = useState("");
  const [cost, setCost] = useState(500);
  const [kind, setKind] = useState<"discount" | "gift_card" | "custom">("discount");
  const [amount, setAmount] = useState(1000);

  const { data } = useQuery({
    queryKey: ["loyaltyRewards", programId],
    queryFn: () => ovx().loyalty.rewards.list({ params: { programId } }),
  });

  const create = useMutation({
    mutationFn: () =>
      ovx().loyalty.rewards.create({
        programId,
        name,
        cost,
        payload:
          kind === "discount"
            ? { kind, discount: { type: "AMOUNT", amount } }
            : kind === "gift_card"
              ? { kind, creditCents: amount }
              : { kind, typeKey: "CUSTOM", payload: {} },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyRewards", programId] });
      setName("");
      toast.success(gt("Reward added"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Create failed")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => ovx().loyalty.rewards.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyRewards", programId] });
    },
  });
  const columns: ColumnDef<DataTableRow>[] = [
    { accessorKey: "name", header: () => <T>Name</T> },
    {
      accessorKey: "cost",
      header: () => <div className="text-right"><T>Cost</T></div>,
      cell: ({ row }) => <div className="text-right text-muted-foreground">{row.original.cost}</div>,
    },
    {
      accessorKey: "payload",
      header: () => <T>Payload</T>,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {JSON.stringify(row.original.payload)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <div className="text-right" />,
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => remove.mutate(row.original.id)}
            aria-label={gt("Delete reward")}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Rewards</T>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="reward-name">
              <T>Name</T>
            </Label>
            <Input id="reward-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward-cost">
              <T>Cost (points)</T>
            </Label>
            <Input
              id="reward-cost"
              type="number"
              min={1}
              value={cost}
              onChange={(e) => setCost(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>
              <T>Kind</T>
            </Label>
            <Select
              items={[
                { label: gt("Discount"), value: "discount" },
                { label: gt("Gift card"), value: "gift_card" },
                { label: gt("Custom"), value: "custom" },
              ]}
              value={kind}
              onValueChange={(v) => setKind(v as typeof kind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discount">{gt("Discount")}</SelectItem>
                <SelectItem value="gift_card">{gt("Gift card")}</SelectItem>
                <SelectItem value="custom">{gt("Custom")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reward-amount">
              <T>Amount (cents)</T>
            </Label>
            <Input
              id="reward-amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending || !name.trim()}
            >
              <Plus className="size-4" />
              <T>Add</T>
            </Button>
          </div>
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          emptyMessage={<T>No rewards yet.</T>}
        />
      </CardContent>
    </Card>
  );
}

function MembersTab({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const gt = useGT();
  const [customerId, setCustomerId] = useState("");

  const { data } = useQuery({
    queryKey: ["loyaltyMembers", programId],
    queryFn: () => ovx().loyalty.members.list({ params: { programId }, query: { limit: 50 } }),
  });

  const enroll = useMutation({
    mutationFn: () => ovx().loyalty.members.enroll({ programId, customerId }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyMembers", programId] });
      setCustomerId("");
      toast.success(gt("Member enrolled"));
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : gt("Enroll failed")),
  });
  const columns: ColumnDef<DataTableRow>[] = [
    {
      accessorKey: "customerId",
      header: () => <T>Customer</T>,
      cell: ({ row }) => (
        <Link className="font-mono text-xs hover:underline" href={`/loyalty/members/${row.original.id}`}>
          {row.original.customerId}
        </Link>
      ),
    },
    {
      accessorKey: "balance",
      header: () => <div className="text-right"><T>Balance</T></div>,
      cell: ({ row }) => (
        <div className="text-right">
          <Badge>{row.original.balance}</Badge>
        </div>
      ),
    },
    {
      accessorKey: "lifetimePoints",
      header: () => <div className="text-right"><T>Lifetime</T></div>,
      cell: ({ row }) => (
        <div className="text-right text-muted-foreground">{row.original.lifetimePoints}</div>
      ),
    },
    {
      accessorKey: "currentTierId",
      header: () => <T>Tier</T>,
      cell: () => <span className="text-muted-foreground">-</span>,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <T>Members</T>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="space-y-2 flex-1">
            <Label htmlFor="enroll-customer">
              <T>Customer ID</T>
            </Label>
            <Input
              id="enroll-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder={gt("Customer UUID")}
              className="font-mono text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending || !customerId.trim()}
          >
            <Plus className="size-4" />
            <T>Enroll</T>
          </Button>
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          emptyMessage={<T>No members yet.</T>}
        />
      </CardContent>
    </Card>
  );
}
