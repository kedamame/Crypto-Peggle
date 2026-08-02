export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

export const LEADERBOARD_ABI = [
  {
    name: 'submitScore',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'score', type: 'uint256' },
      { name: 'level', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getEntry',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'score',     type: 'uint256' },
      { name: 'level',     type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
  },
  {
    name: 'playerCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'totalSubmissions',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/** Silent stele snapshot: how many divers left a mark + optional own onchain depth. */
export type SteleSnapshot = {
  playerCount: number;
  ownLevel: number | null;
};

export async function fetchSteleSnapshot(wallet?: `0x${string}` | null): Promise<SteleSnapshot | null> {
  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') return null;
  try {
    const { createPublicClient, http } = await import('viem');
    const { base } = await import('viem/chains');
    const client = createPublicClient({ chain: base, transport: http() });
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: LEADERBOARD_ABI,
      functionName: 'playerCount',
    });
    let ownLevel: number | null = null;
    if (wallet) {
      const entry = await client.readContract({
        address: CONTRACT_ADDRESS,
        abi: LEADERBOARD_ABI,
        functionName: 'getEntry',
        args: [wallet],
      });
      const lv = Number(entry[1]);
      if (Number.isFinite(lv) && lv > 0) ownLevel = lv;
    }
    return { playerCount: Number(count) || 0, ownLevel };
  } catch {
    return null;
  }
}
