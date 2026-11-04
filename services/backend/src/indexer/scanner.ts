/** Follows the chain head from the cursor, with bounded concurrency and gap tolerance. */
import type { NoLossMemeClient } from "@nolossmeme/sdk";

import type { Store } from "../db/store.js";
import { log } from "../log.js";
import { BlockNotFound, RateLimited, type NearData } from "./neardata.js";
import { UnknownBlock, type Rpc } from "./rpc.js";
import { launchedPools, parseBlock, type Watch } from "./parse.js";

export interface ScannerOptions {
  startBlock: number;
  /** Parallel full-block fetches from the archive (rate limited separately). */
  concurrency: number;
  /** Ask the RPC which accounts a block touched and fetch only blocks that touched ours. */
  sparse?: boolean;
  rpcConcurrency?: number;
  /** Re-read the factory registry every N blocks (new pools may appear through the factory). */
  registryRefreshEvery?: number;
  /** Polling delay when caught up with the head. */
  idleMs?: number;
}

export class Scanner {
  private watch: Watch;
  private stopped = false;
  private lastRegistryRefresh = 0;
  private rpcThrottled = 0;

  constructor(
    private readonly data: NearData,
    private readonly store: Store,
    private readonly client: NoLossMemeClient,
    private readonly rpc: Rpc,
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
  /** Heights in [from, to] whose block touched a watched account (or every height when not sparse). */
  async candidateHeights(from: number, to: number): Promise<number[]> {
    const all = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    if (!this.opts.sparse) return all;
    const out: number[] = [];
    const width = this.opts.rpcConcurrency ?? 8;
    for (let i = 0; i < all.length; i += width) {
      const slice = all.slice(i, i + width);
      const touched = await Promise.all(
        slice.map(async (h) => {
          for (let attempt = 0; ; attempt++) {
            try {
              const accounts = await this.rpc.touchedAccounts(h);
              return (
                accounts.has(this.watch.factory) ||
                [...accounts].some(
                  (a) => this.watch.pools.has(a) || a.endsWith(`.${this.watch.factory}`),
                )
              );
            } catch (e) {
              if (e instanceof UnknownBlock) return false;
              if (e instanceof RateLimited) {
                this.rpcThrottled += 1;
                if (this.rpcThrottled % 25 === 1)
                  log.warn("rpc rate limited", {
                    height: h,
                    count: this.rpcThrottled,
                    waitMs: e.retryAfterMs,
                  });
                await sleep(e.retryAfterMs + Math.random() * 500);
                continue;
              }
              if (attempt >= 5) throw e;
              await sleep(300 * 2 ** attempt);
            }
          }
        }),
      );
      slice.forEach((h, j) => touched[j] && out.push(h));
      if (i > 0 && i % 1_000 < width)
        log.info("prefilter progress", { height: slice[0], scanned: i, candidates: out.length });
    }
    return out;
  }

  async indexRange(from: number, to: number): Promise<number> {
    let stored = 0;
    const candidates = await this.candidateHeights(from, to);
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
              if (attempt >= 5) throw e;
              await sleep(500 * 2 ** attempt);
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
