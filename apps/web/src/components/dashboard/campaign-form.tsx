"use client";

import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { FormFieldErrors } from "@/components/dashboard/form-field-errors";
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
import {
  CURRENCY_OPTIONS,
  TIMEZONE_OPTIONS,
  optionsWithCurrent,
} from "@/lib/locale-options";
import {
  campaignFormSchema,
  type CampaignFormState,
} from "@/lib/forms/campaign";

export type { CampaignFormState } from "@/lib/forms/campaign";

type CampaignType = CampaignFormState["type"];
type CampaignStatus = CampaignFormState["status"];

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
    validators: {
      onMount: campaignFormSchema,
      onChange: campaignFormSchema,
      onSubmit: campaignFormSchema,
    },
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
                  aria-invalid={field.state.meta.errors.length > 0}
                  required
                  placeholder={gt("Summer sale 2026")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Optional internal description")}
                  className="h-20"
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                  <SelectTrigger aria-invalid={field.state.meta.errors.length > 0}>
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
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
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
                    <SelectTrigger aria-invalid={field.state.meta.errors.length > 0}>
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
                  <FormFieldErrors
                    errors={field.state.meta.errors}
                    visible={field.state.meta.isTouched}
                  />
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
                <Select
                  value={field.state.value}
                  required
                  onValueChange={(value) => {
                    if (value) field.handleChange(value);
                  }}
                >
                  <SelectTrigger
                    id={field.name}
                    className="w-full"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsWithCurrent(CURRENCY_OPTIONS, field.state.value).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                <Select
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value) field.handleChange(value);
                  }}
                >
                  <SelectTrigger
                    id={field.name}
                    className="w-full"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {optionsWithCurrent(TIMEZONE_OPTIONS, field.state.value).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
          <form.Field name="perUserRedemptionLimit">
            {(field) => (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={field.name}>
                  <T>Per-user redemption limit</T>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min={1}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("No campaign-level user cap")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
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
                  aria-invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
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
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Optional, e.g. SUMMER-")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={pending || isSubmitting || !canSubmit}
            >
              {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
