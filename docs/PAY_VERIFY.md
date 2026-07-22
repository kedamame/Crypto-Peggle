# Paid Continue / Extra Shot — on-chain USDC transfer

Continue (+3) and Extra Shot (+1) are paid with a normal Base USDC `transfer`
to `NEXT_PUBLIC_PAY_TO` (same flow family as `submitScore`, not x402).

## Setup

1. Copy `.env.local.example` → `.env.local`.
2. Set `NEXT_PUBLIC_PAY_TO` to the treasury address.
3. Optional: `NEXT_PUBLIC_PAY_PRICE_CONTINUE` / `NEXT_PUBLIC_PAY_PRICE_EXTRA` (default `$0.001`).

## Flow

1. User opens the confirm sheet (Continue on game over, Extra while aiming).
2. Wallet switches to Base mainnet if needed.
3. App sends `USDC.transfer(payTo, amount)` with ERC-8021 `DATA_SUFFIX`.
4. Waits for receipt success, then grants shots locally.

## Notes

- Payer pays gas (unlike the previous x402 / facilitator path).
- Attribution uses Schema 0 via `DATA_SUFFIX` (same as score submit).
- Amounts are USDC 6-decimal base units parsed from the `$…` price labels.
