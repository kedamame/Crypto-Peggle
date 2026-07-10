import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/client';
import type { ClientEvmSigner } from '@x402/evm';
import { BuilderCodeClientExtension } from '@x402/extensions/builder-code';
import {
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  hashTypedData,
  isAddressEqual,
  recoverAddress,
  serializeTypedData,
  type Hex,
} from 'viem';
import { BUILDER_CODE } from '@/lib/attribution';

export type X402GrantKind = 'continue' | 'extra';

export type X402GrantResult = {
  ok: true;
  kind: X402GrantKind;
  shots: number;
};

export class X402PaymentError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryAt?: string,
  ) {
    super(message);
    this.name = 'X402PaymentError';
  }
}

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// A bounded approval covers the entire 1,000-payment CDP free tier at $0.001.
const PERMIT2_APPROVAL_AMOUNT = BigInt(1_000_000);
const USDC_BY_NETWORK: Record<string, `0x${string}`> = {
  'eip155:8453': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'eip155:84532': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};
const ERC20_APPROVAL_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;
const ERC20_ALLOWANCE_ABI = [
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;
const COINBASE_SMART_WALLET_ABI = [
  {
    type: 'function',
    name: 'replaySafeHash',
    stateMutability: 'view',
    inputs: [{ name: 'hash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'nextOwnerIndex',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ownerAtIndex',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes' }],
  },
  {
    type: 'function',
    name: 'isValidSignature',
    stateMutability: 'view',
    inputs: [
      { name: 'hash', type: 'bytes32' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [{ name: '', type: 'bytes4' }],
  },
] as const;

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

async function isSmartAccount(
  provider: Eip1193Provider,
  address: `0x${string}`,
): Promise<boolean> {
  const code = await provider.request({
    method: 'eth_getCode',
    params: [address, 'latest'],
  });
  return typeof code === 'string' && code !== '0x' && code !== '0x0';
}

async function getPermit2Allowance(
  provider: Eip1193Provider,
  owner: `0x${string}`,
  asset: `0x${string}`,
): Promise<bigint> {
  const data = encodeFunctionData({
    abi: ERC20_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [owner, PERMIT2_ADDRESS],
  });
  const result = await provider.request({
    method: 'eth_call',
    params: [{ to: asset, data }, 'latest'],
  });
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new Error('Unable to read Permit2 allowance');
  }
  return BigInt(result);
}

async function waitForReceipt(
  provider: Eip1193Provider,
  hash: string,
): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [hash],
    }) as { status?: string | number } | null;
    if (receipt) {
      const ok = receipt.status === undefined || Number(receipt.status) === 1;
      if (!ok) throw new Error('Permit2 approval transaction reverted');
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error('Permit2 approval confirmation timed out');
}

async function ensurePermit2Allowance(
  provider: Eip1193Provider,
  owner: `0x${string}`,
  network: string,
): Promise<void> {
  const asset = USDC_BY_NETWORK[network];
  if (!asset) throw new Error(`Permit2 is not configured for ${network}`);
  const allowance = await getPermit2Allowance(provider, owner, asset);
  if (allowance >= BigInt(1_000)) return;

  const data = encodeFunctionData({
    abi: ERC20_APPROVAL_ABI,
    functionName: 'approve',
    args: [PERMIT2_ADDRESS, PERMIT2_APPROVAL_AMOUNT],
  });
  let hash: unknown;
  try {
    hash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from: owner, to: asset, data }],
    });
  } catch (err) {
    if ((err as { code?: number }).code === 4001) {
      throw new Error('Permit2 approval was rejected');
    }
    throw err;
  }
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error('Wallet returned an invalid Permit2 approval transaction');
  }
  await waitForReceipt(provider, hash);
}

async function readSmartWalletContract(
  provider: Eip1193Provider,
  address: `0x${string}`,
  functionName:
    | 'replaySafeHash'
    | 'nextOwnerIndex'
    | 'ownerAtIndex'
    | 'isValidSignature',
  args: readonly unknown[] = [],
): Promise<Hex> {
  const data = encodeFunctionData({
    abi: COINBASE_SMART_WALLET_ABI,
    functionName,
    args,
  } as Parameters<typeof encodeFunctionData>[0]);
  const result = await provider.request({
    method: 'eth_call',
    params: [{ to: address, data }, 'latest'],
  });
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new Error(`Unable to call smart wallet ${functionName}`);
  }
  return result as Hex;
}

async function signWithProvider(
  provider: Eip1193Provider,
  account: `0x${string}`,
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
): Promise<`0x${string}`> {
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [
      account,
      serializeTypedData({
        domain: message.domain,
        types: message.types,
        primaryType: message.primaryType,
        message: message.message,
      }),
    ],
  });
  return signature as `0x${string}`;
}

/**
 * CoinbaseSmartWallet validates the outer replay-safe EIP-712 digest, not the
 * original Permit2 digest. Sign that outer message with the wallet owner and
 * wrap the result with its on-chain owner index for ERC-1271.
 */
async function signCoinbaseSmartWalletTypedData(
  provider: Eip1193Provider,
  account: `0x${string}`,
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
): Promise<`0x${string}` | null> {
  let signatureRequested = false;
  try {
    const countResult = await readSmartWalletContract(
      provider,
      account,
      'nextOwnerIndex',
    );
    const nextOwnerIndex = decodeFunctionResult({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'nextOwnerIndex',
      data: countResult,
    });
    const count = Math.min(Number(nextOwnerIndex), 32);
    if (count === 0) return null;

    const originalDigest = hashTypedData(
      message as Parameters<typeof hashTypedData>[0],
    );
    const replaySafeMessage = {
      domain: {
        name: 'Coinbase Smart Wallet',
        version: '1',
        chainId: message.domain.chainId,
        verifyingContract: account,
      },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        CoinbaseSmartWalletMessage: [{ name: 'hash', type: 'bytes32' }],
      },
      primaryType: 'CoinbaseSmartWalletMessage',
      message: { hash: originalDigest },
    } satisfies Parameters<ClientEvmSigner['signTypedData']>[0];
    signatureRequested = true;
    const signature = await signWithProvider(
      provider,
      account,
      replaySafeMessage,
    );
    if (signature.length !== 132) {
      throw new Error('Base Wallet returned a non-ECDSA owner signature');
    }
    const replayDigest = hashTypedData(
      replaySafeMessage as Parameters<typeof hashTypedData>[0],
    );
    const ownerSigner = await recoverAddress({ hash: replayDigest, signature });

    for (let ownerIndex = 0; ownerIndex < count; ownerIndex += 1) {
      const ownerResult = await readSmartWalletContract(
        provider,
        account,
        'ownerAtIndex',
        [BigInt(ownerIndex)],
      );
      const ownerBytes = decodeFunctionResult({
        abi: COINBASE_SMART_WALLET_ABI,
        functionName: 'ownerAtIndex',
        data: ownerResult,
      });
      if (ownerBytes.length !== 66) continue;
      const ownerAddress = `0x${ownerBytes.slice(-40)}` as `0x${string}`;
      if (!isAddressEqual(ownerAddress, ownerSigner)) continue;
      const wrappedSignature = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              { name: 'ownerIndex', type: 'uint8' },
              { name: 'signatureData', type: 'bytes' },
            ],
          },
        ],
        [{ ownerIndex, signatureData: signature }],
      );
      const validationResult = await readSmartWalletContract(
        provider,
        account,
        'isValidSignature',
        [originalDigest, wrappedSignature],
      );
      const magicValue = decodeFunctionResult({
        abi: COINBASE_SMART_WALLET_ABI,
        functionName: 'isValidSignature',
        data: validationResult,
      });
      if (magicValue !== '0x1626ba7e') {
        throw new Error('Base Wallet rejected the wrapped payment signature');
      }
      return wrappedSignature;
    }
    throw new Error('Unable to match the Base Wallet signing owner');
  } catch (err) {
    // A missing CoinbaseSmartWallet interface means this is another contract
    // wallet; let its provider return the native ERC-1271 signature format.
    if (!signatureRequested) return null;
    throw err;
  }
}

function makeBrowserSigner(
  provider: Eip1193Provider,
  address: `0x${string}`,
  wrapSmartAccountSignatures: boolean,
): ClientEvmSigner {
  return {
    address,
    async signTypedData(message) {
      if (wrapSmartAccountSignatures) {
        const wrapped = await signCoinbaseSmartWalletTypedData(
          provider,
          address,
          message,
        );
        if (wrapped) return wrapped;
      }
      return signWithProvider(provider, address, message);
    },
  };
}

function grantPath(kind: X402GrantKind): string {
  return kind === 'continue' ? '/api/x402/continue' : '/api/x402/extra-shot';
}

/**
 * Pay for a continue / extra-shot grant via x402 using the connected browser wallet.
 * Relies on EIP-3009 typed-data signing (USDC) — no gas for the payer on Base.
 * Attaches DotShot builder code so Base Build can attribute settlements (when the
 * facilitator appends ERC-8021 Schema 2 to calldata).
 */
export async function payForGrant(
  kind: X402GrantKind,
  provider: Eip1193Provider,
  address: `0x${string}`,
): Promise<X402GrantResult> {
  const network =
    process.env.NEXT_PUBLIC_X402_NETWORK?.trim() || 'eip155:8453';

  await ensureChain(provider, network);

  const usePermit2 = await isSmartAccount(provider, address);
  if (usePermit2) {
    await ensurePermit2Allowance(provider, address, network);
  }

  const signer = makeBrowserSigner(provider, address, usePermit2);
  const client = new x402Client((_version, requirements) => {
    const preferredMethod = usePermit2 ? 'permit2' : 'eip3009';
    const selected = requirements.find(requirement => {
      const method = requirement.extra?.assetTransferMethod ?? 'eip3009';
      return method === preferredMethod;
    });
    if (!selected) {
      throw new Error(`${preferredMethod} payment is not supported by this endpoint`);
    }
    return selected;
  })
    .register('eip155:*', new ExactEvmScheme(signer))
    // Echo server app code (`a`) and attach DotShot as service code (`s`).
    .registerExtension(new BuilderCodeClientExtension(BUILDER_CODE));
  const fetchWithPayment = wrapFetchWithPayment(fetch, client);

  const res = await fetchWithPayment(grantPath(kind), {
    method: 'POST',
    headers: { accept: 'application/json' },
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    let code: string | undefined;
    let retryAt: string | undefined;
    try {
      const j = (await res.json()) as {
        error?: string;
        code?: string;
        retryAt?: string;
      };
      if (j?.error) detail = j.error;
      code = j?.code;
      retryAt = j?.retryAt;
    } catch {
      /* ignore */
    }
    const paymentRequired = res.headers.get('PAYMENT-REQUIRED');
    if (paymentRequired) {
      try {
        const decoded = decodePaymentRequiredHeader(paymentRequired);
        if (decoded.error) detail = decoded.error;
      } catch {
        /* keep body/status detail */
      }
    }
    throw new X402PaymentError(detail, code, retryAt);
  }

  const data = (await res.json()) as Partial<X402GrantResult>;
  if (!data.ok || typeof data.shots !== 'number' || data.kind !== kind) {
    throw new Error('invalid grant response');
  }
  return { ok: true, kind, shots: data.shots };
}
