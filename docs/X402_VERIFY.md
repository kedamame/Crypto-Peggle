# x402 Continue / Extra Shot — manual verification

## Prerequisites

1. Copy `.env.local.example` → `.env.local` (default `X402_PAY_TO` is `0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`).
2. Production defaults to Base mainnet (`eip155:8453`) + CDP facilitator. Set CDP API keys on Vercel.
3. For Sepolia-only testing, set both networks to `eip155:84532` and `X402_FACILITATOR_URL=https://x402.org/facilitator`.
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

## Mainnet (Vercel) — required or payments return 503

Without CDP keys the API used to crash with empty HTTP 500. It now returns a clear
`CDP_API_KEY_ID / CDP_API_KEY_SECRET are required...` error instead.

Set all of these in the Vercel project env, then redeploy:
- `X402_PAY_TO=0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`
- `X402_NETWORK=eip155:8453`
- `NEXT_PUBLIC_X402_NETWORK=eip155:8453`
- `X402_FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`
- `CDP_API_KEY_ID=...` (from https://portal.cdp.coinbase.com )
- `CDP_API_KEY_SECRET=...`

Quick check after deploy:
`curl -i -X POST https://crypto-peggle.vercel.app/api/x402/extra-shot -H "accept: application/json"`
Expect **402** with `PAYMENT-REQUIRED` (not 500/503).
