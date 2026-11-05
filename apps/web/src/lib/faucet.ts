import { indexerEnabled } from "./indexer";

export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";
/** The faucet card needs the backend (secret side) and a Turnstile site key (widget side). */
export const faucetEnabled = indexerEnabled && TURNSTILE_SITE_KEY.length > 0;
