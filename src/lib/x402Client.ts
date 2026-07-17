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
  getAddress,
  getTypesForEIP712Domain,
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

/**
 * Build the JSON string wallets expect for eth_signTypedData_v4.
 *
 * Must inject EIP712Domain into `types` before serializeTypedData — otherwise
 * viem drops the domain to `{}`, and strict wallets (Zerion in-app browser,
 * etc.) reject the request with JSON-RPC "Internal error" (-32603).
 */
export function serializePaymentTypedData(
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
): string {
  const domain = message.domain ?? {};
  if (!domain || Object.keys(domain).length === 0) {
    throw new Error('Payment typed data is missing EIP-712 domain fields');
  }
  const types = {
    EIP712Domain: getTypesForEIP712Domain({ domain }),
    ...message.types,
  };
  const serialized = serializeTypedData({
    domain,
    types,
    primaryType: message.primaryType,
    message: message.message,
  } as Parameters<typeof serializeTypedData>[0]);
  const parsed = JSON.parse(serialized) as { domain?: Record<string, unknown> };
  if (!parsed.domain || Object.keys(parsed.domain).length === 0) {
    throw new Error('Failed to serialize EIP-712 domain for wallet signing');
  }
  return serialized;
}

function rpcErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return err instanceof Error ? err.message : 'Unknown wallet error';
  }
  const e = err as {
    message?: unknown;
    code?: unknown;
    data?: { message?: unknown } | string;
    error?: { message?: unknown; code?: unknown };
  };
  const nested =
    (typeof e.error?.message === 'string' && e.error.message) ||
    (typeof e.data === 'object' &&
      e.data &&
      typeof e.data.message === 'string' &&
      e.data.message) ||
    (typeof e.message === 'string' && e.message) ||
    '';
  const code = e.code ?? e.error?.code;
  if (code === 4001 || code === 'ACTION_REJECTED') {
    return 'Wallet signature was rejected';
  }
  if (nested) return nested;
  if (code !== undefined && code !== null) return `Wallet RPC error ${String(code)}`;
  return 'Unknown wallet error';
}

function isSignMethodUnsupported(err: unknown): boolean {
  const msg = rpcErrorMessage(err).toLowerCase();
  const code = (err as { code?: unknown } | null)?.code;
  return (
    code === 4100 ||
    code === -32601 ||
    msg.includes('method not found') ||
    msg.includes('method not supported') ||
    msg.includes('does not exist') ||
    msg.includes('not available') ||
    msg.includes('not implemented')
  );
}

function wantsObjectTypedData(err: unknown): boolean {
  const msg = rpcErrorMessage(err).toLowerCase();
  // Providers that JSON.parse() the 2nd param fail with this when given an object.
  // The inverse — string rejected, object required — is rarer; detect softly.
  return (
    msg.includes('unexpected token') ||
    (msg.includes('json') && msg.includes('parse') && !msg.includes('[object object]'))
  );
}

async function requestTypedDataSignature(
  provider: Eip1193Provider,
  method: 'eth_signTypedData_v4' | 'eth_signTypedData',
  account: `0x${string}`,
  data: unknown,
): Promise<`0x${string}`> {
  const signature = await provider.request({
    method,
    params: [account, data],
  });
  if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]+$/.test(signature)) {
    throw new Error('Wallet returned an invalid typed-data signature');
  }
  return signature as `0x${string}`;
}

async function signWithProvider(
  provider: Eip1193Provider,
  account: `0x${string}`,
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
): Promise<`0x${string}`> {
  // Prefer checksummed address — some mobile wallets compare exactly.
  const signer = getAddress(account);
  // Zerion's in-app browser JSON.parse()s the 2nd param. Passing a raw object
  // becomes String(obj) === "[object Object]" → "is not valid JSON".
  // MetaMask / most injected providers also expect a JSON string here.
  const typedDataJson = serializePaymentTypedData(message);
  const typedDataObject = JSON.parse(typedDataJson) as Record<string, unknown>;

  try {
    return await requestTypedDataSignature(
      provider,
      'eth_signTypedData_v4',
      signer,
      typedDataJson,
    );
  } catch (err) {
    if ((err as { code?: number } | null)?.code === 4001) {
      throw new Error(rpcErrorMessage(err));
    }

    // Only fall back to object form when the provider clearly rejected a string.
    if (wantsObjectTypedData(err)) {
      try {
        return await requestTypedDataSignature(
          provider,
          'eth_signTypedData_v4',
          signer,
          typedDataObject,
        );
      } catch (objectErr) {
        if ((objectErr as { code?: number } | null)?.code === 4001) {
          throw new Error(rpcErrorMessage(objectErr));
        }
        throw new Error(rpcErrorMessage(objectErr));
      }
    }

    if (isSignMethodUnsupported(err)) {
      try {
        return await requestTypedDataSignature(
          provider,
          'eth_signTypedData',
          signer,
          typedDataJson,
        );
      } catch (legacyErr) {
        if ((legacyErr as { code?: number } | null)?.code === 4001) {
          throw new Error(rpcErrorMessage(legacyErr));
        }
        throw new Error(rpcErrorMessage(legacyErr));
      }
    }

    throw new Error(rpcErrorMessage(err));
  }
}

const ERC1271_MAGIC = '0x1626ba7e';

function encodeSignatureWrapper(
  ownerIndex: number,
  signatureData: Hex,
): Hex {
  return encodeAbiParameters(
    [
      {
        type: 'tuple',
        components: [
          { name: 'ownerIndex', type: 'uint8' },
          { name: 'signatureData', type: 'bytes' },
        ],
      },
    ],
    [{ ownerIndex, signatureData }],
  );
}

async function isValidSmartWalletSignature(
  provider: Eip1193Provider,
  account: `0x${string}`,
  digest: Hex,
  signature: Hex,
): Promise<boolean> {
  try {
    const validationResult = await readSmartWalletContract(
      provider,
      account,
      'isValidSignature',
      [digest, signature],
    );
    const magicValue = decodeFunctionResult({
      abi: COINBASE_SMART_WALLET_ABI,
      functionName: 'isValidSignature',
      data: validationResult,
    });
    return magicValue === ERC1271_MAGIC;
  } catch {
    // Wrong signature encoding reverts inside CoinbaseSmartWallet.
    return false;
  }
}

async function getSmartWalletOwnerCount(
  provider: Eip1193Provider,
  account: `0x${string}`,
): Promise<number | null> {
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
    return Math.min(Number(nextOwnerIndex), 32);
  } catch {
    return null;
  }
}

/**
 * Try every owner index so passkey (WebAuthn) owners work — they cannot be
 * recovered with ecrecover the way ECDSA owners can.
 */
async function wrapSignatureWithOwnerIndex(
  provider: Eip1193Provider,
  account: `0x${string}`,
  digest: Hex,
  signatureData: Hex,
  ownerCount: number,
): Promise<Hex | null> {
  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
    const wrapped = encodeSignatureWrapper(ownerIndex, signatureData);
    if (await isValidSmartWalletSignature(provider, account, digest, wrapped)) {
      return wrapped;
    }
  }
  return null;
}

/**
 * ECDSA owner path: sign CoinbaseSmartWallet's replay-safe EIP-712 envelope,
 * recover the owner, and wrap as SignatureWrapper(ownerIndex, signatureData).
 * Needed when eth_signTypedData_v4 returns a raw 65-byte owner signature that
 * Permit2 would otherwise treat as a direct EOA authorization.
 */
async function signReplaySafeEcdsaOwner(
  provider: Eip1193Provider,
  account: `0x${string}`,
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
  originalDigest: Hex,
  ownerCount: number,
): Promise<Hex | null> {
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

  const signature = await signWithProvider(provider, account, replaySafeMessage);
  if (signature.length !== 132) {
    // Passkey / already-wrapped response for the replay-safe message.
    if (await isValidSmartWalletSignature(provider, account, originalDigest, signature)) {
      return signature;
    }
    return wrapSignatureWithOwnerIndex(
      provider,
      account,
      originalDigest,
      signature,
      ownerCount,
    );
  }

  const replayDigest = hashTypedData(
    replaySafeMessage as Parameters<typeof hashTypedData>[0],
  );
  const ownerSigner = await recoverAddress({ hash: replayDigest, signature });

  for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
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
    // EOA owners are 20-byte addresses ABI-encoded as 32-byte left-padded words
    // (hex length 66 with 0x). Passkey owners are 64-byte public keys.
    if (ownerBytes.length !== 66) continue;
    const ownerAddress = `0x${ownerBytes.slice(-40)}` as `0x${string}`;
    if (!isAddressEqual(ownerAddress, ownerSigner)) continue;
    const wrappedSignature = encodeSignatureWrapper(ownerIndex, signature);
    if (
      !(await isValidSmartWalletSignature(
        provider,
        account,
        originalDigest,
        wrappedSignature,
      ))
    ) {
      throw new Error('Base Wallet rejected the wrapped payment signature');
    }
    return wrappedSignature;
  }
  throw new Error('Unable to match the Base Wallet signing owner');
}

/**
 * Produce an ERC-1271 signature for a Coinbase / Base Smart Wallet.
 *
 * Base App passkey wallets already return a valid SignatureWrapper from
 * eth_signTypedData_v4 on the original typed data — prefer that (one prompt).
 * Only fall back to the replay-safe ECDSA wrap when the native signature is a
 * raw 65-byte owner sig that fails ERC-1271 (EIP-7702 / extension edge cases).
 */
async function signCoinbaseSmartWalletTypedData(
  provider: Eip1193Provider,
  account: `0x${string}`,
  message: Parameters<ClientEvmSigner['signTypedData']>[0],
): Promise<`0x${string}` | null> {
  const ownerCount = await getSmartWalletOwnerCount(provider, account);
  if (ownerCount === null) return null;
  if (ownerCount === 0) return null;

  const originalDigest = hashTypedData(
    message as Parameters<typeof hashTypedData>[0],
  );

  // 1) Native sign of the original Permit2 / payment typed data.
  const nativeSignature = await signWithProvider(provider, account, message);
  if (
    await isValidSmartWalletSignature(
      provider,
      account,
      originalDigest,
      nativeSignature,
    )
  ) {
    return nativeSignature;
  }

  // 2) Native bytes may be bare signatureData (common for some passkey paths).
  const wrappedNative = await wrapSignatureWithOwnerIndex(
    provider,
    account,
    originalDigest,
    nativeSignature,
    ownerCount,
  );
  if (wrappedNative) return wrappedNative;

  // 3) Raw ECDSA owner signature of the original digest is not ERC-1271-valid
  // on CoinbaseSmartWallet (it expects a signature over the replay-safe hash).
  // Ask for that envelope and wrap with the matching EOA owner index.
  if (nativeSignature.length === 132) {
    return signReplaySafeEcdsaOwner(
      provider,
      account,
      message,
      originalDigest,
      ownerCount,
    );
  }

  throw new Error(
    'Base Wallet could not produce a valid ERC-1271 payment signature',
  );
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
