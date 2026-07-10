# x402 Continue / Extra Shot — manual verification

## Prerequisites

1. Copy `.env.local.example` → `.env.local` (default `X402_PAY_TO` is `0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`).
2. Default facilitator is **CDP** (`https://api.cdp.coinbase.com/platform/v2/x402`) so settlements include ERC-8021 Schema 2.
3. Network defaults to Base mainnet (`eip155:8453`). For Sepolia testing set both network vars to `eip155:84532`.
4. Payer wallet needs USDC on the chosen network.
5. Configure CDP API credentials and an Upstash Redis REST database.
6. `npm run dev`, open `http://localhost:3000/?debug=1`.

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
CDP does this automatically. Verify with
https://buildercode-checker.vercel.app/ after a successful pay.

## Monthly free-tier guard

- CDP includes 1,000 settlements per month. DotShot defaults to 900 so 100 remain for measurement differences and manual verification.
- Redis key: `dotshot:x402:settlements:YYYY-MM` (UTC).
- The paid retry reserves one slot atomically before settlement.
- An explicit failed settlement releases the slot. An ambiguous exception keeps it reserved so the guard fails closed.
- At the limit, the API returns `503` with code `X402_MONTHLY_LIMIT_REACHED`; no settlement is submitted.
- If Redis is unavailable or unconfigured, paid shots stop with `X402_QUOTA_UNAVAILABLE`.

## Production (Vercel)

Required variables:
- `X402_PAY_TO=0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`
- `X402_NETWORK=eip155:8453`
- `NEXT_PUBLIC_X402_NETWORK=eip155:8453`
- `X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`
- `CDP_API_KEY_ID=...`
- `CDP_API_KEY_SECRET=...`
- `UPSTASH_REDIS_REST_URL=...`
- `UPSTASH_REDIS_REST_TOKEN=...`
- `X402_MONTHLY_SETTLEMENT_LIMIT=900`

Vercel Marketplace may instead inject `KV_REST_API_URL` and
`KV_REST_API_TOKEN`; DotShot accepts either naming convention.

CDP currently enforces a `$0.001` minimum payment, so Continue and Extra Shot
both default to `$0.001`.

Quick check after deploy:
`curl -i -X POST https://crypto-peggle.vercel.app/api/x402/extra-shot -H "accept: application/json"`
Expect **402** with `PAYMENT-REQUIRED` (not 500/503).

## Why not xpay?

xpay settles payments but its observed Base transactions do not append the
ERC-8021 Schema 2 marker. DotShot uses CDP so Base Build can attribute the
x402 settlement to `bc_1pm68wo8`.
