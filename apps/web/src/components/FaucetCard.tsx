import { formatNear } from "@nolossmeme/sdk";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useToast } from "../hooks/useToast";
import { explorerTx } from "../lib/client";
import { INDEXER_URL } from "../lib/indexer";
import { Turnstile } from "./Turnstile";

import { TURNSTILE_SITE_KEY as SITE_KEY, faucetEnabled } from "../lib/faucet";

function claimLabel(accountId: string | undefined, busy: boolean): string {
  if (!accountId) return "Connect a wallet first";
  return busy ? "Sending…" : "Claim testnet NEAR";
}

/** "Need testnet NEAR?" — one grant per account per day from the backend faucet, gated by Turnstile. */
export function FaucetCard({ accountId }: { accountId: string | undefined }) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const onToken = useCallback((t: string) => setToken(t), []);
  const { data: info } = useQuery({
    queryKey: ["faucet", "info"],
    queryFn: async () =>
      (await fetch(`${INDEXER_URL}/faucet`)).json() as Promise<{
        amount: string;
        cooldown_ms: number;
      }>,
    enabled: faucetEnabled,
    staleTime: 600_000,
  });
  if (!faucetEnabled) return null;

  const claim = async () => {
    if (!accountId || !token) return;
    setBusy(true);
    try {
      const res = await fetch(`${INDEXER_URL}/faucet`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ account_id: accountId, token }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        tx_hash?: string;
        error?: string;
        retry_at?: number;
      };
      if (res.ok && body.tx_hash) {
        setDone(body.tx_hash);
        toast.show({
          kind: "success",
          text: `Sent ${formatNear(info?.amount ?? "0", 2)} Ⓝ to ${accountId}`,
        });
      } else if (res.status === 429 && body.retry_at) {
        toast.show({
          kind: "info",
          text: `Already claimed. Try again ${new Date(body.retry_at).toLocaleString()}`,
        });
      } else {
        toast.show({ kind: "error", text: body.error ?? "faucet error" });
      }
    } catch (e) {
      toast.show({ kind: "error", text: String(e) });
    } finally {
      setBusy(false);
      setToken("");
    }
  };

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Need testnet NEAR?</h2>
        <span className="pill">
          {info
            ? `${formatNear(info.amount, 2)} Ⓝ / ${Math.round(info.cooldown_ms / 3_600_000)}h`
            : "…"}
        </span>
      </div>
      <p className="text-sm text-muted">
        One grant per account per day so you can try a deposit. Pass the check, then claim to your
        connected wallet.
      </p>
      {done ? (
        <a
          className="text-sm text-lime hover:underline"
          href={explorerTx(done)}
          target="_blank"
          rel="noreferrer"
        >
          Sent. View the transaction ↗
        </a>
      ) : (
        <>
          <Turnstile siteKey={SITE_KEY} onToken={onToken} />
          <button
            className="btn-secondary"
            disabled={!accountId || !token || busy}
            onClick={() => void claim()}
          >
            {claimLabel(accountId, busy)}
          </button>
        </>
      )}
    </div>
  );
}
