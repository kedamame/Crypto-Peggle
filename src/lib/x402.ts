import { NextRequest, NextResponse } from 'next/server';
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from '@x402/core/server';
import {
  x402HTTPResourceServer,
  type HTTPAdapter,
  type HTTPRequestContext,
  type RoutesConfig,
} from '@x402/core/http';
import { ExactEvmScheme } from '@x402/evm/exact/server';

export const CONTINUE_SHOTS = 3;
export const EXTRA_SHOTS = 1;

export type X402GrantKind = 'continue' | 'extra';

const ZERO = '0x0000000000000000000000000000000000000000';
/** Default USDC recipient when X402_PAY_TO is unset. */
const DEFAULT_PAY_TO = '0x7832dDF0Cf78C8CB52804FF9dDC728fcbCc4f638';

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : fallback;
}

export function getX402PayTo(): `0x${string}` {
  return env('X402_PAY_TO', DEFAULT_PAY_TO) as `0x${string}`;
}

export function getX402Network(): string {
  // Production Base App users are on mainnet; override with X402_NETWORK for Sepolia.
  return env('X402_NETWORK', 'eip155:8453');
}

export function getX402FacilitatorUrl(): string {
  // Mainnet needs CDP facilitator (+ API keys). Sepolia can use https://x402.org/facilitator
  const network = getX402Network();
  const fallback =
    network === 'eip155:8453'
      ? 'https://api.cdp.coinbase.com/platform/v2/x402'
      : 'https://x402.org/facilitator';
  return env('X402_FACILITATOR_URL', fallback);
}

export function getX402Price(kind: X402GrantKind): string {
  if (kind === 'continue') return env('X402_PRICE_CONTINUE', '$0.001');
  return env('X402_PRICE_EXTRA', '$0.0005');
}

function buildRoutes(): RoutesConfig {
  const payTo = getX402PayTo();
  const network = getX402Network();
  return {
    'POST /api/x402/continue': {
      accepts: {
        scheme: 'exact',
        network: network as `${string}:${string}`,
        payTo,
        price: getX402Price('continue'),
      },
      description: 'DotShot continue (+3 shots)',
      mimeType: 'application/json',
    },
    'POST /api/x402/extra-shot': {
      accepts: {
        scheme: 'exact',
        network: network as `${string}:${string}`,
        payTo,
        price: getX402Price('extra'),
      },
      description: 'DotShot extra shot (+1)',
      mimeType: 'application/json',
    },
  };
}

let httpServerPromise: Promise<x402HTTPResourceServer> | null = null;

async function getHttpServer(): Promise<x402HTTPResourceServer> {
  if (!httpServerPromise) {
    httpServerPromise = (async () => {
      const cdpKeyId = process.env.CDP_API_KEY_ID?.trim();
      const cdpKeySecret = process.env.CDP_API_KEY_SECRET?.trim();
      let facilitatorClient: HTTPFacilitatorClient;
      if (cdpKeyId && cdpKeySecret) {
        const { createFacilitatorConfig } = await import('@coinbase/x402');
        facilitatorClient = new HTTPFacilitatorClient(
          createFacilitatorConfig(cdpKeyId, cdpKeySecret),
        );
      } else {
        facilitatorClient = new HTTPFacilitatorClient({
          url: getX402FacilitatorUrl(),
        });
      }
      const resourceServer = new x402ResourceServer(facilitatorClient).register(
        'eip155:*',
        new ExactEvmScheme(),
      );
      const httpServer = new x402HTTPResourceServer(resourceServer, buildRoutes());
      await httpServer.initialize();
      return httpServer;
    })();
  }
  return httpServerPromise;
}

function adapterFromRequest(req: NextRequest): HTTPAdapter {
  const url = new URL(req.url);
  return {
    getHeader: (name) => req.headers.get(name) ?? undefined,
    getMethod: () => req.method,
    getPath: () => url.pathname,
    getUrl: () => req.url,
    getAcceptHeader: () => req.headers.get('accept') ?? '*/*',
    getUserAgent: () => req.headers.get('user-agent') ?? '',
    getQueryParams: () => {
      const out: Record<string, string | string[]> = {};
      url.searchParams.forEach((v, k) => {
        const prev = out[k];
        if (prev === undefined) out[k] = v;
        else if (Array.isArray(prev)) prev.push(v);
        else out[k] = [prev, v];
      });
      return out;
    },
    getQueryParam: (name) => url.searchParams.get(name) ?? undefined,
  };
}

function instructionsToResponse(instr: {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}): NextResponse {
  const headers = new Headers(instr.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const body =
    instr.body === undefined
      ? null
      : typeof instr.body === 'string'
        ? instr.body
        : JSON.stringify(instr.body);
  return new NextResponse(body, { status: instr.status, headers });
}

/**
 * Verify x402 payment for a protected grant route, run the success body builder,
 * then settle. Mirrors `@x402/next` withX402 settle-after-success behaviour.
 */
export async function handleX402Grant(
  req: NextRequest,
  kind: X402GrantKind,
): Promise<NextResponse> {
  const payTo = getX402PayTo();
  if (payTo === ZERO) {
    return NextResponse.json(
      { ok: false, error: 'X402_PAY_TO is not configured' },
      { status: 503 },
    );
  }

  const httpServer = await getHttpServer();
  const adapter = adapterFromRequest(req);
  const paymentHeader =
    req.headers.get('PAYMENT-SIGNATURE') ??
    req.headers.get('payment-signature') ??
    req.headers.get('X-PAYMENT') ??
    undefined;

  const context: HTTPRequestContext = {
    adapter,
    path: adapter.getPath(),
    method: adapter.getMethod(),
    paymentHeader,
  };

  const result = await httpServer.processHTTPRequest(context);

  if (result.type === 'payment-error') {
    return instructionsToResponse(result.response);
  }

  if (result.type === 'no-payment-required') {
    // Routes are always paid; treat as misconfig.
    return NextResponse.json({ ok: false, error: 'payment required' }, { status: 402 });
  }

  // payment-verified
  const shots = kind === 'continue' ? CONTINUE_SHOTS : EXTRA_SHOTS;
  const body = { ok: true as const, kind, shots };
  const successHeaders: Record<string, string> = {
    'content-type': 'application/json',
  };

  try {
    const settle = await httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      { request: context, responseHeaders: successHeaders },
    );

    if (!settle.success) {
      await result.cancellationDispatcher
        .cancel({ reason: 'handler_failed', responseStatus: settle.response.status })
        .catch(() => {});
      return instructionsToResponse(settle.response);
    }

    const headers = new Headers(settle.headers);
    headers.set('content-type', 'application/json');
    return NextResponse.json(body, { status: 200, headers });
  } catch (err) {
    await result.cancellationDispatcher
      .cancel({ reason: 'handler_threw', error: err })
      .catch(() => {});
    console.error('[x402] settle error:', err);
    return NextResponse.json({ ok: false, error: 'settlement failed' }, { status: 502 });
  }
}
