/** Display labels for paid continue / extra shot (USDC on-chain transfer). */
export const PAY_PRICE_CONTINUE =
  process.env.NEXT_PUBLIC_PAY_PRICE_CONTINUE?.trim() || '$0.001';
export const PAY_PRICE_EXTRA =
  process.env.NEXT_PUBLIC_PAY_PRICE_EXTRA?.trim() || '$0.001';

export function payPriceLabel(kind: 'continue' | 'extra'): string {
  return kind === 'continue' ? PAY_PRICE_CONTINUE : PAY_PRICE_EXTRA;
}

/** Parse a "$0.001" style label into USDC base units (6 decimals). */
export function parseUsdcAmount(label: string): bigint {
  const n = Number(String(label).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid USDC price: ${label}`);
  return BigInt(Math.round(n * 1e6));
}
