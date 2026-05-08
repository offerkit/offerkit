"use client";

import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ovx } from "@/lib/sdk";

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gt = useGT();

  const create = useMutation({
    mutationFn: (input: { email?: string; name?: string; phone?: string }) =>
      ovx().customers.create(input),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success(gt("Customer created"));
      router.push(`/customers/${customer.id}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : gt("Create failed");
      toast.error(message);
    },
  });

  const form = useForm({
    defaultValues: { email: "", name: "", phone: "" },
    onSubmit: ({ value }) => {
      create.mutate({
        email: value.email || undefined,
        name: value.name || undefined,
        phone: value.phone || undefined,
      });
    },
  });

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>New customer</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>All fields are optional.</T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Profile</T>
          </CardTitle>
          <CardDescription>
            <T>Used for promotion targeting and analytics.</T>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="space-y-4"
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
                    placeholder="alice@example.com"
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
                    placeholder={gt("Alice")}
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
                    placeholder="+1 555 123 4567"
                  />
                </div>
              )}
            </form.Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.push("/customers")}>
                <T>Cancel</T>
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? <T>Creating…</T> : <T>Create customer</T>}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
