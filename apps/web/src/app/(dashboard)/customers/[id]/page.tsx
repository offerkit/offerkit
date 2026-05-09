"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { ovx } from "@/lib/sdk";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface CustomerData {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

function CustomerForm({
  data,
  onDelete,
  deletePending,
}: {
  data: CustomerData;
  onDelete: () => void | Promise<void>;
  deletePending: boolean;
}) {
  const queryClient = useQueryClient();
  const gt = useGT();

  const update = useMutation({
    mutationFn: (input: { email?: string; name?: string; phone?: string }) =>
      ovx().customers.update({ id: data.id, patch: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(gt("Customer updated"));
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : gt("Update failed"));
    },
  });

  const form = useForm({
    defaultValues: {
      email: data.email ?? "",
      name: data.name ?? "",
      phone: data.phone ?? "",
    },
    onSubmit: ({ value }) => {
      update.mutate({
        email: value.email || undefined,
        name: value.name || undefined,
        phone: value.phone || undefined,
      });
    },
  });

  const headerLabel = data.name ?? data.email ?? gt("(unnamed)");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/customers" aria-label={gt("Back to customers")} />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{headerLabel}</h1>
            <p className="text-sm text-muted-foreground">
              <T>Created {new Date(data.createdAt).toLocaleString()}</T>
            </p>
          </div>
        </div>
        <ConfirmDialog
          trigger={
            <Button variant="outline" disabled={deletePending}>
              <Trash2 className="size-4" />
              <T>Delete</T>
            </Button>
          }
          title={gt("Delete this customer?")}
          description={gt(
            "The customer will be soft-deleted. Their redemption history is kept for audit, but they will no longer appear in lists or be reachable through the API.",
          )}
          confirmLabel={gt("Delete customer")}
          destructive
          pending={deletePending}
          onConfirm={onDelete}
        />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Profile</T>
          </CardTitle>
          <CardDescription>
            <T>Edit and save to update this customer.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <form.Field name="email">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Email</T>
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="name">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Name</T>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="phone">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Phone</T>
                  </Label>
                  <Input
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            </form.Field>
            <div className="flex justify-end gap-2">
              <form.Subscribe selector={(s) => [s.isDirty, s.isSubmitting] as const}>
                {([isDirty, isSubmitting]) => (
                  <Button type="submit" disabled={!isDirty || isSubmitting}>
                    {isSubmitting ? <T>Saving…</T> : <T>Save changes</T>}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Redemption history</T>
          </CardTitle>
          <CardDescription>
            <T>Vouchers redeemed by this customer.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <T>This customer has no redemptions yet.</T>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const { data, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => ovx().customers.get({ id }),
  });

  const remove = useMutation({
    mutationFn: () => ovx().customers.delete({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(gt("Customer deleted"));
      router.push("/customers");
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
        <T>Customer not found.</T>
      </p>
    );

  return (
    <CustomerForm
      key={data.updatedAt}
      data={data}
      deletePending={remove.isPending}
      onDelete={() => remove.mutate()}
    />
  );
}
