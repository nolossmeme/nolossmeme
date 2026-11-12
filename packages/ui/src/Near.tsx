import { fetchNearUsd, formatNear, formatUsd, nearToUsd } from "@nolossmeme/sdk";
import { useSyncExternalStore } from "react";

import nearLogo from "./near.png";

/** The NEAR logo, sized to the surrounding text. */
export function NearIcon({ className = "" }: { className?: string }) {
  return (
    <img
      src={nearLogo}
      alt="NEAR"
      className={`inline-block size-[0.9em] shrink-0 self-center rounded-full ${className}`}
    />
  );
}

// One shared NEAR/USD price for the whole page, refreshed every five minutes.
let price: number | undefined;
let loading = false;
const listeners = new Set<() => void>();
const REFRESH_MS = 300_000;

function load() {
  if (loading) return;
  loading = true;
  fetchNearUsd()
    .then((p) => {
      price = p;
      listeners.forEach((l) => l());
    })
    .catch(() => undefined)
    .finally(() => {
      loading = false;
    });
}

let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(l: () => void) {
  listeners.add(l);
  if (!timer) {
    load();
    timer = setInterval(load, REFRESH_MS);
  }
  return () => {
    listeners.delete(l);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Current NEAR/USD, or undefined until the first quote arrives (or if it never does). */
export function useNearUsd(): number | undefined {
  return useSyncExternalStore(subscribe, () => price);
}

/** "12.5 Ⓝ ≈ $42.50" with the NEAR logo; the dollar part is omitted without a price. */
export function NearAmount({
  yocto,
  digits = 2,
  usd = false,
  className = "",
}: {
  yocto: string | bigint;
  digits?: number;
  usd?: boolean;
  className?: string;
}) {
  const p = useNearUsd();
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${className}`}>
      {formatNear(yocto, digits)}
      <NearIcon />
      {usd && p !== undefined && BigInt(yocto) > 0n && (
        <span className="text-[0.8em] font-sans text-muted">
          ≈ {formatUsd(nearToUsd(yocto, p))}
        </span>
      )}
    </span>
  );
}

/** "100 % withdrawable · ≈ $20.40": a hint line with the dollar value appended once known. */
export function UsdHint({ yocto, prefix }: { yocto: string | bigint; prefix: string }) {
  const p = useNearUsd();
  return (
    <>
      {prefix}
      {p !== undefined && ` · ≈ ${formatUsd(nearToUsd(yocto, p))}`}
    </>
  );
}
