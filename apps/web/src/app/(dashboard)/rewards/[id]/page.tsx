"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import {
  RewardTypeForm,
  type RewardTypeFormState,
} from "@/components/dashboard/reward-type-form";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RewardTypeDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data, isLoading } = useQuery({
    queryKey: ["rewardTypes", id],
    queryFn: () => ovx().rewardTypes.get({ id }),
  });

  const update = useMutation({
    mutationFn: (state: RewardTypeFormState) =>
      ovx().rewardTypes.update({
        id,
        patch: {
          name: state.name,
          description: state.description || undefined,
          payloadSchema: state.payloadSchema,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rewardTypes"] });
      toast.success(gt("Reward type updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().rewardTypes.delete({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rewardTypes"] });
      toast.success(gt("Reward type deleted"));
      router.push("/rewards");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Delete failed"));
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
        <T>Reward type not found.</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/rewards" aria-label={gt("Back to reward types")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.key}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated {new Date(data.updatedAt).toLocaleString()}</T>
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
          title={gt("Delete this reward type?")}
          description={gt(
            "Vouchers carrying this reward will continue to emit it from the last revision. Soft-deleted.",
          )}
          confirmLabel={gt("Delete reward type")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>
      <RewardTypeForm
        key={data.updatedAt}
        mode="edit"
        initial={{
          key: data.key,
          name: data.name,
          description: data.description ?? "",
          payloadSchema: data.payloadSchema,
        }}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />
    </div>
  );
}
