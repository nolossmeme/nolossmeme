/** "1,5" → "1.5"; anything that is not a plain decimal ("1e3", "1.2.", "-1") is refused. */
export function decimalInput(raw: string): string | null {
  const v = raw.trim().replace(",", ".");
  const [whole = "", frac, extra] = v.split(".");
  const digits = (x: string) => [...x].every((c) => c >= "0" && c <= "9");
  return extra === undefined && digits(whole) && digits(frac ?? "") ? v : null;
}
