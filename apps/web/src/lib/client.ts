import { NETWORKS, NoLossMemeClient, type NetworkId } from "@nolossmeme/sdk";

export const NETWORK_ID: NetworkId =
  (import.meta.env.VITE_NEAR_NETWORK as NetworkId | undefined) ?? "testnet";

export const network = {
  ...NETWORKS[NETWORK_ID],
  factory: (import.meta.env.VITE_FACTORY_ID as string | undefined) ?? NETWORKS[NETWORK_ID].factory,
};

export const client = new NoLossMemeClient(network);

export function explorerAccount(accountId: string): string {
  return `${network.explorerUrl}/address/${accountId}`;
}

export function explorerTx(hash: string): string {
  return `${network.explorerUrl}/txns/${hash}`;
}
