import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import type { ClientEvmSigner } from '@x402/evm';

export type X402GrantKind = 'continue' | 'extra';

export type X402GrantResult = {
  ok: true;
  kind: X402GrantKind;
  shots: number;
};

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function chainIdHex(network: string): `0x${string}` {
  // eip155:8453 → 0x2105, eip155:84532 → 0x14a34
  const parts = network.split(':');
  const id = Number(parts[1] || '84532');
  return `0x${id.toString(16)}` as `0x${string}`;
}

async function ensureChain(provider: Eip1193Provider, network: string) {
  const chainId = chainIdHex(network);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4001) throw err;
    if (code === 4902) {
      const isMainnet = network === 'eip155:8453';
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId,
            chainName: isMainnet ? 'Base' : 'Base Sepolia',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: [
              isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org',
            ],
            blockExplorerUrls: [
              isMainnet ? 'https://basescan.org' : 'https://sepolia.basescan.org',
            ],
          },
        ],
      });
    }
  }
}

function makeBrowserSigner(
  provider: Eip1193Provider,
  address: `0x${string}`,
): ClientEvmSigner {
  return {
    address,
    async signTypedData(message) {
      const signature = await provider.request({
        method: 'eth_signTypedData_v4',
        params: [
          address,
          JSON.stringify({
            domain: message.domain,
            types: message.types,
            primaryType: message.primaryType,
            message: message.message,
          }),
        ],
      });
      return signature as `0x${string}`;
    },
  };
}

function grantPath(kind: X402GrantKind): string {
  return kind === 'continue' ? '/api/x402/continue' : '/api/x402/extra-shot';
}

/**
 * Pay for a continue / extra-shot grant via x402 using the connected browser wallet.
 * Relies on EIP-3009 typed-data signing (USDC) — no gas for the payer on Base.
 */
export async function payForGrant(
  kind: X402GrantKind,
  provider: Eip1193Provider,
  address: `0x${string}`,
): Promise<X402GrantResult> {
  const network =
    process.env.NEXT_PUBLIC_X402_NETWORK?.trim() || 'eip155:8453';

  await ensureChain(provider, network);

  const signer = makeBrowserSigner(provider, address);
  const client = new x402Client().register('eip155:*', new ExactEvmScheme(signer));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(grantPath(kind), {
    method: 'POST',
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  const data = (await res.json()) as Partial<X402GrantResult>;
  if (!data.ok || typeof data.shots !== 'number' || data.kind !== kind) {
    throw new Error('invalid grant response');
  }
  return { ok: true, kind, shots: data.shots };
}
