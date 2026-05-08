"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function CustomerDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["customers", id],
    queryFn: () => ovx().customers.get({ id }),
  });

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dirty, setDirty] = useState(false);
  const [hydratedFor, setHydratedFor] = useState<string | undefined>();

  // Hydrate the form from the server data exactly once per fetched record.
  // Done during render (per React's "you might not need an effect" guidance)
  // so we don't trip the set-state-in-effect lint.
  if (data && hydratedFor !== data.updatedAt) {
    setHydratedFor(data.updatedAt);
    setEmail(data.email ?? "");
    setName(data.name ?? "");
    setPhone(data.phone ?? "");
    setDirty(false);
  }

  const update = useMutation({
    mutationFn: () =>
      ovx().customers.update({
        id,
        patch: {
          email: email || undefined,
          name: name || undefined,
          phone: phone || undefined,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated");
      setDirty(false);
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Update failed");
    },
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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!data) {
    return <p className="text-sm text-muted-foreground">Customer not found.</p>;
  }

  function field(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      setDirty(true);
    };
  }

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
        <Button
          variant="outline"
          onClick={() => {
            if (window.confirm("Delete this customer? They'll be soft-deleted.")) remove.mutate();
          }}
          disabled={remove.isPending}
        >
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
              update.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={field(setEmail)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={field(setName)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={field(setPhone)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={!dirty || update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
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
