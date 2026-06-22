"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { CampaignForm, type CampaignFormState } from "@/components/dashboard/campaign-form";
import { ovx } from "@/lib/sdk";

function toIsoOrUndefined(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export default function NewCampaignPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get({}),
  });

  const create = useMutation({
    mutationFn: (state: CampaignFormState) =>
      ovx().campaigns.create({
        name: state.name,
        description: state.description || undefined,
        type: state.type,
        currency: state.currency,
        timezone: state.timezone || undefined,
        startDate: toIsoOrUndefined(state.startDate),
        endDate: toIsoOrUndefined(state.endDate),
        perUserRedemptionLimit:
          state.perUserRedemptionLimit === "" ? undefined : state.perUserRedemptionLimit,
        autoApply: state.autoApply,
        codeConfig: {
          length: state.codeLength,
          prefix: state.codePrefix || undefined,
        },
      }),
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(gt("Campaign created"));
      router.push(`/campaigns/${campaign.id}`);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Create failed"));
    },
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New campaign</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>Pick a type, set a currency, and configure activation.</T>
        </p>
      </header>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          <T>Loading…</T>
        </p>
      ) : (
        <CampaignForm
          key={workspace?.defaultCurrency}
          mode="create"
          initial={{
            name: "",
            description: "",
            type: "DISCOUNT",
            status: "draft",
            currency: workspace?.defaultCurrency ?? "",
            timezone: workspace?.defaultTimezone ?? "UTC",
            startDate: "",
            endDate: "",
            perUserRedemptionLimit: "",
            autoApply: false,
            codeLength: 8,
            codePrefix: "",
          }}
          submitLabel={gt("Create campaign")}
          pending={create.isPending}
          onSubmit={(state) => create.mutate(state)}
        />
      )}
    </div>
  );
}
