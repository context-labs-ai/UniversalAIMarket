type Logger = {
  trace: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: () => Logger;
};

const noop = () => {};

const baseLogger: Logger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => baseLogger,
};

export const pino = () => baseLogger;
export default pino;

export const PINO_LOGGER_DEFAULTS = { level: "info" };
export const PINO_CUSTOM_CONTEXT_KEY = "custom_context";
export const MAX_LOG_SIZE_IN_BYTES_DEFAULT = 1024 * 1000;

export function getDefaultLoggerOptions(opts?: { level?: string }) {
  return { level: opts?.level ?? PINO_LOGGER_DEFAULTS.level };
}

export function formatChildLoggerContext(_logger: Logger, ctx: string) {
  return ctx;
}

export function generateChildLogger(logger: Logger) {
  return logger;
}

export function generateClientLogger() {
  return { logger: baseLogger, chunkLoggerController: null };
}

export function generateServerLogger() {
  return { logger: baseLogger, chunkLoggerController: null };
}

export function generatePlatformLogger() {
  return { logger: baseLogger, chunkLoggerController: null };
}

export function getBrowserLoggerContext() {
  return "";
}

export function getLoggerContext() {
  return "";
}

export function setBrowserLoggerContext<T>(logger: T) {
  return logger;
}
