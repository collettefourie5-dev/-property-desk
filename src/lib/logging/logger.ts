import 'server-only';
import { getEnv } from '@/lib/env';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const REDACT_KEYS = new Set([
  'password',
  'passwordconfirm',
  'token',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'cookie',
  'session',
  'cardnumber',
  'card_number',
  'cvv',
  'passphrase',
]);

/** Recursively redacts values for keys that look like credentials/secrets before they hit the logs. */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(val, depth + 1);
  }
  return out;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  route?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: Level;
  message: string;
  [key: string]: unknown;
}

function write(level: Level, message: string, context: LogContext = {}) {
  let minLevel: Level = 'info';
  try {
    minLevel = getEnv().LOG_LEVEL;
  } catch {
    // env not validated yet (e.g. very early boot) — fall back to 'info'
  }
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(redact(context) as Record<string, unknown>),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  child: (baseContext: LogContext) => Logger;
}

function createLogger(baseContext: LogContext = {}): Logger {
  return {
    debug: (message, context) => write('debug', message, { ...baseContext, ...context }),
    info: (message, context) => write('info', message, { ...baseContext, ...context }),
    warn: (message, context) => write('warn', message, { ...baseContext, ...context }),
    error: (message, context) => write('error', message, { ...baseContext, ...context }),
    child: (extra) => createLogger({ ...baseContext, ...extra }),
  };
}

export const logger = createLogger();
