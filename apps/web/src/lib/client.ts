import { NETWORKS, NoLossMemeClient, type NetworkId } from "@nolossmeme/sdk";

export const NETWORK_ID: NetworkId =
  (import.meta.env.VITE_NEAR_NETWORK as NetworkId | undefined) ?? "testnet";

export const network = {
  ...NETWORKS[NETWORK_ID],
  factory: (import.meta.env.VITE_FACTORY_ID as string | undefined) ?? NETWORKS[NETWORK_ID].factory,
};

export const client = new NoLossMemeClient(network);

/** The marketing site; on Pages it is one level up from the app. */
export const LANDING_URL =
  (import.meta.env.VITE_LANDING_URL as string | undefined) ?? "http://localhost:5174/";

export function explorerAccount(accountId: string): string {
  return `${network.explorerUrl}/address/${accountId}`;
}

export function explorerTx(hash: string): string {
  return `${network.explorerUrl}/txns/${hash}`;
}
