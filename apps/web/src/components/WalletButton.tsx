import { shortAccount } from "@nolossmeme/sdk";
import { useNearWallet } from "near-connect-hooks";

export function WalletButton() {
  const { signedAccountId, signIn, signOut, loading } = useNearWallet();
  if (loading)
    return (
      <button className="btn-secondary" disabled>
        …
      </button>
    );
  if (!signedAccountId) {
    return (
      <button className="btn-primary" onClick={() => void signIn()}>
        Connect wallet
      </button>
    );
  }
  return (
    <button className="btn-secondary font-mono" onClick={() => void signOut()} title="Disconnect">
      <span className="size-2 rounded-full bg-lime" aria-hidden />
      {shortAccount(signedAccountId, 18)}
    </button>
  );
}
