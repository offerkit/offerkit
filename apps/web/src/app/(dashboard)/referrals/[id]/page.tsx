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

export default function ReferralProgramDetail({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const [referrerCustomerId, setReferrerCustomerId] = useState("");
  const [convertCode, setConvertCode] = useState("");
  const [refereeCustomerId, setRefereeCustomerId] = useState("");

  const { data: program, isLoading } = useQuery({
    queryKey: ["referralPrograms", id],
    queryFn: () => ovx().referrals.programs.get({ id }),
  });

  const { data: list } = useQuery({
    queryKey: ["referrals", id],
    queryFn: () => ovx().referrals.listReferrals({ programId: id, limit: 50 }),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["referrals", id] });
  };

  const issue = useMutation({
    mutationFn: () =>
      ovx().referrals.issue({ programId: id, referrerCustomerId }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Issue failed"));
      else {
        toast.success(gt("Code issued: {code}").replace("{code}", r.code ?? ""));
        setReferrerCustomerId("");
        await refresh();
      }
    },
  });

  const convert = useMutation({
    mutationFn: () =>
      ovx().referrals.convert({ code: convertCode, refereeCustomerId }),
    onSuccess: async (r) => {
      if (!r.ok) toast.error(r.message ?? gt("Convert failed"));
      else {
        toast.success(gt("Conversion succeeded"));
        setConvertCode("");
        setRefereeCustomerId("");
        await refresh();
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().referrals.programs.delete({ id }),
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
            "Soft-delete. Existing referrals stay intact for audit but no new codes can be issued.",
          )}
          confirmLabel={gt("Delete program")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Referrer reward</T>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(program.referrerReward, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Referee reward</T>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(program.refereeReward, null, 2)}
            </pre>
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Referrals</T>
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
                  <TableHead>
                    <T>Referee</T>
                  </TableHead>
                  <TableHead>
                    <T>Status</T>
                  </TableHead>
                  <TableHead className="text-right">
                    <T>Created</T>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!list || list.data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      <T>No referrals yet.</T>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.data.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm">{r.code}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.referrerCustomerId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {r.refereeCustomerId
                          ? `${r.refereeCustomerId.slice(0, 8)}…`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "converted" ? "default" : "secondary"}
                        >
                          {r.status}
                        </Badge>
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
    </div>
  );
}
