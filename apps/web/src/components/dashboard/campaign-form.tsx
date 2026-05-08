"use client";

import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type CampaignType =
  | "DISCOUNT"
  | "GIFT_VOUCHERS"
  | "LOYALTY_PROGRAM"
  | "REFERRAL_PROGRAM"
  | "PROMOTION";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface CampaignFormState {
  name: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  currency: string;
  timezone: string;
  startDate: string;
  endDate: string;
  autoApply: boolean;
  codeLength: number;
  codePrefix: string;
}

const TYPES: CampaignType[] = [
  "DISCOUNT",
  "GIFT_VOUCHERS",
  "LOYALTY_PROGRAM",
  "REFERRAL_PROGRAM",
  "PROMOTION",
];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended"];

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  mode,
}: {
  initial: CampaignFormState;
  submitLabel: string;
  onSubmit: (state: CampaignFormState) => void;
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
          <form.Field name="name">
            {(field) => (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={field.name}>
                  <T>Name</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  required
                  placeholder={gt("Summer sale 2026")}
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
                  placeholder={gt("Optional internal description")}
                  className="h-20"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="type">
            {(field) => (
              <div className="space-y-2">
                <Label>
                  <T>Type</T>
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as CampaignType)}
                  disabled={mode === "edit"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          {mode === "edit" ? (
            <form.Field name="status">
              {(field) => (
                <div className="space-y-2">
                  <Label>
                    <T>Status</T>
                  </Label>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as CampaignStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form.Field>
          ) : null}
          <form.Field name="currency">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Currency</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                  required
                  maxLength={3}
                  minLength={3}
                  placeholder="USD"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="timezone">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Timezone</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder="UTC"
                />
              </div>
            )}
          </form.Field>
          <form.Field name="startDate">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Start date</T>
                </Label>
                <Input
                  type="datetime-local"
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="endDate">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>End date</T>
                </Label>
                <Input
                  type="datetime-local"
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="autoApply">
            {(field) => (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(v)}
                />
                <Label htmlFor={field.name} className="cursor-pointer">
                  <T>Auto-apply at checkout</T>
                </Label>
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Code generation defaults</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <form.Field name="codeLength">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Code length</T>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min={4}
                  max={32}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="codePrefix">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Code prefix</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  placeholder={gt("Optional, e.g. SUMMER-")}
                />
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <form.Subscribe selector={(s) => [s.values.name, s.values.currency, s.isSubmitting] as const}>
          {([name, currency, isSubmitting]) => (
            <Button
              type="submit"
              disabled={pending || isSubmitting || !name.trim() || currency.length !== 3}
            >
              {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
