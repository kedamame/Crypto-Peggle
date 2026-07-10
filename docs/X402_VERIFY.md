# x402 Continue / Extra Shot — manual verification

## Prerequisites

1. Copy `.env.local.example` → `.env.local` (default `X402_PAY_TO` is `0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`).
2. Default facilitator is **xpay** (`https://facilitator.xpay.sh`) — no CDP account, works from Japan.
3. Network defaults to Base mainnet (`eip155:8453`). For Sepolia testing set both network vars to `eip155:84532`.
4. Payer wallet needs USDC on the chosen network.
5. `npm run dev`, open `http://localhost:3000/?debug=1`.

## UI flow

- Tap Continue / +1 Shot → confirmation sheet shows USDC icon + price → Pay with USDC.
- Cancel returns without charging.

## Checks

- Free play: start a run, clear / game over without paying. Initial 5 shots unchanged.
- Continue: burn shots to game over → confirm → wallet typed-data sign → same level, `shotsLeft += 3`. Cap 3/run. Retire hides Continue.
- Extra shot: while aiming → confirm → pay → `shotsLeft += 1`. Cap 10/run.
- Cancel / insufficient USDC → error text, state unchanged.
- Confirm cream board / trajectory / hazard unlocks unchanged.

## Base Build attribution (builder code)

DotShot uses `bc_1pm68wo8` (`src/lib/attribution.ts`):

- **submitScore**: ERC-8021 Schema 0 via viem `dataSuffix`
- **x402 continue / extra-shot**: ERC-8021 Schema 2 via `@x402/extensions/builder-code`
  - Server declares app code `a` on both paid routes
  - Client echoes `a` and attaches service code `s`

On-chain calldata suffix is appended by the **facilitator** at settle time.
CDP does this automatically. xpay may or may not yet append Schema 2; if a
settled tx has no `8021…` suffix, Base Build will not credit that payment even
though the payment payload carried the extension. Verify with
https://buildercode-checker.vercel.app/ after a successful pay.

## Production (Vercel)

Defaults in code already use xpay + Base mainnet + the project payTo, so CDP keys are **not** required.

Optional overrides:
- `X402_PAY_TO=0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`
- `X402_NETWORK=eip155:8453`
- `NEXT_PUBLIC_X402_NETWORK=eip155:8453`
- `X402_FACILITATOR_URL=https://facilitator.xpay.sh`

Quick check after deploy:
`curl -i -X POST https://crypto-peggle.vercel.app/api/x402/extra-shot -H "accept: application/json"`
Expect **402** with `PAYMENT-REQUIRED` (not 500/503).

## Why not CDP?

Coinbase Developer Platform account creation is limited (commonly US / Singapore). DotShot therefore defaults to the permissionless xpay facilitator so sellers in Japan can accept Base USDC without CDP.
