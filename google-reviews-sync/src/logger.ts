/**
 * Lightweight structured logger for JSON-formatted output.
 *
 * Each log entry includes a timestamp, level, message, and optional
 * contextual fields (e.g. requestId, feedbackId). Designed to be
 * parseable by log aggregation tools without introducing heavy
 * runtime dependencies.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveMinLevel(): LogLevel {
  const env = process.env.LOG_LEVEL?.toLowerCase();
  if (env && env in LOG_LEVEL_PRIORITY) {
    return env as LogLevel;
  }
  return 'info';
}

const minLevel = resolveMinLevel();

function shouldLog(level: LogLevel): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (!shouldLog(level)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

/**
 * Creates a child logger with pre-bound context fields.
 * Useful for request-scoped logging where every entry should
 * carry a requestId or other correlation data.
 */
function child(baseContext: Record<string, unknown>): Logger {
  return {
    debug: (msg, ctx?) => write('debug', msg, { ...baseContext, ...ctx }),
    info: (msg, ctx?) => write('info', msg, { ...baseContext, ...ctx }),
    warn: (msg, ctx?) => write('warn', msg, { ...baseContext, ...ctx }),
    error: (msg, ctx?) => write('error', msg, { ...baseContext, ...ctx }),
    child: (extraContext) => child({ ...baseContext, ...extraContext }),
  };
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  child(context: Record<string, unknown>): Logger;
}

export const logger: Logger = {
  debug: (msg, ctx?) => write('debug', msg, ctx),
  info: (msg, ctx?) => write('info', msg, ctx),
  warn: (msg, ctx?) => write('warn', msg, ctx),
  error: (msg, ctx?) => write('error', msg, ctx),
  child,
};
