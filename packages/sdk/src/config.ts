/** Deployed addresses and RPC endpoints per network. */
export type NetworkId = "testnet" | "mainnet";

export interface NetworkConfig {
  networkId: NetworkId;
  rpcUrl: string;
  explorerUrl: string;
  factory: string;
  metaPool: string;
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  testnet: {
    networkId: "testnet",
    rpcUrl: "https://test.rpc.fastnear.com",
    explorerUrl: "https://testnet.nearblocks.io",
    factory: "factory.nolossmeme.testnet",
    metaPool: "meta-v2.pool.testnet",
  },
  mainnet: {
    networkId: "mainnet",
    rpcUrl: "https://free.rpc.fastnear.com",
    explorerUrl: "https://nearblocks.io",
    // Not deployed yet; the factory must be launched on mainnet first.
    factory: "nolossmeme.near",
    metaPool: "meta-pool.near",
  },
};

/** Gas budgets (TGas) matching the contracts' promise chains. */
export const GAS = {
  deposit: 150n,
  withdraw: 120n,
  withdrawNear: 200n,
  checkIn: 30n,
  draw: 300n,
  redeem: 80n,
  createMeme: 300n,
  storageDeposit: 30n,
} as const;

/** Meta Pool rejects stakes below this (its `min_deposit_amount`), so pools cannot accept less. */
export const STAKING_MIN_DEPOSIT = 1_000_000_000_000_000_000_000_000n; // 1 NEAR

/** Storage fee the pool charges once per account, in yocto. */
export const STORAGE_COST = 5_000_000_000_000_000_000_000n; // 0.005 NEAR
