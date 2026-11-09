import { describe, expect, it } from "vitest";

import {
  bpsToPercent,
  plural,
  formatDuration,
  formatMeme,
  formatNear,
  parseMeme,
  parseNear,
  shortAccount,
} from "../format.js";

describe("parse/format", () => {
  it("round-trips NEAR amounts", () => {
    expect(parseNear("1.5")).toBe(1_500_000_000_000_000_000_000_000n);
    expect(formatNear(parseNear("1.5"))).toBe("1.5");
    expect(formatNear("1000000000000000000000000")).toBe("1");
    expect(formatNear(parseNear("0.00049"), 4)).toBe("0.0004");
  });

  it("round-trips MEME amounts with 18 decimals", () => {
    expect(parseMeme("700")).toBe(700n * 10n ** 18n);
    expect(formatMeme("700000000000000000000")).toBe("700");
    expect(formatMeme(parseMeme("12.345"), 2)).toBe("12.34");
  });

  it("rejects malformed input", () => {
    expect(() => parseNear("abc")).toThrow();
    expect(() => parseNear("1.1234567890123456789012345")).toThrow();
    expect(() => parseNear("")).toThrow();
  });

  it("formats helpers", () => {
    expect(bpsToPercent(7000)).toBe("70%");
    expect(bpsToPercent(1250)).toBe("12.5%");
    expect(plural(1, "depositor")).toBe("1 depositor");
    expect(plural(3, "draw")).toBe("3 draws");
    expect(formatDuration(3600)).toBe("1h");
    expect(formatDuration(86400)).toBe("1d");
    expect(formatDuration(90)).toBe("90s");
    expect(shortAccount("alice.testnet")).toBe("alice.testnet");
    expect(shortAccount("a".repeat(40) + ".testnet")).toMatch(/…tnet$/);
  });
});
