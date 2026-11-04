import { NETWORKS, NoLossMemeClient, type NetworkId } from "@nolossmeme/sdk";

export const NETWORK_ID: NetworkId =
  (import.meta.env.VITE_NEAR_NETWORK as NetworkId | undefined) ?? "testnet";
export const network = {
  ...NETWORKS[NETWORK_ID],
  factory: (import.meta.env.VITE_FACTORY_ID as string | undefined) ?? NETWORKS[NETWORK_ID].factory,
};
export const client = new NoLossMemeClient(network);

/** Where the dApp lives. Locally the app dev server runs on 5173; on Pages it is `/nolossmeme/app/`. */
export const APP_URL = (
  (import.meta.env.VITE_APP_URL as string | undefined) ?? "http://localhost:5173/"
).replace(/\/?$/, "/");
export const appLink = (path = ""): string => `${APP_URL}${path.replace(/^\//, "")}`;
export const REPO_URL = "https://github.com/nolossmeme/nolossmeme";
