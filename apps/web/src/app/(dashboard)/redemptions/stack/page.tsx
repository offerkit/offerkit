"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { CURRENCY_OPTIONS, optionsWithCurrent } from "@/lib/locale-options";
import { ovx } from "@/lib/sdk";

export default function StackRedeemPage() {
  const gt = useGT();
  const [codesText, setCodesText] = useState("");
  const [orderAmount, setOrderAmount] = useState(10000);
  const [currency, setCurrency] = useState<string | undefined>(undefined);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const { data: workspace } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => ovx().workspace.get({}),
  });
  const selectedCurrency = currency ?? workspace?.defaultCurrency ?? "";

  const stack = useMutation({
    mutationFn: () =>
      ovx().vouchers.stackRedeem({
        codes: codesText
          .split(/[,\s]+/)
          .map((s) => s.trim())
          .filter(Boolean),
        order: { amount: orderAmount, currency: selectedCurrency, items: [] },
        idempotencyKey: idempotencyKey || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          <T>Stack redemption</T>
        </h1>
        <p className="text-sm text-muted-foreground">
          <T>
            Apply multiple voucher codes to a single order in one transaction.
            Exclusivity short-circuits, priority sorts, and partial failure rolls back the
            whole batch.
          </T>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <T>Input</T>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="codes">
              <T>Voucher codes</T>
            </Label>
            <Textarea
              id="codes"
              value={codesText}
              onChange={(e) => setCodesText(e.target.value)}
              placeholder={gt("CODE-1, CODE-2, CODE-3 (comma- or space-separated)")}
              className="font-mono text-sm h-24"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">
              <T>Order amount (minor units)</T>
            </Label>
            <Input
              id="amount"
              type="number"
              min={0}
              value={orderAmount}
              onChange={(e) => setOrderAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">
              <T>Currency</T>
            </Label>
            <Select
              value={selectedCurrency}
              onValueChange={(value) => {
                if (value) setCurrency(value);
              }}
            >
              <SelectTrigger id="currency" className="w-full">
                <SelectValue placeholder={gt("Select currency")} />
              </SelectTrigger>
              <SelectContent>
                {optionsWithCurrent(CURRENCY_OPTIONS, selectedCurrency).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="idem">
              <T>Idempotency key</T>
            </Label>
            <Input
              id="idem"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              placeholder={gt("Optional, replays the whole batch on duplicate")}
            />
          </div>
          <div className="flex items-end sm:col-span-2">
            <Button
              type="button"
              onClick={() => stack.mutate()}
              disabled={stack.isPending || codesText.trim() === "" || !selectedCurrency}
            >
              {stack.isPending ? <T>Redeeming…</T> : <T>Stack redeem</T>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {stack.data ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <T>Result</T>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-md border bg-muted/50 p-3 text-xs">
              {JSON.stringify(stack.data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
