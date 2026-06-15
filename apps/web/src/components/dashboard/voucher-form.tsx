"use client";

import { useForm } from "@tanstack/react-form";
import { T, useGT } from "gt-next/client";
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

export type VoucherType = "DISCOUNT" | "GIFT_CARD";
export type DiscountKind = "AMOUNT" | "PERCENTAGE";

export interface VoucherFormState {
  code: string;
  campaignId: string;
  type: VoucherType;
  discountKind: DiscountKind;
  // Cents for AMOUNT, basis points (0-10000) for PERCENTAGE.
  discountValue: number;
  maxDiscountAmount: number | "";
  giftBalance: number | "";
  redemptionLimit: number | "";
  priority: number;
  exclusive: boolean;
  active: boolean;
  startDate: string;
  endDate: string;
}

const TYPES: VoucherType[] = ["DISCOUNT", "GIFT_CARD"];

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
                  placeholder={gt("Leave blank to auto-generate")}
                  disabled={mode === "edit"}
                  className="font-mono"
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
                  placeholder={gt("Optional")}
                  disabled={mode === "edit"}
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
                  <SelectTrigger aria-label={gt("Voucher type")}>
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
                  placeholder={gt("Unlimited")}
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
                        placeholder="10000"
                      />
                      <p className="text-xs text-muted-foreground">
                        <T>10000 = $100.00. Each redemption deducts up to this much.</T>
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
                    { label: gt("Amount (cents)"), value: "AMOUNT" },
                    { label: gt("Percentage (basis points)"), value: "PERCENTAGE" },
                  ]}
                  value={field.state.value}
                  onValueChange={(v) => field.handleChange(v as DiscountKind)}
                >
                  <SelectTrigger aria-label={gt("Discount kind")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMOUNT">{gt("Amount (cents)")}</SelectItem>
                    <SelectItem value="PERCENTAGE">{gt("Percentage (basis points)")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </form.Field>
          <form.Field name="discountValue">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Value</T>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min={1}
                  max={field.form.state.values.discountKind === "PERCENTAGE" ? 10000 : undefined}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(Number(e.target.value))}
                />
                <form.Subscribe selector={(s) => s.values.discountKind}>
                  {(kind) =>
                    kind === "PERCENTAGE" ? (
                      <p className="text-xs text-muted-foreground">
                        <T>10000 = 100%. e.g. 2000 = 20% off.</T>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        <T>Cents off. e.g. 1000 = $10 off.</T>
                      </p>
                    )
                  }
                </form.Subscribe>
              </div>
            )}
          </form.Field>
          <form.Field name="maxDiscountAmount">
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor={field.name}>
                  <T>Max discount (cents)</T>
                </Label>
                <Input
                  id={field.name}
                  type="number"
                  min={0}
                  value={field.state.value}
                  onChange={(e) =>
                    field.handleChange(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder={gt("Optional cap")}
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
        <form.Subscribe selector={(s) => [s.values, s.isSubmitting] as const}>
          {([values, isSubmitting]) => {
            const discountInvalid = values.type === "DISCOUNT" && values.discountValue < 1;
            const newGiftCardInvalid =
              mode === "create" &&
              values.type === "GIFT_CARD" &&
              (values.giftBalance === "" || values.giftBalance < 1);
            return (
              <Button
                type="submit"
                disabled={pending || isSubmitting || discountInvalid || newGiftCardInvalid}
              >
                {pending || isSubmitting ? <T>Saving…</T> : submitLabel}
              </Button>
            );
          }}
        </form.Subscribe>
      </div>
    </form>
  );
}
