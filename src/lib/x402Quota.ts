const DEFAULT_MONTHLY_LIMIT = 900;
const QUOTA_PREFIX = 'dotshot:x402:settlements';

export const X402_QUOTA_REACHED = 'X402_MONTHLY_LIMIT_REACHED';
export const X402_QUOTA_UNAVAILABLE = 'X402_QUOTA_UNAVAILABLE';

type RedisReply<T> = {
  result?: T;
  error?: string;
};

export type X402QuotaStatus = {
  allowed: boolean;
  used: number;
  limit: number;
  retryAt: string;
};

function monthlyLimit(): number {
  const parsed = Number.parseInt(process.env.X402_MONTHLY_SETTLEMENT_LIMIT || '', 10);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.min(parsed, 999)
    : DEFAULT_MONTHLY_LIMIT;
}

function monthParts(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthId = `${year}-${String(month + 1).padStart(2, '0')}`;
  const nextMonth = new Date(Date.UTC(year, month + 1, 1));
  return {
    key: `${QUOTA_PREFIX}:${monthId}`,
    retryAt: nextMonth.toISOString(),
    ttlSeconds: Math.max(60, Math.ceil((nextMonth.getTime() - now.getTime()) / 1000) + 86400),
  };
}

function redisConfig(): { url: string; token: string } {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are required');
  }
  return { url: url.replace(/\/+$/, ''), token };
}

async function redisCommand<T>(command: Array<string | number>): Promise<T> {
  const { url, token } = redisConfig();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`quota store returned HTTP ${response.status}`);
  }
  const reply = (await response.json()) as RedisReply<T>;
  if (reply.error || reply.result === undefined) {
    throw new Error(reply.error || 'quota store returned an invalid response');
  }
  return reply.result;
}

export async function getX402QuotaStatus(now = new Date()): Promise<X402QuotaStatus> {
  const { key, retryAt } = monthParts(now);
  const limit = monthlyLimit();
  const raw = await redisCommand<string | null>(['GET', key]);
  const used = raw === null ? 0 : Math.max(0, Number.parseInt(raw, 10) || 0);
  return { allowed: used < limit, used, limit, retryAt };
}

/**
 * Atomically reserves one settlement slot. A reservation is kept on ambiguous
 * facilitator errors so the free-tier guard always fails closed.
 */
export async function reserveX402Settlement(now = new Date()): Promise<X402QuotaStatus> {
  const { key, retryAt, ttlSeconds } = monthParts(now);
  const limit = monthlyLimit();
  const script = [
    'local current = tonumber(redis.call("GET", KEYS[1]) or "0")',
    'local limit = tonumber(ARGV[1])',
    'if current >= limit then return -1 end',
    'local next = redis.call("INCR", KEYS[1])',
    'redis.call("EXPIRE", KEYS[1], ARGV[2])',
    'return next',
  ].join('\n');
  const result = await redisCommand<number>([
    'EVAL',
    script,
    1,
    key,
    limit,
    ttlSeconds,
  ]);
  return {
    allowed: result !== -1,
    used: result === -1 ? limit : result,
    limit,
    retryAt,
  };
}

/** Releases a slot only after an explicit non-settlement response. */
export async function releaseX402Settlement(now = new Date()): Promise<void> {
  const { key } = monthParts(now);
  const script = [
    'local current = tonumber(redis.call("GET", KEYS[1]) or "0")',
    'if current <= 0 then return 0 end',
    'return redis.call("DECR", KEYS[1])',
  ].join('\n');
  await redisCommand<number>(['EVAL', script, 1, key]);
}
