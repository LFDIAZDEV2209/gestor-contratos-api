import { LoggerService } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';

const SENSITIVE_KEY = /(?:password|token|authorization|secret|cookie|api[-_]?key|credential|session)/i;
const REDACTED = '[REDACTED]';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/** Removes credentials recursively before any event leaves the process. */
export function redactSensitive(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEY.test(key)) return REDACTED;
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        redactSensitive(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

const loggerOptions = {
  level: process.env.LOG_LEVEL ?? 'info',
  format: format.combine(
    format.timestamp(),
    format((info) => Object.assign(info, redactSensitive(info) as Record<string, unknown>))(),
    format.json(),
  ),
  transports: [new transports.Console()],
};

/** Nest's logger replacement; its output is JSON and uses the same redaction policy. */
export const nestLogger: LoggerService = WinstonModule.createLogger(loggerOptions);

/** Emits application events with fields at the JSON root instead of interpolated strings. */
export function logStructured(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const payload = redactSensitive({ event, ...fields }) as Record<string, unknown>;
  switch (level) {
    case 'error': nestLogger.error(payload); break;
    case 'warn': nestLogger.warn(payload); break;
    case 'debug': nestLogger.debug?.(payload); break;
    default: nestLogger.log(payload);
  }
}
