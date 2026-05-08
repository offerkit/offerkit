"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { SegmentForm } from "@/components/dashboard/segment-form";
import { ovx } from "@/lib/sdk";

export default function NewSegmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const create = useMutation({
    mutationFn: (state: { name: string; description: string; rule: Record<string, unknown> }) =>
      ovx().segments.create({
        name: state.name,
        description: state.description || undefined,
        rule: state.rule,
      }),
    onSuccess: async (segment) => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success(gt("Segment created"));
      router.push(`/segments/${segment.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New segment</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Define a JSON Logic rule and preview matching customers.</T>
        </p>
      </header>
      <SegmentForm
        initial={{ name: "", description: "", rule: {} }}
        submitLabel={gt("Create segment")}
        pending={create.isPending}
        onSubmit={(state) => create.mutate(state)}
      />
    </div>
  );
}
