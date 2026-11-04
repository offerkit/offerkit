const DEFAULT_FRACTION_DIGITS = 2;

/**
 * Number of minor-unit digits for an ISO 4217 currency (USD → 2, JPY → 0,
 * KWD → 3). Falls back to 2 for unknown codes.
 */
export function currencyFractionDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? DEFAULT_FRACTION_DIGITS
    );
  } catch {
    return DEFAULT_FRACTION_DIGITS;
  }
}

/** Convert an integer minor-unit amount into major units for the currency. */
export function minorToMajor(value: number, currency: string): number {
  return value / 10 ** currencyFractionDigits(currency);
}

/**
 * Format an integer minor-unit amount as currency. `locale` defaults to the
 * runtime locale when omitted.
 */
export function formatMinorCurrency(value: number, currency: string, locale?: string): string {
  const digits = currencyFractionDigits(currency);
  const major = value / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(major);
  } catch {
    return `${major.toFixed(digits)} ${currency}`;
  }
}
