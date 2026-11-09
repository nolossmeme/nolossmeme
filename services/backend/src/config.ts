import { NETWORKS, type NetworkId } from "@nolossmeme/sdk";
import { z } from "zod";

const Env = z.object({
  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  FACTORY_ID: z.string().optional(),
  RPC_URL: z.url().optional(),
  /** Comma-separated RPC endpoints to rotate for the block pre-filter (each has the same per-endpoint rate limit). */
  RPC_URLS: z.string().optional(),
  /** RPC for jobs that read state and sign transactions (keeper, sponsor, faucet, snapshots). Kept
   *  separate from the scanner so indexing can never use up the quota the money paths need. */
  JOBS_RPC_URL: z.url().optional(),
  /** FastNEAR's free block archive, NEAR Lake format: https://testnet.neardata.xyz/v0/block/{height} */
  NEARDATA_URL: z.url().optional(),
  DATABASE_URL: z.string().default("file:./data/nolossmeme.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  /** First block to index. Defaults to a height just before `streak.nolossmeme.testnet` was deployed (2026-11-09, block 276929705). */
  START_BLOCK: z.coerce.number().int().positive().default(276_929_600),
  SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  /** Pre-filter blocks with `EXPERIMENTAL_changes_in_block` (cheap on the RPC) before fetching them from the archive. */
  SPARSE_SCAN: z.coerce.boolean().default(true),
  /** FastNEAR's free RPC answers ~2 req/s sustained for `changes_in_block`; above that it returns 429. */
  RPC_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  RPC_RPS: z.coerce.number().min(0.5).max(100).default(2),
  /** Requests per second against the block archive (FastNEAR throttles aggressive clients). */
  NEARDATA_RPS: z.coerce.number().min(0.2).max(50).default(2),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().min(10_000).default(300_000),
  PORT: z.coerce.number().int().default(8787),
  CORS_ORIGIN: z.string().default("*"),
  KEEPER_ACCOUNT_ID: z.string().optional(),
  KEEPER_PRIVATE_KEY: z.string().optional(),
  KEEPER_INTERVAL_MS: z.coerce.number().int().min(15_000).default(60_000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Which parts to run in this process: `all`, or any comma list of `api`, `scanner`, `jobs`. */
  ROLE: z.string().default("all"),
  /** Testnet faucet (optional): sender account, its key, Turnstile secret, grant size and cooldown. */
  FAUCET_ACCOUNT_ID: z.string().optional(),
  FAUCET_PRIVATE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  FAUCET_AMOUNT_NEAR: z.coerce.number().positive().default(1),
  FAUCET_COOLDOWN_HOURS: z.coerce.number().positive().default(24),
  /** Testnet yield subsidy (see jobs/sponsor.ts). Disabled unless the account and key are set. */
  SPONSOR_ACCOUNT_ID: z.string().optional(),
  SPONSOR_PRIVATE_KEY: z.string().optional(),
  SPONSOR_AMOUNT_NEAR: z.coerce.number().min(1).default(1),
  SPONSOR_INTERVAL_HOURS: z.coerce.number().min(0.25).default(12),
});

/** Free endpoints that serve `EXPERIMENTAL_changes_in_block`; rotating spreads the per-endpoint limits. */
const DEFAULT_RPC_URLS: Record<NetworkId, string> = {
  testnet: "https://test.rpc.fastnear.com,https://archival-rpc.testnet.fastnear.com",
  mainnet: "https://free.rpc.fastnear.com,https://archival-rpc.mainnet.fastnear.com",
};

export interface Config extends z.infer<typeof Env> {
  network: (typeof NETWORKS)[NetworkId];
  rpcUrl: string;
  rpcUrls: string[];
  jobsRpcUrl: string;
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
    jobsRpcUrl:
      e.JOBS_RPC_URL ?? (networkId === "testnet" ? "https://rpc.testnet.near.org" : network.rpcUrl),
    rpcUrls: (e.RPC_URLS ?? DEFAULT_RPC_URLS[networkId])
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean),
    neardataUrl:
      e.NEARDATA_URL ??
      (networkId === "mainnet" ? "https://mainnet.neardata.xyz" : "https://testnet.neardata.xyz"),
  };
}
