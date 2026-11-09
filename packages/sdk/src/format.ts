/** Unit helpers. Everything on chain is a decimal string of yocto units. */

export const ONE_NEAR = 10n ** 24n;
export const ONE_MEME = 10n ** 18n;
export const ONE_TGAS = 10n ** 12n;
export const NS_PER_SECOND = 1_000_000_000n;

export function toBigInt(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  return BigInt(value);
}

/** "1.5" NEAR -> 1500000000000000000000000n. Accepts up to 24 decimals. */
export function parseNear(near: string | number): bigint {
  return parseUnits(String(near), 24);
}

export function parseMeme(meme: string | number): bigint {
  return parseUnits(String(meme), 18);
}

export function parseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!/^\d*(\.\d*)?$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error(`invalid number: "${value}"`);
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) throw new Error(`more than ${decimals} decimals: "${value}"`);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}

/** 1500000000000000000000000n -> "1.5" (trailing zeros trimmed, max `precision` decimals). */
export function formatUnits(value: string | bigint, decimals: number, precision = 4): string {
  const v = toBigInt(value);
  const negative = v < 0n;
  const abs = negative ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, precision);
  frac = frac.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${frac ? `.${frac}` : ""}`;
}

export function formatNear(yocto: string | bigint, precision = 4): string {
  return formatUnits(yocto, 24, precision);
}

export function formatMeme(yoctoMeme: string | bigint, precision = 2): string {
  return formatUnits(yoctoMeme, 18, precision);
}

export function tgas(amount: bigint): string {
  return (amount * ONE_TGAS).toString();
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%`;
}

/** Nanosecond timestamp string -> JS Date. */
export function nsToDate(ns: string | bigint): Date {
  return new Date(Number(toBigInt(ns) / 1_000_000n));
}

export function nsToSeconds(ns: string | bigint): number {
  return Number(toBigInt(ns) / NS_PER_SECOND);
}

/** Human duration for an epoch length ("1h", "1d", "90s"). */
export function formatDuration(seconds: number): string {
  if (seconds % 86_400 === 0) return `${seconds / 86_400}d`;
  if (seconds % 3_600 === 0) return `${seconds / 3_600}h`;
  if (seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

/** "1 depositor", "3 depositors". */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function shortAccount(accountId: string, max = 20): string {
  if (accountId.length <= max) return accountId;
  return `${accountId.slice(0, max - 7)}…${accountId.slice(-4)}`;
}
