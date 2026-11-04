/** Read-only client over JSON-RPC. Writes go through `actions.ts` and the user's wallet. */
import { JsonRpcProvider } from "near-api-js";

import { NETWORKS, type NetworkConfig, type NetworkId } from "./config.js";
import type { AccountView, Draw, FtMetadata, MemeInfo, PoolState } from "./types.js";

/** The one method we need from `JsonRpcProvider`, so tests can stub it. */
export interface ViewProvider {
  callFunction(args: {
    contractId: string;
    method: string;
    args: Record<string, unknown>;
  }): Promise<unknown>;
}

export class NoLossMemeClient {
  readonly config: NetworkConfig;
  private readonly provider: ViewProvider;

  constructor(network: NetworkId | NetworkConfig = "testnet", provider?: ViewProvider) {
    this.config = typeof network === "string" ? NETWORKS[network] : network;
    this.provider = provider ?? new JsonRpcProvider({ url: this.config.rpcUrl });
  }

  private async view<T>(
    contractId: string,
    method: string,
    args: Record<string, unknown> = {},
  ): Promise<T> {
    const result = await this.provider.callFunction({ contractId, method, args });
    if (result === undefined) throw new Error(`${contractId}.${method} returned nothing`);
    return result as T;
  }

  // ---- factory

  getMemes(fromIndex = 0, limit = 50): Promise<MemeInfo[]> {
    return this.view(this.config.factory, "get_memes", { from_index: fromIndex, limit });
  }

  getMeme(slug: string): Promise<MemeInfo | null> {
    return this.view(this.config.factory, "get_meme", { slug });
  }

  getMemeCount(): Promise<number> {
    return this.view(this.config.factory, "get_meme_count");
  }

  async getLaunchCost(): Promise<bigint> {
    return BigInt(await this.view<string>(this.config.factory, "get_launch_cost"));
  }

  getCodeHash(): Promise<string | null> {
    return this.view(this.config.factory, "get_code_hash");
  }

  // ---- pool

  getPoolState(pool: string): Promise<PoolState> {
    return this.view(pool, "get_state");
  }

  getAccount(pool: string, accountId: string): Promise<AccountView> {
    return this.view(pool, "get_account", { account_id: accountId });
  }

  getDraws(pool: string, fromIndex = 0, limit = 50): Promise<Draw[]> {
    return this.view(pool, "get_draws", { from_index: fromIndex, limit });
  }

  getDepositors(pool: string, fromIndex = 0, limit = 100): Promise<[string, AccountView][]> {
    return this.view(pool, "get_depositors", { from_index: fromIndex, limit });
  }

  getMetadata(pool: string): Promise<FtMetadata> {
    return this.view(pool, "ft_metadata");
  }

  async getMemeBalance(pool: string, accountId: string): Promise<bigint> {
    return BigInt(await this.view<string>(pool, "ft_balance_of", { account_id: accountId }));
  }

  // ---- staking pool

  async getStNearPrice(): Promise<bigint> {
    return BigInt(await this.view<string>(this.config.metaPool, "get_st_near_price"));
  }

  async getStNearBalance(accountId: string): Promise<bigint> {
    return BigInt(
      await this.view<string>(this.config.metaPool, "ft_balance_of", { account_id: accountId }),
    );
  }
}
