import { QueryFailedError } from 'typeorm';

/** Keep useful diagnostics without serializing queries, parameters, headers or bodies. */
export function exceptionDiagnostic(exception: unknown): Record<string, unknown> {
  if (!(exception instanceof Error)) return { name: 'UnknownError' };
  const diagnostic: Record<string, unknown> = {
    name: sanitizeDiagnosticText(exception.name),
    // DB error messages may embed arbitrary column values; SQLSTATE and stack
    // identify the failure without copying those values into the logs.
    message: exception instanceof QueryFailedError ? 'Database query failed' : sanitizeDiagnosticText(exception.message),
    stack: exception.stack?.split('\n').filter((line) => /^\s+at\s/.test(line)).map(sanitizeDiagnosticText),
  };
  if (exception instanceof QueryFailedError) {
    const code: unknown = (exception.driverError as { code?: unknown }).code;
    if (typeof code === 'string' && /^[A-Z0-9]{5}$/.test(code)) diagnostic.databaseCode = code;
  }
  return diagnostic;
}

function sanitizeDiagnosticText(text: string): string {
  return text.split('\n').map((line) => {
    // Free-form exception text cannot use object-key redaction. Remove entire
    // credential-bearing lines, plus URL credentials and quoted data values.
    if (/(?:password|passwd|token|authorization|secret|cookie|api[-_]?key|credential|session|bearer)/i.test(line)) return '[REDACTED]';
    return line
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[REDACTED_URL]')
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED]')
      .replace(/'([^']|'')*'|"[^"]*"/g, '[REDACTED]');
  }).join('\n');
}
