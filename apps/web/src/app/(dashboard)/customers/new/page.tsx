"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ovx } from "@/lib/sdk";

export default function NewCustomerPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const create = useMutation({
    mutationFn: () =>
      ovx().customers.create({
        email: email || undefined,
        name: name || undefined,
        phone: phone || undefined,
      }),
    onSuccess: async (customer) => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created");
      router.push(`/customers/${customer.id}`);
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Create failed";
      toast.error(message);
    },
  });

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New customer</h1>
        <p className="text-sm text-muted-foreground">All fields are optional.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Used for promotion targeting and analytics.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alice"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/customers")}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? "Creating…" : "Create customer"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
