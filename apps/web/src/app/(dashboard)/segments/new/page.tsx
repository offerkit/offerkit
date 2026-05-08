"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SegmentForm } from "@/components/dashboard/segment-form";
import { ovx } from "@/lib/sdk";

export default function NewSegmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: (state: { name: string; description: string; rule: Record<string, unknown> }) =>
      ovx().segments.create({
        name: state.name,
        description: state.description || undefined,
        rule: state.rule,
      }),
    onSuccess: async (segment) => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment created");
      router.push(`/segments/${segment.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Create failed");
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New segment</h1>
        <p className="text-sm text-muted-foreground">
          Define a JSON Logic rule and preview matching customers.
        </p>
      </header>
      <SegmentForm
        initial={{ name: "", description: "", rule: {} }}
        submitLabel="Create segment"
        pending={create.isPending}
        onSubmit={(state) => create.mutate(state)}
      />
    </div>
  );
}
