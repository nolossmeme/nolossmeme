/** Tiny leveled logger (JSON lines) so the service stays dependency-light. */
type Level = "debug" | "info" | "warn" | "error";
const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
let threshold: Level = "info";

export function setLogLevel(level: Level): void {
  threshold = level;
}

function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
  if (order[level] < order[threshold]) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...data });
  (level === "error" ? console.error : console.log)(line);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>): void => emit("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>): void => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>): void => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>): void => emit("error", msg, data),
};
