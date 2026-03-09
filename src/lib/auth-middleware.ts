import { validateFirebaseToken, FirebaseToken } from './jwt-validator';
import {
  checkRateLimitByUID,
  checkRateLimitByIP,
  checkAnomalyPattern,
  validateTokenAge,
  getClientIP,
  formatRateLimitHeaders,
} from './rate-limiter';
import { logSecurityEvent, SecurityEventType } from './audit-logger';

export interface AuthResult {
  success: boolean;
  statusCode: number;
  headers: Record<string, string>;
  error?: string;
  user?: FirebaseToken;
  clientIP?: string;
}

function getCORSHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  };
}

export async function authenticateAndRateLimit(req: Request): Promise<AuthResult> {
  try {
    const ip = getClientIP(req);

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      await logSecurityEvent({
        type: 'AUTH_FAILED',
        ip,
        endpoint: req.url,
        statusCode: 401,
        details: { reason: 'Missing token' },
      });

      return {
        success: false,
        statusCode: 401,
        headers: getCORSHeaders({ 'Content-Type': 'application/json' }),
        error: 'Missing authorization token',
      };
    }

    let decoded: FirebaseToken;
    try {
      decoded = await validateFirebaseToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid token';

      await logSecurityEvent({
        type: 'TOKEN_INVALID',
        ip,
        endpoint: req.url,
        statusCode: 401,
        details: { error: message },
      });

      return {
        success: false,
        statusCode: 401,
        headers: getCORSHeaders({ 'Content-Type': 'application/json' }),
        error: 'Invalid token',
      };
    }

    const uid = decoded.uid;
    const email = decoded.email;
    const iat = decoded.iat;

    if (!validateTokenAge(iat)) {
      await logSecurityEvent({
        type: 'TOKEN_INVALID',
        uid,
        ip,
        endpoint: req.url,
        statusCode: 401,
        details: { tokenAge: Math.floor(Date.now() / 1000) - iat },
      });

      return {
        success: false,
        statusCode: 401,
        headers: getCORSHeaders({ 'Content-Type': 'application/json' }),
        error: 'Token expired. Please login again.',
      };
    }

    const endpoint = new URL(req.url).pathname;
    const rateLimitUID = await checkRateLimitByUID(uid, endpoint);

    if (!rateLimitUID.allowed) {
      await logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        uid,
        ip,
        endpoint,
        statusCode: 429,
        details: { reason: 'UID limit exceeded (10/hour)' },
      });

      return {
        success: false,
        statusCode: 429,
        headers: getCORSHeaders({
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitUID.retryAfter),
          ...formatRateLimitHeaders(rateLimitUID),
        }),
        error: 'Too many requests. Please try again later.',
      };
    }

    const rateLimitIP = await checkRateLimitByIP(ip, endpoint);

    if (!rateLimitIP.allowed) {
      await logSecurityEvent({
        type: 'RATE_LIMIT_EXCEEDED',
        ip,
        endpoint,
        statusCode: 429,
        details: { reason: 'IP limit exceeded (50/hour)' },
      });

      return {
        success: false,
        statusCode: 429,
        headers: getCORSHeaders({
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitIP.retryAfter),
          ...formatRateLimitHeaders(rateLimitIP),
        }),
        error: 'Too many requests from this IP.',
      };
    }

    const anomaly = await checkAnomalyPattern(uid, endpoint);

    if (anomaly.isAnomaly) {
      await logSecurityEvent({
        type: 'ANOMALY_DETECTED',
        uid,
        ip,
        endpoint,
        statusCode: 429,
        details: { recentCalls: anomaly.recentCalls },
      });

      return {
        success: false,
        statusCode: 429,
        headers: getCORSHeaders({ 'Content-Type': 'application/json' }),
        error: 'Suspicious activity detected.',
      };
    }

    return {
      success: true,
      statusCode: 200,
      headers: getCORSHeaders({
        ...formatRateLimitHeaders(rateLimitUID),
      }),
      user: { uid, email, iat },
      clientIP: ip,
    };
  } catch (error) {
    console.error('[Auth Middleware] Erro inesperado:', error);

    return {
      success: false,
      statusCode: 500,
      headers: getCORSHeaders({ 'Content-Type': 'application/json' }),
      error: 'Internal server error',
    };
  }
}

export function createResponse(
  statusCode: number,
  body: Record<string, any>,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: getCORSHeaders({
      'Content-Type': 'application/json',
      ...headers,
    }),
  });
}
