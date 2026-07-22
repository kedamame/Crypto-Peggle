/**
 * Paid continue / extra-shot via a normal Base USDC transfer (not x402).
 * Mirrors submitScore: wallet_switch → writeContract + DATA_SUFFIX → wait for receipt.
 */
import { createPublicClient, createWalletClient, custom, parseAbi } from 'viem';
import { base } from 'viem/chains';
import { DATA_SUFFIX } from '@/lib/attribution';
import { payPriceLabel, parseUsdcAmount } from '@/lib/payPrices';

export type PayGrantKind = 'continue' | 'extra';

export type PayGrantResult = {
  ok: true;
  kind: PayGrantKind;
  shots: number;
  txHash: `0x${string}`;
};

export type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

const DEFAULT_PAY_TO = '0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638' as const;
/** Native USDC on Base mainnet. */
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

const ERC20_ABI = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

function getPayTo(): `0x${string}` {
  const raw = process.env.NEXT_PUBLIC_PAY_TO?.trim() || DEFAULT_PAY_TO;
  return raw as `0x${string}`;
}

async function ensureBase(provider: Eip1193Provider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    });
  } catch (switchErr) {
    const code = (switchErr as { code?: number }).code;
    if (code === 4001) throw switchErr;
    if (code === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org'],
          },
        ],
      });
    }
  }
}

/**
 * Pay for a continue (+3) or extra-shot (+1) grant with an on-chain USDC transfer.
 */
export async function payForGrant(
  kind: PayGrantKind,
  provider: Eip1193Provider,
  walletAddress: `0x${string}`,
): Promise<PayGrantResult> {
  await ensureBase(provider);

  const payTo = getPayTo();
  const amount = parseUsdcAmount(payPriceLabel(kind));
  const transport = custom(provider as Parameters<typeof custom>[0]);

  const walletClient = createWalletClient({
    chain: base,
    transport,
  });
  const publicClient = createPublicClient({
    chain: base,
    transport,
  });

  const hash = await walletClient.writeContract({
    account: walletAddress,
    address: USDC_BASE,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [payTo, amount],
    dataSuffix: DATA_SUFFIX,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error('Payment transaction reverted');
  }

  return {
    ok: true,
    kind,
    shots: kind === 'continue' ? 3 : 1,
    txHash: hash,
  };
}
