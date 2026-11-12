/** Full-page screenshots of the live app plus the box of each section we zoom into.
 *  Writes public/shots/<name>.png, public/shots/boxes.json and the latest DOGN draw as draw.json. */
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium, type Page } from "playwright";

const OUT = new URL("../public/shots/", import.meta.url);
const SCALE = 1.2;
const APP = "https://app.nolossmeme.fun";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Boxes = Record<string, { width: number; height: number; boxes: Record<string, Box> }>;

/** Box (in screenshot pixels) of the card that holds `text`. */
async function cardBox(p: Page, text: string): Promise<Box> {
  const el = p.getByText(text, { exact: false }).first();
  const card = el.locator("xpath=ancestor-or-self::*[contains(@class,'card')][1]");
  const b = (await card.count()) > 0 ? await card.boundingBox() : await el.boundingBox();
  if (!b) throw new Error(`no box for ${text}`);
  return { x: b.x * SCALE, y: b.y * SCALE, w: b.width * SCALE, h: b.height * SCALE };
}

const PAGES: { name: string; url: string; wait: number; sections: Record<string, string> }[] = [
  { name: "landing", url: "https://nolossmeme.fun/", wait: 4000, sections: {} },
  {
    name: "home",
    url: `${APP}/`,
    wait: 6000,
    sections: { pools: "Doge of NEAR", activity: "Recent activity" },
  },
  {
    name: "dogn",
    url: `${APP}/m/dogn`,
    wait: 9000,
    sections: {
      community: "Community check-ins this epoch",
      position: "Your position",
      faucet: "Need testnet NEAR?",
      activity: "Pool activity",
      drawlog: "Draw log",
      rules: "Rules (on-chain",
    },
  },
  { name: "launch", url: `${APP}/launch`, wait: 4000, sections: {} },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 900 },
  deviceScaleFactor: SCALE,
  colorScheme: "dark",
});
const page = await ctx.newPage();
const out: Boxes = {};
for (const pg of PAGES) {
  await page.goto(pg.url, { waitUntil: "load" });
  await page.waitForTimeout(pg.wait);
  const path = new URL(`${pg.name}.png`, OUT);
  await page.screenshot({ path: path.pathname, fullPage: true });
  const size = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.scrollHeight,
  ]);
  const boxes: Record<string, Box> = {};
  for (const [k, text] of Object.entries(pg.sections)) boxes[k] = await cardBox(page, text);
  out[pg.name] = { width: (size[0] ?? 0) * SCALE, height: (size[1] ?? 0) * SCALE, boxes };
  console.log(pg.name, Object.keys(boxes).join(","));
}
writeFileSync(new URL("boxes.json", OUT), JSON.stringify(out, null, 2));
// NEAR Blocks sits behind a bot challenge, so the video shows the indexed draw instead.
const draws = (await (
  await fetch("https://api.nolossmeme.fun/pools/dogn.streak.nolossmeme.testnet/draws?limit=1")
).json()) as unknown[];
writeFileSync(new URL("draw.json", OUT), JSON.stringify(draws[0] ?? null, null, 2));
await browser.close();
