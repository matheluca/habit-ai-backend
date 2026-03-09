import { kv } from '@vercel/kv';

/**
 * SISTEMA DE RATE LIMITING
 * Protege rotas de IA contra abuso (A06, A07)
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  recentCalls: number;
  threshold: number;
}

const RATE_LIMITS = {
  UID_PER_HOUR: 10,
  IP_PER_HOUR: 50,
  ANOMALY_WINDOW: 120,
  ANOMALY_THRESHOLD: 5,
  TOKEN_MAX_AGE: 3600,
};

const RATE_LIMIT_WINDOW = 3600;

export async function checkRateLimitByUID(
  uid: string,
  endpoint: string
): Promise<RateLimitResult> {
  try {
    const key = `rl:uid:${uid}:${endpoint}`;
    const count = await kv.incr(key);

    if (count === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }

    const limit = RATE_LIMITS.UID_PER_HOUR;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      remaining,
      resetAt: Date.now() + RATE_LIMIT_WINDOW * 1000,
      retryAfter: allowed ? undefined : RATE_LIMIT_WINDOW,
    };
  } catch (error) {
    console.error('[RateLimit] Erro ao verificar UID limit:', error);
    return { allowed: true, remaining: 10, resetAt: Date.now() };
  }
}

export async function checkRateLimitByIP(
  ip: string,
  endpoint: string
): Promise<RateLimitResult> {
  try {
    const key = `rl:ip:${ip}:${endpoint}`;
    const count = await kv.incr(key);

    if (count === 1) {
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }

    const limit = RATE_LIMITS.IP_PER_HOUR;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      remaining,
      resetAt: Date.now() + RATE_LIMIT_WINDOW * 1000,
      retryAfter: allowed ? undefined : RATE_LIMIT_WINDOW,
    };
  } catch (error) {
    console.error('[RateLimit] Erro ao verificar IP limit:', error);
    return { allowed: true, remaining: 50, resetAt: Date.now() };
  }
}

export async function checkAnomalyPattern(
  uid: string,
  endpoint: string
): Promise<AnomalyResult> {
  try {
    const key = `pattern:uid:${uid}:${endpoint}`;
    const count = await kv.incr(key);

    if (count === 1) {
      await kv.expire(key, RATE_LIMITS.ANOMALY_WINDOW);
    }

    const isAnomaly = count > RATE_LIMITS.ANOMALY_THRESHOLD;

    return {
      isAnomaly,
      recentCalls: count,
      threshold: RATE_LIMITS.ANOMALY_THRESHOLD,
    };
  } catch (error) {
    console.error('[RateLimit] Erro ao verificar anomalia:', error);
    return {
      isAnomaly: false,
      recentCalls: 0,
      threshold: RATE_LIMITS.ANOMALY_THRESHOLD,
    };
  }
}

export function validateTokenAge(tokenIssuedAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ageSeconds = now - tokenIssuedAt;
  return ageSeconds < RATE_LIMITS.TOKEN_MAX_AGE;
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

export function formatRateLimitHeaders(result: RateLimitResult) {
  return {
    'X-RateLimit-Limit': '10',
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
    ...(result.retryAfter && { 'Retry-After': String(result.retryAfter) }),
  };
}
