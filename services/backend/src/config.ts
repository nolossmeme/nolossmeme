import { NETWORKS, type NetworkId } from "@nolossmeme/sdk";
import { z } from "zod";

const Env = z.object({
  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  FACTORY_ID: z.string().optional(),
  RPC_URL: z.string().url().optional(),
  /** FastNEAR's free block archive, NEAR Lake format: https://testnet.neardata.xyz/v0/block/{height} */
  NEARDATA_URL: z.string().url().optional(),
  DATABASE_URL: z.string().default("file:./data/nolossmeme.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  /** First block to index. Defaults to a height shortly before the testnet factory was deployed. */
  START_BLOCK: z.coerce.number().int().positive().default(276_200_000),
  SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  /** Pre-filter blocks with `EXPERIMENTAL_changes_in_block` (cheap on the RPC) before fetching them from the archive. */
  SPARSE_SCAN: z.coerce.boolean().default(true),
  RPC_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(6),
  RPC_RPS: z.coerce.number().min(0.5).max(100).default(6),
  /** Requests per second against the block archive (FastNEAR throttles aggressive clients). */
  NEARDATA_RPS: z.coerce.number().min(0.2).max(50).default(2),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().min(10_000).default(300_000),
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z.string().default("*"),
  KEEPER_ACCOUNT_ID: z.string().optional(),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  KEEPER_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export interface Config extends z.infer<typeof Env> {
  network: (typeof NETWORKS)[NetworkId];
  rpcUrl: string;
  neardataUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = Env.parse(env);
  const networkId: NetworkId = e.NEAR_NETWORK;
  const network = { ...NETWORKS[networkId], factory: e.FACTORY_ID ?? NETWORKS[networkId].factory };
  return {
    ...e,
    network,
    rpcUrl: e.RPC_URL ?? network.rpcUrl,
    neardataUrl:
      e.NEARDATA_URL ??
      (networkId === "mainnet" ? "https://mainnet.neardata.xyz" : "https://testnet.neardata.xyz"),
  };
}
