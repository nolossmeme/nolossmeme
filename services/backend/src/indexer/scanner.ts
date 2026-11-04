/** Follows the chain head from the cursor, with bounded concurrency and gap tolerance. */
import type { NoLossMemeClient } from "@nolossmeme/sdk";

import type { Store } from "../db/store.js";
import { log } from "../log.js";
import { BlockNotFound, RateLimited, type NearData } from "./neardata.js";
import { launchedPools, parseBlock, type Watch } from "./parse.js";

export interface ScannerOptions {
  startBlock: number;
  concurrency: number;
  /** Re-read the factory registry every N blocks (new pools may appear through the factory). */
  registryRefreshEvery?: number;
  /** Polling delay when caught up with the head. */
  idleMs?: number;
}

export class Scanner {
  private watch: Watch;
  private stopped = false;
  private lastRegistryRefresh = 0;

  constructor(
    private readonly data: NearData,
    private readonly store: Store,
    private readonly client: NoLossMemeClient,
    factory: string,
    private readonly opts: ScannerOptions,
  ) {
    this.watch = { factory, pools: new Set() };
  }

  async refreshRegistry(): Promise<void> {
    const memes = await this.client.getMemes(0, 200);
    for (const m of memes) {
      this.watch.pools.add(m.account_id);
      await this.store.upsertPool(m);
    }
    log.info("registry refreshed", { pools: this.watch.pools.size });
  }

  /** Index a single block. Returns the number of events stored. */
  async indexBlock(height: number): Promise<number> {
    const block = await this.data.block(height);
    const events = parseBlock(block, this.watch);
    for (const pool of launchedPools(events)) this.watch.pools.add(pool);
    const stored = await this.store.insertEvents(events);
    if (events.some((e) => e.kind === "launch")) await this.refreshRegistry();
    return stored;
  }

  /** Index [from, to] inclusive with bounded concurrency; skips heights the chain never produced. */
  async indexRange(from: number, to: number): Promise<number> {
    let stored = 0;
    for (let start = from; start <= to; start += this.opts.concurrency) {
      const heights = Array.from(
        { length: Math.min(this.opts.concurrency, to - start + 1) },
        (_, i) => start + i,
      );
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
              if (attempt >= 5) throw e;
              await sleep(500 * 2 ** attempt);
            }
          }
        }),
      );
      stored += results.reduce((a, b) => a + b, 0);
      await this.store.setCursor(heights[heights.length - 1]!);
    }
    return stored;
  }

  async run(): Promise<void> {
    await this.refreshRegistry();
    let next = ((await this.store.getCursor()) ?? this.opts.startBlock - 1) + 1;
    log.info("scanner starting", { from: next });
    while (!this.stopped) {
      const head = await this.data.lastFinalHeight();
      if (next > head) {
        await sleep(this.opts.idleMs ?? 1_500);
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
        await this.refreshRegistry();
      }
    }
  }

  stop(): void {
    this.stopped = true;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
