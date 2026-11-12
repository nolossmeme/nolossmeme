import { NETWORKS, type NetworkId } from "@nolossmeme/sdk";
import { z } from "zod";

/** Compose passes unset variables as "": treat them as absent. */
const blank = (v: unknown) => (v === "" ? undefined : v);

const Env = z.object({
  NEAR_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  FACTORY_ID: z.preprocess(blank, z.string().optional()),
  RPC_URL: z.url().optional(),
  /** FastNEAR transactions API, used to find the blocks that touched our accounts. */
  TX_API_URL: z.url().optional(),
  /** RPC for jobs that read state and sign transactions (keeper, sponsor, faucet, snapshots).
   *  Defaults to the network RPC; the scanner uses the tx API and the archive, not this quota. */
  JOBS_RPC_URL: z.url().optional(),
  /** FastNEAR's free block archive, NEAR Lake format: https://testnet.neardata.xyz/v0/block/{height} */
  NEARDATA_URL: z.url().optional(),
  DATABASE_URL: z.string().default("file:./data/nolossmeme.db"),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  /** First block to index. Defaults to a height just before `streak.nolossmeme.testnet` was deployed (2026-11-09, block 276929705). */
  START_BLOCK: z.preprocess(blank, z.coerce.number().int().positive().default(276_929_600)),
  SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  /** Fetch only the blocks the transactions API says touched our accounts (instead of every block). */
  SPARSE_SCAN: z.stringbool().default(true),
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
  /** Grants across all accounts per 24 h. */
  FAUCET_DAILY_CAP: z.coerce.number().int().positive().default(50),
  /** Testnet yield subsidy (see jobs/sponsor.ts). Disabled unless the account and key are set. */
  SPONSOR_ACCOUNT_ID: z.string().optional(),
  SPONSOR_PRIVATE_KEY: z.string().optional(),
  SPONSOR_AMOUNT_NEAR: z.coerce.number().min(1).default(1),
  SPONSOR_INTERVAL_HOURS: z.coerce.number().min(0.25).default(12),
  /** Comma list of pool creators the sponsor funds. Defaults to the factory and its parent. */
  SPONSOR_CREATORS: z.preprocess(blank, z.string().optional()),
});

const DEFAULT_TX_API: Record<NetworkId, string> = {
  testnet: "https://tx.test.fastnear.com",
  mainnet: "https://tx.main.fastnear.com",
};

export interface Config extends z.infer<typeof Env> {
  network: (typeof NETWORKS)[NetworkId];
  rpcUrl: string;
  txApiUrl: string;
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
    // rpc.testnet.near.org is deprecated and answers 429 to servers.
    jobsRpcUrl: e.JOBS_RPC_URL ?? network.rpcUrl,
    txApiUrl: e.TX_API_URL ?? DEFAULT_TX_API[networkId],
    neardataUrl:
      e.NEARDATA_URL ??
      (networkId === "mainnet" ? "https://mainnet.neardata.xyz" : "https://testnet.neardata.xyz"),
  };
}
