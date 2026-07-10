# x402 Continue / Extra Shot — manual verification

## Prerequisites

1. Copy `.env.local.example` → `.env.local` (default `X402_PAY_TO` is `0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638`).
2. Keep `X402_NETWORK` / `NEXT_PUBLIC_X402_NETWORK` as `eip155:84532` (Base Sepolia).
3. Fund the payer wallet with Base Sepolia USDC (CDP faucet or bridge).
4. `npm run dev`, open `http://localhost:3000/?debug=1`.

## Checks

- Free play: start a run, clear / game over without paying. Initial 5 shots unchanged.
- Continue: burn shots to game over → **Continue +3** → wallet typed-data sign → same level, `shotsLeft += 3`. Cap 3/run. Retire hides Continue.
- Extra shot: while aiming, **+1 Shot** → pay → `shotsLeft += 1`. Cap 10/run.
- Cancel / insufficient USDC → error text, state unchanged.
- Confirm cream board / trajectory / hazard unlocks unchanged.

## Mainnet

Set network to `eip155:8453`, facilitator to CDP URL, and CDP API keys.
