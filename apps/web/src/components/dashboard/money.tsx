"use client";

import { useLocale } from "gt-next/client";
import { formatMinorCurrency } from "@/lib/money";

/** Renders an integer minor-unit amount in the active dashboard locale. */
export function Money({ value, currency }: { value: number; currency: string }) {
  const locale = useLocale();
  return <>{formatMinorCurrency(value, currency, locale)}</>;
}
