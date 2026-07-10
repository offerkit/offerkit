"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
import { FormFieldErrors } from "@/components/dashboard/form-field-errors";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  voucherCreateFormSchema,
  voucherEditFormSchema,
  type VoucherFormState,
} from "@/lib/forms/voucher";

export type { VoucherFormState } from "@/lib/forms/voucher";

type VoucherType = VoucherFormState["type"];
type DiscountKind = VoucherFormState["discountKind"];

const TYPES: VoucherType[] = ["DISCOUNT", "GIFT_CARD"];

function parseDecimalToMinorUnit(value: string, scale: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * scale);
}

function formatDecimal(value: number, scale: number, decimals: number): string {
  return (value / scale).toFixed(decimals);
}

function formatOptionalDecimal(
  value: number | "",
  scale: number,
  decimals: number,
): string {
  if (value === "") return "";
  return formatDecimal(value, scale, decimals);
}

function DecimalInput({
  id,
  value,
  onChange,
  scale,
  decimals,
  min,
  max,
  placeholder,
  suffix,
  invalid,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  scale: number;
  decimals: number;
  min?: number;
  max?: number;
  placeholder?: string;
  suffix?: string;
  invalid?: boolean;
}) {
  const committed = useRef(value);
  const [displayValue, setDisplayValue] = useState(() =>
    formatDecimal(value, scale, decimals),
  );

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDisplayValue(formatDecimal(value, scale, decimals));
    }
  }, [decimals, scale, value]);

  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={decimals > 0 ? 1 / 10 ** decimals : 1}
        value={displayValue}
        aria-invalid={invalid}
        onChange={(e) => {
          const next = e.target.value;
          setDisplayValue(next);
          const parsed = parseDecimalToMinorUnit(next, scale);
          committed.current = parsed;
          onChange(parsed);
        }}
        onBlur={() => setDisplayValue(formatDecimal(value, scale, decimals))}
        placeholder={placeholder}
        className={suffix ? "pr-8" : undefined}
      />
      {suffix ? (
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

function OptionalDecimalInput({
  id,
  value,
  onChange,
  scale,
  decimals,
  min,
  placeholder,
  invalid,
}: {
  id: string;
  value: number | "";
  onChange: (value: number | "") => void;
  scale: number;
  decimals: number;
  min?: number;
  placeholder?: string;
  invalid?: boolean;
}) {
  const committed = useRef(value);
  const [displayValue, setDisplayValue] = useState(() =>
    formatOptionalDecimal(value, scale, decimals),
  );

  useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDisplayValue(formatOptionalDecimal(value, scale, decimals));
    }
  }, [decimals, scale, value]);

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      step={decimals > 0 ? 1 / 10 ** decimals : 1}
      value={displayValue}
      aria-invalid={invalid}
      onChange={(e) => {
        const next = e.target.value;
        setDisplayValue(next);
        const parsed = next === "" ? "" : parseDecimalToMinorUnit(next, scale);
        committed.current = parsed;
        onChange(parsed);
      }}
      onBlur={() => setDisplayValue(formatOptionalDecimal(value, scale, decimals))}
      placeholder={placeholder}
    />
  );
}

export function VoucherForm({
  initial,
  submitLabel,
  onSubmit,
  pending,
  mode,
}: {
  initial: VoucherFormState;
  submitLabel: string;
  onSubmit: (state: VoucherFormState) => void;
  pending: boolean;
  mode: "create" | "edit";
}) {
  const gt = useGT();
  const form = useForm({
    defaultValues: initial,
    validators: {
      onMount: mode === "create" ? voucherCreateFormSchema : voucherEditFormSchema,
      onChange: mode === "create" ? voucherCreateFormSchema : voucherEditFormSchema,
      onSubmit: mode === "create" ? voucherCreateFormSchema : voucherEditFormSchema,
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
            <T>Voucher</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <form.Field name="code">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Code</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Leave blank to auto-generate")}
                  disabled={mode === "edit"}
                  className="font-mono"
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="campaignId">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Campaign ID</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Optional")}
                  disabled={mode === "edit"}
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
                  onValueChange={(v) => field.handleChange(v as VoucherType)}
                  disabled={mode === "edit"}
                >
                  <SelectTrigger
                    aria-label={gt("Voucher type")}
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
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
          <form.Field name="redemptionLimit">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Redemption limit</T>
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
                  placeholder={gt("Unlimited")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="perUserRedemptionLimit">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Per-user limit</T>
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
                  placeholder={gt("No user cap")}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="customerId">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Customer ID</T>
                </Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder={gt("Optional")}
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

      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type === "GIFT_CARD" ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <T>Gift card balance</T>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <form.Field name="giftBalance">
                  {(field) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>
                        <T>Balance (cents)</T>
                      </Label>
                      <Input
                        id={field.name}
                        type="number"
                        min={1}
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(
                            e.target.value === "" ? "" : Number(e.target.value),
                          )
                        }
                        aria-invalid={field.state.meta.errors.length > 0}
                        placeholder="10000"
                      />
                      <FormFieldErrors
                        errors={field.state.meta.errors}
                        visible={field.state.meta.isTouched}
                      />
                      <p className="text-xs text-muted-foreground">
                        <T>10000 = 100.00. Each redemption deducts up to this much.</T>
                      </p>
                    </div>
                  )}
                </form.Field>
                <form.Field name="active">
                  {(field) => (
                    <div className="flex items-center gap-3">
                      <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={(v) => field.handleChange(v)}
                      />
                      <Label htmlFor={field.name} className="cursor-pointer">
                        <T>Active</T>
                      </Label>
                    </div>
                  )}
                </form.Field>
              </CardContent>
            </Card>
          ) : null
        }
      </form.Subscribe>

      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type === "GIFT_CARD" ? null : (
      <Card>
        <CardHeader>
          <CardTitle>
            <T>Discount</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <form.Field name="discountKind">
            {(field) => (
              <div className="space-y-2">
                <Label>
                  <T>Kind</T>
                </Label>
                <Select
                  items={[
                    { label: gt("Fixed amount"), value: "AMOUNT" },
                    { label: gt("Percentage"), value: "PERCENTAGE" },
                  ]}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as DiscountKind)}
                >
                  <SelectTrigger
                    aria-label={gt("Discount kind")}
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMOUNT">{gt("Fixed amount")}</SelectItem>
                    <SelectItem value="PERCENTAGE">{gt("Percentage")}</SelectItem>
                  </SelectContent>
                </Select>
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="discountValue">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <form.Subscribe selector={(s) => s.values.discountKind}>
                    {(kind) =>
                      kind === "PERCENTAGE" ? <T>Discount percentage</T> : <T>Discount amount</T>
                    }
                  </form.Subscribe>
                </Label>
                <form.Subscribe selector={(s) => s.values.discountKind}>
                  {(kind) =>
                    kind === "PERCENTAGE" ? (
                      <>
                        <DecimalInput
                          id={field.name}
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value)}
                          scale={100}
                          decimals={2}
                          min={0.01}
                          max={100}
                          suffix="%"
                          invalid={field.state.meta.errors.length > 0}
                        />
                        <p className="text-xs text-muted-foreground">
                          <T>Enter 20 for 20% off.</T>
                        </p>
                      </>
                    ) : (
                      <>
                        <DecimalInput
                          id={field.name}
                          value={field.state.value}
                          onChange={(value) => field.handleChange(value)}
                          scale={100}
                          decimals={2}
                          min={0.01}
                          placeholder="10.00"
                          invalid={field.state.meta.errors.length > 0}
                        />
                      </>
                    )
                  }
                </form.Subscribe>
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="maxDiscountAmount">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Maximum discount amount</T>
                </Label>
                <OptionalDecimalInput
                  id={field.name}
                  value={field.state.value}
                  onChange={(value) => field.handleChange(value)}
                  scale={100}
                  decimals={2}
                  min={0}
                  placeholder={gt("Optional cap")}
                  invalid={field.state.meta.errors.length > 0}
                />
                <FormFieldErrors
                  errors={field.state.meta.errors}
                  visible={field.state.meta.isTouched}
                />
              </div>
            )}
          </form.Field>
          <form.Field name="priority">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Priority</T>
                </Label>
                <Input
                  id={field.name}
                  type="number"
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
          <form.Field name="exclusive">
            {(field) => (
              <div className="flex items-center gap-3">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(v)}
                />
                <Label htmlFor={field.name} className="cursor-pointer">
                  <T>Exclusive (no stacking)</T>
                </Label>
              </div>
            )}
          </form.Field>
          <form.Field name="active">
            {(field) => (
              <div className="flex items-center gap-3">
                <Switch
                  id={field.name}
                  checked={field.state.value}
                  onCheckedChange={(v) => field.handleChange(v)}
                />
                <Label htmlFor={field.name} className="cursor-pointer">
                  <T>Active</T>
                </Label>
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
                  id={field.name}
                  type="datetime-local"
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
                  id={field.name}
                  type="datetime-local"
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
        </CardContent>
      </Card>
          )
        }
      </form.Subscribe>

      <div className="flex justify-end gap-2">
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting] as const}>
          {([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={pending || isSubmitting || !canSubmit}>
              {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
