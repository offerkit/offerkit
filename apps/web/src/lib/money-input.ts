/**
 * Pure helpers behind the dashboard's minor-unit money inputs. The stored
 * value is always an integer in the currency's minor units; the text shown is
 * that value at the currency's precision (`scale` = 10 ** `decimals`).
 */

export function parseDecimalToMinorUnit(value: string, scale: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * scale);
}

export function formatDecimal(value: number, scale: number, decimals: number): string {
  return (value / scale).toFixed(decimals);
}

export function formatOptionalDecimal(
  value: number | "",
  scale: number,
  decimals: number,
): string {
  if (value === "") return "";
  return formatDecimal(value, scale, decimals);
}

/** What the input's text currently represents. */
export type ShownMoney<V> = { value: V; scale: number; decimals: number };

/**
 * Whether the input text must be regenerated from the stored value. That is
 * the case when the value changed from outside the input, and also when the
 * currency precision changed (for example once the campaign currency loads):
 * otherwise the text keeps the old precision while edits parse with the new.
 */
export function needsReformat<V>(shown: ShownMoney<V>, next: ShownMoney<V>): boolean {
  return (
    shown.value !== next.value || shown.scale !== next.scale || shown.decimals !== next.decimals
  );
}
