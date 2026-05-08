"use client";

import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { JsonEditor } from "./json-editor";

export interface RewardTypeFormState {
  key: string;
  name: string;
  description: string;
  payloadSchema: Record<string, unknown>;
}

export function RewardTypeForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  mode,
}: {
  initial: RewardTypeFormState;
  submitLabel: string;
  onSubmit: (state: RewardTypeFormState) => void;
  pending: boolean;
  mode: "create" | "edit";
}) {
  const gt = useGT();
  const form = useForm({
    defaultValues: initial,
    onSubmit: ({ value }) => onSubmit(value),
  });

  return (
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
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <form.Field name="key">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Key</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                  required
                  disabled={mode === "edit"}
                  className="font-mono"
                  placeholder="FREE_SHIPPING"
                  pattern="^[A-Z][A-Z0-9_]*$"
                />
                <p className="text-xs text-muted-foreground">
                  <T>SCREAMING_SNAKE_CASE. Used as the discriminator in webhook payloads.</T>
                </p>
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
                  required
                  placeholder={gt("Free shipping")}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={field.name}>
                  <T>Description</T>
                </Label>
                <Textarea
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={gt("Shown in webhook payloads + integrator docs")}
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
            <T>Payload schema</T>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form.Field name="payloadSchema">
            {(field) => (
              <JsonEditor
                label={gt("JSON schema for the reward payload")}
                value={field.state.value}
                onChange={field.handleChange}
                height="h-64"
              />
            )}
          </form.Field>
        </CardContent>
      </Card>
      <div className="flex justify-end gap-2">
        <form.Subscribe selector={(s) => [s.values.key, s.values.name, s.isSubmitting] as const}>
          {([key, name, isSubmitting]) => (
            <Button
              type="submit"
              disabled={pending || isSubmitting || !key.trim() || !name.trim()}
            >
              {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
