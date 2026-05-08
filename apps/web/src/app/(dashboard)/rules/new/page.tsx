"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { RuleForm, type RuleFormState } from "@/components/dashboard/rule-form";
import { ovx } from "@/lib/sdk";

export default function NewRulePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const create = useMutation({
    mutationFn: (state: RuleFormState) =>
      ovx().validationRules.create({
        name: state.name,
        description: state.description || undefined,
        appliesTo: state.appliesTo,
        rule: state.rule,
      }),
    onSuccess: async (rule) => {
      await queryClient.invalidateQueries({ queryKey: ["validationRules"] });
      toast.success(gt("Rule created"));
      router.push(`/rules/${rule.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New validation rule</T>
        </h1>
      </header>
      <RuleForm
        initial={{ name: "", description: "", appliesTo: "voucher", rule: {} }}
        submitLabel={gt("Create rule")}
        pending={create.isPending}
        onSubmit={(state) => create.mutate(state)}
      />
    </div>
  );
}
