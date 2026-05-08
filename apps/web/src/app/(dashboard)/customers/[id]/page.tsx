"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function CustomerForm({ data, onDelete, deletePending }: { data: CustomerData; onDelete: () => void; deletePending: boolean }) {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (input: { email?: string; name?: string; phone?: string }) =>
      ovx().customers.update({ id: data.id, patch: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            render={<Link href="/customers" aria-label="Back to customers" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {data.name ?? data.email ?? "(unnamed)"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(data.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={onDelete} disabled={deletePending}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Edit and save to update this customer.</CardDescription>
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
                  <Label htmlFor={field.name}>Email</Label>
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
                  <Label htmlFor={field.name}>Name</Label>
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
                  <Label htmlFor={field.name}>Phone</Label>
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
                    {isSubmitting ? "Saving…" : "Save changes"}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Redemption history</CardTitle>
          <CardDescription>Vouchers redeemed by this customer.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Available in Phase 3 once redemptions ship.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => ovx().customers.get({ id }),
  });

  const remove = useMutation({
    mutationFn: () => ovx().customers.delete({ id }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
      router.push("/customers");
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Customer not found.</p>;

  // Re-key on updatedAt so the form re-mounts with fresh defaults after every
  // successful edit. This is the canonical TanStack Form pattern for
  // hydrating from server data without setState-in-effect.
  return (
    <CustomerForm
      key={data.updatedAt}
      data={data}
      deletePending={remove.isPending}
      onDelete={() => {
        if (window.confirm("Delete this customer? They'll be soft-deleted.")) remove.mutate();
      }}
    />
  );
}
