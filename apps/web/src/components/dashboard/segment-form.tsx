"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { T, useGT } from "gt-next/client";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ovx } from "@/lib/sdk";
import { RuleEditor } from "./rule-editor";

export interface SegmentFormState {
  name: string;
  description: string;
  rule: Record<string, unknown>;
}

export function SegmentForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
}: {
  initial: SegmentFormState;
  // submitLabel comes pre-translated from the parent (via gt()).
  submitLabel: string;
  onSubmit: (state: SegmentFormState) => void;
  pending: boolean;
}) {
  const gt = useGT();
  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => {
      onSubmit(value);
    },
  });

  const preview = useMutation({
    mutationFn: (rule: Record<string, unknown>) => ovx().segments.preview({ rule, sampleSize: 10 }),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Details</T>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    required
                    placeholder={gt("VIP customers")}
                  />
                </div>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <div className="space-y-2">
                  <Label htmlFor={field.name}>
                    <T>Description</T>
                  </Label>
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder={gt("Optional context for this segment")}
                    className="h-20"
                  />
                </div>
              )}
            </form.Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <T>Rule</T>
            </CardTitle>
            <CardDescription>
              <T>Customer-attribute rules in JSON Logic.</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form.Field name="rule">
              {(field) => <RuleEditor value={field.state.value} onChange={field.handleChange} />}
            </form.Field>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <form.Subscribe selector={(s) => [s.values.name, s.isSubmitting] as const}>
            {([name, isSubmitting]) => (
              <Button type="submit" disabled={pending || isSubmitting || !name.trim()}>
                {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
              </Button>
            )}
          </form.Subscribe>
        </div>
      </form>

      <Card className="self-start">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-4" />
            <T>Preview</T>
          </CardTitle>
          <CardDescription>
            <T>Run the rule against existing customers.</T>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form.Subscribe selector={(s) => s.values.rule}>
            {(rule) => (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => preview.mutate(rule)}
                disabled={preview.isPending}
              >
                {preview.isPending ? <T>Running…</T> : <T>Run preview</T>}
              </Button>
            )}
          </form.Subscribe>

          {preview.data ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{preview.data.matchedCount}</Badge>
                <span className="text-muted-foreground">
                  <T>customers match</T>
                </span>
              </div>
              <ul className="divide-y rounded-md border text-sm">
                {preview.data.sample.length === 0 ? (
                  <li className="px-3 py-2 text-muted-foreground">
                    <T>No sample matches.</T>
                  </li>
                ) : (
                  preview.data.sample.map((c) => (
                    <li key={c.id} className="px-3 py-2">
                      <div className="font-medium">{c.email ?? gt("(no email)")}</div>
                      <div className="text-xs text-muted-foreground">{c.name ?? "—"}</div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {preview.error ? (
            <p className="text-xs text-red-500">
              {preview.error instanceof Error ? preview.error.message : gt("Preview failed")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
