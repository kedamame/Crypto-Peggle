/** Shared x402 price labels (display). Server amounts come from env in src/lib/x402.ts. */
export const X402_PRICE_CONTINUE =
  process.env.NEXT_PUBLIC_X402_PRICE_CONTINUE?.trim() || '$0.001';
export const X402_PRICE_EXTRA =
  process.env.NEXT_PUBLIC_X402_PRICE_EXTRA?.trim() || '$0.0005';

export function x402PriceLabel(kind: 'continue' | 'extra'): string {
  return kind === 'continue' ? X402_PRICE_CONTINUE : X402_PRICE_EXTRA;
}
