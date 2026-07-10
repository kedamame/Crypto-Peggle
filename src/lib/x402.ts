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
import { BUILDER_CODE as X402_BUILDER_EXT, declareBuilderCodeExtension } from '@x402/extensions/builder-code';
import { BUILDER_CODE } from '@/lib/attribution';
import {
  getX402QuotaStatus,
  releaseX402Settlement,
  reserveX402Settlement,
  X402_QUOTA_REACHED,
  X402_QUOTA_UNAVAILABLE,
  type X402QuotaStatus,
} from '@/lib/x402Quota';

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
  // CDP appends ERC-8021 Schema 2, which Base Build needs for x402 attribution.
  return env('X402_FACILITATOR_URL', 'https://api.cdp.coinbase.com/platform/v2/x402');
}

export function getX402Price(kind: X402GrantKind): string {
  if (kind === 'continue') return env('X402_PRICE_CONTINUE', '$0.001');
  return env('X402_PRICE_EXTRA', '$0.001');
}

function builderCodeExtensions() {
  // ERC-8021 Schema 2 app code (`a`) for Base Build attribution of x402 settlements.
  return {
    [X402_BUILDER_EXT]: declareBuilderCodeExtension(BUILDER_CODE),
  };
}

function buildRoutes(): RoutesConfig {
  const payTo = getX402PayTo();
  const network = getX402Network();
  const extensions = builderCodeExtensions();
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
      extensions,
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
      extensions,
    },
  };
}

let httpServerPromise: Promise<x402HTTPResourceServer> | null = null;

function hasCdpCredentials(): boolean {
  return Boolean(
    process.env.CDP_API_KEY_ID?.trim() && process.env.CDP_API_KEY_SECRET?.trim(),
  );
}

export function getX402ConfigError(): string | null {
  const facUrl = getX402FacilitatorUrl();
  if (facUrl.includes('api.cdp.coinbase.com') && !hasCdpCredentials()) {
    return 'CDP_API_KEY_ID / CDP_API_KEY_SECRET are required when using the CDP facilitator';
  }
  if (
    !process.env.UPSTASH_REDIS_REST_URL?.trim() ||
    !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()
  ) {
    return 'UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are required for the free-tier guard';
  }
  return null;
}

async function getHttpServer(): Promise<x402HTTPResourceServer> {
  if (!httpServerPromise) {
    httpServerPromise = (async () => {
      const configError = getX402ConfigError();
      if (configError) throw new Error(configError);

      const cdpKeyId = process.env.CDP_API_KEY_ID?.trim();
      const cdpKeySecret = process.env.CDP_API_KEY_SECRET?.trim();
      let facilitatorClient: HTTPFacilitatorClient;
      if (cdpKeyId && cdpKeySecret && getX402FacilitatorUrl().includes('api.cdp.coinbase.com')) {
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
    })().catch((err) => {
      // Allow a later request to retry after env/config is fixed.
      httpServerPromise = null;
      throw err;
    });
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

function quotaResponse(status: X402QuotaStatus): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      code: X402_QUOTA_REACHED,
      error: 'Monthly free x402 limit reached',
      retryAt: status.retryAt,
      used: status.used,
      limit: status.limit,
    },
    { status: 503, headers: { 'retry-after': new Date(status.retryAt).toUTCString() } },
  );
}

function quotaUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      code: X402_QUOTA_UNAVAILABLE,
      error: 'Paid shots are temporarily unavailable because the free-tier guard could not be verified',
    },
    { status: 503 },
  );
}

/**
 * Verify x402 payment for a protected grant route, run the success body builder,
 * then settle. Mirrors `@x402/next` withX402 settle-after-success behaviour.
 */
export async function handleX402Grant(
  req: NextRequest,
  kind: X402GrantKind,
): Promise<NextResponse> {
  try {
    const payTo = getX402PayTo();
    if (payTo === ZERO) {
      return NextResponse.json(
        { ok: false, error: 'X402_PAY_TO is not configured' },
        { status: 503 },
      );
    }

    const configError = getX402ConfigError();
    if (configError) {
      return NextResponse.json({ ok: false, error: configError }, { status: 503 });
    }

    // Check before returning a 402 so a player is not asked to sign when the
    // monthly allowance is already exhausted. The paid retry reserves atomically below.
    try {
      const quota = await getX402QuotaStatus();
      if (!quota.allowed) return quotaResponse(quota);
    } catch (err) {
      console.error('[x402] quota preflight error:', err);
      return quotaUnavailableResponse();
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
    const quotaNow = new Date();
    let reservation;
    try {
      reservation = await reserveX402Settlement(quotaNow);
    } catch (err) {
      console.error('[x402] quota reservation error:', err);
      await result.cancellationDispatcher
        .cancel({ reason: 'handler_failed', responseStatus: 503 })
        .catch(() => {});
      return quotaUnavailableResponse();
    }
    if (!reservation.allowed) {
      await result.cancellationDispatcher
        .cancel({ reason: 'handler_failed', responseStatus: 503 })
        .catch(() => {});
      return quotaResponse(reservation);
    }

    try {
      const settle = await httpServer.processSettlement(
        result.paymentPayload,
        result.paymentRequirements,
        result.declaredExtensions,
        { request: context, responseHeaders: successHeaders },
      );

      if (!settle.success) {
        await releaseX402Settlement(quotaNow).catch((err) => {
          console.error('[x402] quota release error:', err);
        });
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
      const message = err instanceof Error ? err.message : 'settlement failed';
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  } catch (err) {
    console.error('[x402] grant error:', err);
    const message = err instanceof Error ? err.message : 'x402 server error';
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
