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
- EOA wallets sign an EIP-3009 authorization directly.
- EIP-7702 / contract wallets use Permit2. On first use, the wallet asks for one
  on-chain USDC approval before the payment signature.

## Typed-data signing (EOA + smart wallet)

- Browser signing goes through `eth_signTypedData_v4` with viem's
  `serializeTypedData`.
- Before serialize, the client injects `EIP712Domain` via
  `getTypesForEIP712Domain`. Without that step viem serializes `domain: {}`,
  and strict wallets (notably Zerion's in-app browser) fail with
  `Failed to create payment payload: Internal error` (JSON-RPC -32603).
- The 2nd RPC param must be a **JSON string**, not a raw object. Zerion's
  in-app browser `JSON.parse`s it; passing an object yields
  `"[object Object]" is not valid JSON`.
- Helper: `serializePaymentTypedData` in `src/lib/x402Client.ts`.

## Smart-wallet support

- The client checks `eth_getCode` after switching to the configured Base network.
- Accounts without code select the EIP-3009 payment option.
- Accounts with code select the Permit2 option so settlement uses ERC-1271
  signature validation.
- Coinbase/Base Wallet (including Base App passkeys) sign via ERC-1271:
  1. Prefer the wallet's native `eth_signTypedData_v4` on the payment typed data
     and accept it when on-chain `isValidSignature` returns the ERC-1271 magic
     (`0x1626ba7e`). This is the Base App / passkey path (WebAuthn, not ECDSA).
  2. If the native bytes are bare `signatureData`, wrap with each on-chain
     `ownerIndex` until ERC-1271 validates (passkey owners cannot use ecrecover).
  3. Only when the wallet returns a raw 65-byte ECDSA that fails ERC-1271
     (EIP-7702 / extension edge case) sign the CoinbaseSmartWallet replay-safe
     EIP-712 envelope, match the EOA owner, and wrap as
     `SignatureWrapper(ownerIndex, signatureData)`. This prevents Permit2 from
     mistaking the 65-byte owner signature for direct EOA authorization.
- Permit2 approval is bounded to 1 USDC, enough for the guarded 1,000 payments
  at the default `$0.001` price. DotShot does not request unlimited approval.
- The approval is sent to canonical Permit2
  (`0x000000000022D473030F116dDEE9F6B43aC78BA3`). It is only repeated when the
  remaining allowance is below one default payment.
- The approval transaction may require a small Base gas fee unless the connected
  wallet sponsors it. Subsequent x402 payments remain gasless for the payer.

## Checks

- Free play: start a run, clear / game over without paying. Initial 5 shots unchanged.
- Continue: burn shots to game over → confirm → wallet typed-data sign → same level, `shotsLeft += 3`. Cap 3/run. Retire hides Continue.
- Extra shot: while aiming → confirm → pay → `shotsLeft += 1`. Cap 10/run.
- Smart wallet: revoke or clear Permit2 allowance → pay → approve 1 USDC →
  sign Permit2 payment → grant succeeds. A second payment must not ask for
  approval again.
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
