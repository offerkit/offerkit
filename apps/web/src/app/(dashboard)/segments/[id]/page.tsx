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
import { SegmentForm } from "@/components/dashboard/segment-form";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SegmentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data, isLoading } = useQuery({
    queryKey: ["segments", id],
    queryFn: () => ovx().segments.get({ id }),
  });

  const update = useMutation({
    mutationFn: (state: { name: string; description: string; rule: Record<string, unknown> }) =>
      ovx().segments.update({
        id,
        patch: {
          name: state.name,
          description: state.description || undefined,
          rule: state.rule,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success(gt("Segment updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const remove = useMutation({
    mutationFn: () => ovx().segments.delete({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success(gt("Segment deleted"));
      router.push("/segments");
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
        <T>Segment not found.</T>
      </p>
    );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/segments" aria-label={gt("Back to segments")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
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
          title={gt("Delete this segment?")}
          description={gt(
            "The segment will be soft-deleted. Existing campaigns referencing it will fail validation until re-pointed.",
          )}
          confirmLabel={gt("Delete segment")}
          destructive
          pending={remove.isPending}
          onConfirm={() => remove.mutate()}
        />
      </header>
      <SegmentForm
        key={data.updatedAt}
        initial={{ name: data.name, description: data.description ?? "", rule: data.rule }}
        submitLabel={gt("Save changes")}
        pending={update.isPending}
        onSubmit={(state) => update.mutate(state)}
      />
    </div>
  );
}
