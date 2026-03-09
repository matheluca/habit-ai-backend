import {
  validateFirebaseToken,
} from './jwt-validator';
import {
  checkRateLimitByUID,
  checkRateLimitByIP,
  checkAnomalyPattern,
  validateTokenAge,
  getClientIP,
  formatRateLimitHeaders,
} from './rate-limiter';
import { logSecurityEvent } from './audit-logger';

/**
 * MIDDLEWARE DE AUTENTICAÇÃO & RATE LIMITING
 * Valida JWT via Google JWKS + aplica proteções
 */

export async function authenticateAndRateLimit(req: Request): Promise<{
  success: boolean;
  statusCode: number;
  headers: Record<string, string>;
  error?: string;
  user?: {
    uid: string;
    email: string;
    iat: number;
  };
  clientIP?: string;
}> {
  try {
    const ip = getClientIP(req);

    // PASSO 1: Extrair Token
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

    // PASSO 2: Validar JWT contra Google JWKS
    let decoded;
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

    // PASSO 3: Validar Idade do Token (< 1 hora)
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

    // PASSO 4: Rate Limit por UID
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

    // PASSO 5: Rate Limit por IP
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

    // PASSO 6: Detectar Anomalia (5+ em 2min)
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

    // SUCESSO
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

/**
 * Helper para adicionar CORS headers
 */
function getCORSHeaders(headers: Record<string, string> = {}): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers,
  };
}

/**
 * Helper para resposta HTTP padronizada com CORS
 */
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
