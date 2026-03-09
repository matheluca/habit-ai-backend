/**
 * LOGGER DE AUDITORIA
 * Registra eventos de segurança (A09)
 */

export type SecurityEventType =
  | 'RATE_LIMIT_EXCEEDED'
  | 'ANOMALY_DETECTED'
  | 'AUTH_FAILED'
  | 'TOKEN_INVALID'
  | 'VALIDATION_FAILED'
  | 'API_CALL_INITIATED'
  | 'API_CALL_COMPLETED'
  | 'API_CALL_ERROR';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: string;
  uid?: string;
  ip?: string;
  endpoint: string;
  statusCode?: number;
  details?: Record<string, any>;
}

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  try {
    const logEntry = JSON.stringify({
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
    });

    console.log(`[SECURITY] ${event.type}: ${event.uid || event.ip} @ ${event.endpoint}`);
    console.log(logEntry);
  } catch (error) {
    console.error('[AUDIT] Erro ao escrever log:', error);
  }
}
