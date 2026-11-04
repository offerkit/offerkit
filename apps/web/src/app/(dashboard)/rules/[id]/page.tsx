"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, DateTime, useGT } from "gt-next/client";
import { useApiErrorMessage } from "@/lib/api-error-message";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { RuleForm, type RuleFormState } from "@/components/dashboard/rule-form";
import { ovx } from "@/lib/sdk";
import { DATE_TIME_FORMAT } from "@/lib/date-format";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RuleDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const apiError = useApiErrorMessage();

  const { data, isLoading } = useQuery({
    queryKey: ["validationRules", id],
    queryFn: () => ovx().validationRules.get({ params: { id } }),
  });

  const update = useMutation({
    mutationFn: (state: RuleFormState) =>
      ovx().validationRules.update({
        params: { id },
        body: {
          patch: {
            name: state.name,
            description: state.description || undefined,
            appliesTo: state.appliesTo,
            rule: state.rule,
          },
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["validationRules"] });
      toast.success(gt("Rule updated"));
    },
    onError: (err: unknown) => {
      toast.error(apiError(err, gt("Update failed")));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().validationRules.delete({ params: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["validationRules"] });
      toast.success(gt("Rule deleted"));
      router.push("/rules");
    },
    onError: (err: unknown) => {
      toast.error(apiError(err, gt("Delete failed")));
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
        <T>Rule not found.</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/rules" aria-label={gt("Back to rules")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Updated <DateTime options={DATE_TIME_FORMAT}>{new Date(data.updatedAt)}</DateTime></T>
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
          title={gt("Delete this rule?")}
          description={gt(
            "Campaigns referencing this rule will lose validation. Soft-deleted; can be restored from the database.",
          )}
          confirmLabel={gt("Delete rule")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>
      <RuleForm
        key={data.updatedAt}
        initial={{
          name: data.name,
          description: data.description ?? "",
          appliesTo: data.appliesTo,
          rule: data.rule,
        }}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />
    </div>
  );
}
