/** Follows the chain head from the cursor, with bounded concurrency and gap tolerance. */
import type { NoLossMemeClient } from "@nolossmeme/sdk";

import type { Store } from "../db/store.js";
import { log } from "../log.js";
import { BlockNotFound, RateLimited, type LakeBlock, type NearData } from "./neardata.js";
import { launchedPools, parseBlock, type Watch } from "./parse.js";
import type { TxApi } from "./txapi.js";

export interface ScannerOptions {
  startBlock: number;
  /** Parallel full-block fetches from the archive (rate limited separately). */
  concurrency: number;
  /** Read only our accounts' receipts from the transactions API instead of every block. */
  sparse?: boolean;
  /** Re-read the factory registry every N blocks (new pools may appear through the factory). */
  registryRefreshEvery?: number;
  /** Polling delay when caught up with the head. */
  idleMs?: number;
}

export class Scanner {
  private watch: Watch;
  private stopped = false;
  private lastRegistryRefresh = 0;
  private throttled = 0;

  constructor(
    private readonly data: NearData,
    private readonly store: Store,
    private readonly client: NoLossMemeClient,
    private readonly txApi: TxApi,
    factory: string,
    private readonly opts: ScannerOptions,
  ) {
    this.watch = { factory, pools: new Set() };
  }

  async refreshRegistry(): Promise<void> {
    const memes = await this.client.getAllMemes();
    for (const m of memes) {
      this.watch.pools.add(m.account_id);
      await this.store.upsertPool(m);
    }
    log.info("registry refreshed", { pools: this.watch.pools.size });
  }

  /** Store one block's events; a launch adds the new pool to the watch list. */
  private async storeBlock(block: LakeBlock): Promise<number> {
    const events = parseBlock(block, this.watch);
    for (const pool of launchedPools(events)) this.watch.pools.add(pool);
    const stored = await this.store.insertEvents(events);
    if (events.some((e) => e.kind === "launch")) await this.refreshRegistry();
    return stored;
  }

  /** Index a single block from the archive. Returns the number of events stored. */
  async indexBlock(height: number): Promise<number> {
    return this.storeBlock(await this.data.block(height));
  }

  /** Receipts touching `accounts` in [from, to], from the transactions API, with retries. */
  private async txBlocks(accounts: string[], from: number, to: number): Promise<LakeBlock[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.txApi.blocks(accounts, from, to);
      } catch (e) {
        await this.txApiBackoff(e, attempt, from);
      }
    }
  }

  /** Sparse: only the receipts that touched our accounts; the archive is never read. */
  private async indexSparse(from: number, to: number): Promise<number> {
    const before = new Set(this.watch.pools);
    let stored = 0;
    for (const b of await this.txBlocks([this.watch.factory, ...before], from, to))
      stored += await this.storeBlock(b);
    // A pool launched in this range may already have activity in it.
    const launched = [...this.watch.pools].filter((p) => !before.has(p));
    if (launched.length > 0)
      for (const b of await this.txBlocks(launched, from, to)) stored += await this.storeBlock(b);
    await this.store.setCursor(to);
    return stored;
  }

  /** Waits before the next try; rethrows once a non-throttle error has failed 20 times. */
  private async txApiBackoff(e: unknown, attempt: number, from: number): Promise<void> {
    if (e instanceof RateLimited) {
      this.throttled += 1;
      if (this.throttled % 25 === 1)
        log.warn("tx api rate limited", { from, count: this.throttled });
      return sleep(e.retryAfterMs);
    }
    if (attempt >= 20) throw e;
    if (attempt % 5 === 4)
      log.warn("tx api retry", { from, attempt, error: String(e).slice(0, 120) });
    return sleep(Math.min(10_000, 300 * 2 ** attempt));
  }

  /** Index [from, to] inclusive. Full mode reads every block from the archive with bounded
   *  concurrency and skips heights the chain never produced. */
  async indexRange(from: number, to: number): Promise<number> {
    if (this.opts.sparse) return this.indexSparse(from, to);
    let stored = 0;
    const candidates = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    for (let i = 0; i < candidates.length; i += this.opts.concurrency) {
      const heights = candidates.slice(i, i + this.opts.concurrency);
      const results = await Promise.all(
        heights.map(async (h) => {
          for (let attempt = 0; ; attempt++) {
            try {
              return await this.indexBlock(h);
            } catch (e) {
              if (e instanceof BlockNotFound) return 0;
              if (e instanceof RateLimited) {
                log.warn("rate limited", { height: h, waitMs: e.retryAfterMs });
                await sleep(e.retryAfterMs);
                continue; // never give up on a block because the archive throttled us
              }
              if (attempt >= 20) throw e;
              if (attempt % 5 === 4)
                log.warn("archive retry", { height: h, attempt, error: String(e).slice(0, 120) });
              await sleep(Math.min(15_000, 500 * 2 ** attempt));
            }
          }
        }),
      );
      stored += results.reduce((a, b) => a + b, 0);
      await this.store.setCursor(heights[heights.length - 1]!);
    }
    await this.store.setCursor(to);
    return stored;
  }

  async run(): Promise<void> {
    await this.refreshRegistry();
    let next = ((await this.store.getCursor()) ?? this.opts.startBlock - 1) + 1;
    log.info("scanner starting", { from: next });
    while (!this.stopped) {
      // The transactions API trails the chain by a few seconds; stay behind it.
      const head = (await this.headHeight()) - (this.opts.sparse ? HEAD_LAG_BLOCKS : 0);
      // Batch a few blocks so following the head costs a handful of calls per range.
      if (head - next < MIN_BATCH_BLOCKS) {
        await sleep(this.opts.idleMs ?? 3_000);
        continue;
      }
      const to = Math.min(head, next + 199);
      const stored = await this.indexRange(next, to);
      if (stored > 0 || to - next > 50)
        log.info("indexed", { from: next, to, behind: head - to, events: stored });
      next = to + 1;
      const every = this.opts.registryRefreshEvery ?? 1_000;
      if (to - this.lastRegistryRefresh >= every) {
        this.lastRegistryRefresh = to;
        await this.refreshRegistry().catch((e: unknown) =>
          log.warn("registry refresh failed", { error: String(e).slice(0, 120) }),
        );
      }
    }
  }

  /** Final head height; waits out archive throttling and transient errors instead of crashing. */
  private async headHeight(): Promise<number> {
    for (;;) {
      try {
        return await this.data.lastFinalHeight();
      } catch (e) {
        log.debug("head lookup failed", { error: String(e).slice(0, 120) });
        await sleep(e instanceof RateLimited ? e.retryAfterMs : 3_000);
      }
    }
  }

  stop(): void {
    this.stopped = true;
  }
}

/** ~20 s at testnet block times. */
const HEAD_LAG_BLOCKS = 30;
const MIN_BATCH_BLOCKS = 15;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
