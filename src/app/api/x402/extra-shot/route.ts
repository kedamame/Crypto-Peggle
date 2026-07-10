import { NextRequest } from 'next/server';
import { handleX402Grant } from '@/lib/x402';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  return handleX402Grant(req, 'extra');
}
