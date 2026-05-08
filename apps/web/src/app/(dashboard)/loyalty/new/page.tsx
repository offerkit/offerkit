"use client";

import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
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
import { ovx } from "@/lib/sdk";

export default function NewLoyaltyProgramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", "loyalty-only"],
    queryFn: () => ovx().campaigns.list({ limit: 100 }),
  });
  const eligible = (campaigns?.data ?? []).filter((c) => c.type === "LOYALTY_PROGRAM");

  const create = useMutation({
    mutationFn: (state: { campaignId: string; pointsExpiryDays: number | "" }) =>
      ovx().loyalty.programs.create({
        campaignId: state.campaignId,
        pointsExpiryDays:
          state.pointsExpiryDays === "" ? undefined : state.pointsExpiryDays,
      }),
    onSuccess: async (program) => {
      await queryClient.invalidateQueries({ queryKey: ["loyaltyPrograms"] });
      toast.success(gt("Program created"));
      router.push(`/loyalty/${program.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  const form = useForm({
    defaultValues: {
      campaignId: "",
      pointsExpiryDays: "" as number | "",
    },
    onSubmit: ({ value }) => create.mutate(value),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New loyalty program</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Bind to a campaign of type LOYALTY_PROGRAM. Configure points expiry.</T>
        </p>
      </header>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Settings</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <form.Field name="campaignId">
              {(field) => (
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    <T>Campaign</T>
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          eligible.length === 0
                            ? gt("Create a LOYALTY_PROGRAM campaign first")
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
              )}
            </form.Field>
            <form.Field name="pointsExpiryDays">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Points expire after (days)</T>
                  </Label>
                  <Input
                    id={field.name}
                    type="number"
                    min={1}
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder={gt("Blank = never expire")}
                  />
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <form.Subscribe selector={(s) => [s.values.campaignId, s.isSubmitting] as const}>
            {([campaignId, isSubmitting]) => (
              <Button
                type="submit"
                disabled={create.isPending || isSubmitting || !campaignId}
              >
                {create.isPending || isSubmitting ? <T>Creating…</T> : <T>Create program</T>}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>
    </div>
  );
}
