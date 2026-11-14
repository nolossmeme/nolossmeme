/** Writes public/index.html, the HyperFrames composition of the demo, from the narration
 *  (src/script.ts + public/voice/*.json word timings), the screenshots and section boxes in
 *  public/shots, and the indexed draw #65. `pnpm render` turns it into docs/demo.mp4. */
import { readFileSync, writeFileSync } from "node:fs";

import { SCENES, type SceneId } from "../src/script.js";

const PUB = new URL("../public/", import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, PUB), "utf8")) as T;

interface Word {
  text: string;
  start: number;
  end: number;
}
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Draw {
  txHash: string;
  data: {
    epoch: number;
    checkins: number;
    winner: string;
    jackpot: string;
    checkin_reward_each: string;
    minted: string;
    community_streak: number;
  };
}

/** Pause after each line of narration, seconds. */
const GAP = 0.7;
const W = 1920;
const H = 1080;

const voices = Object.fromEntries(
  SCENES.map((s) => [s.id, read<{ duration: number; words: Word[] }>(`voice/${s.id}.json`)]),
) as Record<SceneId, { duration: number; words: Word[] }>;
const shots =
  read<Record<string, { width: number; height: number; boxes: Record<string, Box> }>>(
    "shots/boxes.json",
  );
const draw = read<Draw>("shots/draw.json");

const starts = {} as Record<SceneId, number>;
let total = 0;
for (const s of SCENES) {
  starts[s.id] = total;
  total += voices[s.id].duration + GAP;
}
const lenOf = (id: SceneId) => voices[id].duration + GAP;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Film time of the first word in `scene` that starts with `word` (case-insensitive). */
function cue(scene: SceneId, word: string, nth = 1): number {
  let seen = 0;
  for (const w of voices[scene].words) {
    if (w.text.toLowerCase().startsWith(word.toLowerCase()) && ++seen === nth)
      return r2(starts[scene] + w.start);
  }
  throw new Error(`no "${word}" #${nth} in ${scene}`);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tokens = (yocto18: string) => Number(BigInt(yocto18) / 10n ** 18n).toLocaleString("en-US");

// ---- timeline, collected while the markup is built
const tweens: string[] = [];
const at = (sel: string, t: number, vars: string, from?: string) =>
  tweens.push(
    from
      ? `tl.fromTo(${JSON.stringify(sel)}, ${from}, ${vars}, ${r2(t)});`
      : `tl.to(${JSON.stringify(sel)}, ${vars}, ${r2(t)});`,
  );
/** Fade and lift `sel` in at `t`. */
const pop = (sel: string, t: number) =>
  at(sel, t, `{ opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }`, `{ opacity: 0, y: 28 }`);
const out = (sel: string, t: number) => at(sel, t, `{ opacity: 0, duration: 0.3 }`);

/** Transform that frames `box` (screenshot pixels) in the stage above the captions. */
function frame(box: Box, pad = 40, max = 1.6) {
  const scale = Math.min((W - 220) / (box.w + 2 * pad), 820 / (box.h + 2 * pad), max);
  return {
    x: r2(W / 2 - (box.x + box.w / 2) * scale),
    y: r2(470 - (box.y + box.h / 2) * scale),
    scale: r2(scale),
  };
}
const top: Box = { x: 0, y: 0, w: W, h: 1000 };
/** Screenshot that moves between framings: [time, box, pad?] steps. */
function shot(id: string, name: string, steps: [number, Box, number?][]): string {
  steps.forEach(([t, box, pad], i) => {
    const f = frame(box, pad);
    const vars = `{ x: ${f.x}, y: ${f.y}, scale: ${f.scale}`;
    if (i === 0) at(`#${id} img`, t, `${vars}, duration: 0 }`);
    else at(`#${id} img`, t, `${vars}, duration: 1.1, ease: "power3.inOut" }`);
  });
  return `<div class="shot" id="${id}"><img src="shots/${name}.png" alt="" /></div>`;
}

function scene(id: SceneId, inner: string): string {
  const start = r2(starts[id]);
  at(`#${id}`, start, `{ opacity: 1, duration: 0.4 }`, `{ opacity: 0 }`);
  return `<section id="${id}" class="scene clip" data-start="${start}" data-duration="${r2(lenOf(id))}">${inner}</section>`;
}

const chip = (id: string, text: string, style: string, tone = "") =>
  `<div class="chip ${tone}" id="${id}" style="${style}">${text}</div>`;

// ---- scenes
const hook = (() => {
  pop("#h-a", cue("hook", "Most"));
  at("#h-chart .reveal", cue("hook", "buy"), `{ width: 1100, duration: 1.6, ease: "none" }`);
  pop("#h-loss", cue("hook", "gone"));
  out("#h-a", cue("hook", "NoLossMeme") - 0.3);
  out("#h-chart", cue("hook", "NoLossMeme") - 0.3);
  out("#h-loss", cue("hook", "NoLossMeme") - 0.3);
  at(
    "#h-brand",
    cue("hook", "NoLossMeme"),
    `{ opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.6)" }`,
    `{ opacity: 0, scale: 0.8 }`,
  );
  pop("#h-sub", cue("hook", "launchpad"));
  pop("#h-safe", cue("hook", "never"));
  return scene(
    "hook",
    `<h1 class="big" id="h-a" style="top:150px">Most memecoins end the same way.</h1>
    <div id="h-chart"><div class="reveal"><svg width="1100" height="420" viewBox="0 0 1100 420">
      <polyline fill="none" stroke="#ff6b6b" stroke-width="8" stroke-linejoin="round"
        points="0,380 120,340 220,300 330,250 420,170 500,90 560,40 600,60 640,260 700,370 820,395 1100,405" />
    </svg></div></div>
    <div class="loss" id="h-loss">−97%</div>
    <div id="h-brand"><img src="brand/nlm-white.png" alt="" /><span>NoLossMeme</span></div>
    <p class="sub" id="h-sub" style="top:620px">A memecoin launchpad on NEAR</p>
    <div class="pill lime" id="h-safe">Your deposit is never at risk</div>`,
  );
})();

const vault = (() => {
  const nodes: [string, string, string, string][] = [
    ["v-you", "You", "deposit NEAR", "deposit"],
    ["v-meta", "Meta Pool", "staked as stNEAR", "Meta"],
    ["v-tre", "Treasury", "staking yield + sponsors", "yield"],
    ["v-meme", "Meme tokens", "every one backed", "backs"],
  ];
  nodes.forEach(([id, , , word], i) => {
    pop(`#${id}`, cue("vault", word));
    if (i > 0) pop(`#${id}-arrow`, cue("vault", word) - 0.15);
  });
  pop("#v-back", cue("vault", "principal"));
  at("#v-tre", cue("vault", "treasury"), `{ scale: 1.08, duration: 0.25, yoyo: true, repeat: 1 }`);
  return scene(
    "vault",
    `<p class="kicker" style="top:150px">Where your NEAR goes</p>
    <div class="flow">${nodes
      .map(([id, title, sub], i) => {
        const arrow = i > 0 ? '<div class="arrow" id="' + id + '-arrow">→</div>' : "";
        const tone = id === "v-tre" ? " lime" : "";
        return `${arrow}<div class="node${tone}" id="${id}"><b>${title}</b><span>${sub}</span></div>`;
      })
      .join("")}</div>
    <div class="pill" id="v-back" style="top:700px">↩ Principal stays yours · withdraw any time</div>`,
  );
})();

const streak = (() => {
  pop("#s-card", cue("streak", "Depositors"));
  at("#s-fill", cue("streak", "check"), `{ width: 330, duration: 0.5 }`);
  at("#s-n", cue("streak", "check"), `{ opacity: 1, duration: 0 }`);
  at("#s-fill", cue("streak", "target"), `{ width: 660, duration: 0.5 }`);
  at("#s-n2", cue("streak", "target"), `{ opacity: 1, duration: 0 }`);
  pop("#s-hit", cue("streak", "target"));
  pop("#s-jack", cue("streak", "seventy"));
  pop("#s-comm", cue("streak", "rest"));
  at("#s-ok", cue("streak", "Miss"), `{ opacity: 0.25, duration: 0.3 }`);
  pop("#s-miss", cue("streak", "Miss"));
  pop("#s-burn", cue("streak", "burned"));
  return scene(
    "streak",
    `<p class="kicker" style="top:110px">Streak rules · one epoch</p>
    <div class="card" id="s-card" style="left:180px;top:220px;width:760px">
      <p class="label">Community check-ins this epoch</p>
      <div class="count"><span id="s-n0">0</span><span id="s-n">1</span><span id="s-n2">2</span> / 2</div>
      <div class="bar"><div id="s-fill"></div></div>
      <div class="pill lime small" id="s-hit">Target hit</div>
    </div>
    <div id="s-ok">
      <div class="card" id="s-jack" style="left:1010px;top:220px;width:730px">
        <p class="label">70% jackpot</p><b class="num lime">1 raffle winner</b>
        <span class="muted">tickets weighted by streak</span>
      </div>
      <div class="card" id="s-comm" style="left:1010px;top:470px;width:730px">
        <p class="label">30% community</p><b class="num">split among check-ins</b>
        <span class="muted">everyone who showed up</span>
      </div>
    </div>
    <div class="card red" id="s-miss" style="left:180px;top:640px;width:760px">
      <p class="label">Target missed</p><b class="num">community share burns</b>
      <span class="pill red small" id="s-burn">🔥 streak resets to 0</span>
    </div>`,
  );
})();

const live = (() => {
  const home = shots.home!.boxes;
  const dogn = shots.dogn!.boxes;
  const t0 = starts.live;
  const html = [
    shot("l-home", "home", [
      [t0, top],
      [cue("live", "DOGN") + 0.2, { x: 288, y: home.pools!.y, w: 1344, h: home.pools!.h }, 40],
    ]),
    shot("l-faucet", "faucet", [
      [t0, { x: 556, y: 120, w: 808, h: 560 }],
      [cue("live", "faucet") - 0.6, { x: 556, y: 340, w: 808, h: 320 }, 30],
    ]),
    shot("l-dogn", "dogn", [
      [t0, top],
      [cue("live", "deposits"), dogn.position!, 40],
      [cue("live", "Two"), dogn.community!, 40],
      [cue("live", "picked"), { ...dogn.activity!, h: 720 }, 30],
    ]),
  ].join("");
  at("#l-faucet", cue("live", "grabs"), `{ opacity: 1, duration: 0.35 }`, `{ opacity: 0 }`);
  at("#l-dogn", cue("live", "deposits") - 0.4, `{ opacity: 1, duration: 0.35 }`, `{ opacity: 0 }`);
  pop("#l-c1", cue("live", "testnet"));
  out("#l-c1", cue("live", "grabs"));
  pop("#l-c2", cue("live", "grabs") + 0.4);
  out("#l-c2", cue("live", "deposits") - 0.4);
  pop("#l-c3", cue("live", "deposits") + 0.5);
  out("#l-c3", cue("live", "Two"));
  pop("#l-c4", cue("live", "target"));
  out("#l-c4", cue("live", "picked"));
  pop("#l-c5", cue("live", "indexer"));
  return scene(
    "live",
    `${html}
    ${chip("l-c1", "3 live pools · DOGN, PEPN, SHBN", "left:120px;top:850px")}
    ${chip("l-c2", "Turnstile-gated faucet · 1 NEAR / day", "left:120px;top:850px")}
    ${chip("l-c3", "deposit 1 NEAR · daily check-in", "left:120px;top:850px")}
    ${chip("l-c4", "2 / 2 check-ins · target hit", "left:120px;top:850px", "lime")}
    ${chip("l-c5", "indexed in seconds", "left:120px;top:850px")}`,
  );
})();

const drawScene = (() => {
  const d = draw.data;
  const rows: [string, string, string, string][] = [
    ["d-r1", "Target", `hit · ${d.checkins} / 2 check-ins`, "Target"],
    ["d-r2", "Minted", `${tokens(d.minted)} DOGN`, "thousand"],
    ["d-r3", "Jackpot", `${tokens(d.jackpot)} DOGN → ${d.winner}`, "jackpot"],
    ["d-r4", "Check-ins", `${d.checkins} × ${tokens(d.checkin_reward_each)} DOGN`, "both"],
    ["d-r5", "Transaction", `${draw.txHash.slice(0, 22)}…`, "verifiable"],
  ];
  pop("#d-card", cue("draw", "keeper"));
  for (const [id, , , word] of rows) pop(`#${id}`, cue("draw", word));
  at("#d-no", cue("draw", "sixty"), `{ scale: 1.15, duration: 0.25, yoyo: true, repeat: 1 }`);
  return scene(
    "draw",
    `<div class="card wide" id="d-card">
      <div class="head"><img src="logos/dogn.png" alt="" /><b>Draw <span id="d-no">#${d.epoch}</span></b>
        <span class="pill lime small">target hit</span><span class="muted">dogn.streak.nolossmeme.testnet</span></div>
      ${rows
        .map(
          ([id, k, v]) =>
            `<div class="row" id="${id}"><span class="muted">${k}</span><b>${esc(v)}</b></div>`,
        )
        .join("")}
      <p class="muted foot">community streak → ${d.community_streak} · keeper.nolossmeme.testnet triggered it</p>
    </div>`,
  );
})();

const floor = (() => {
  const stats: Box = { x: 288, y: 255, w: 1344, h: 190 };
  const html = shot("f-dogn", "dogn", [
    [starts.floor, top],
    [cue("floor", "every"), stats, 30],
  ]);
  pop("#f-c1", cue("floor", "floor"));
  pop("#f-c2", cue("floor", "Redeem"));
  pop("#f-c3", cue("floor", "withdraw"));
  return scene(
    "floor",
    `${html}
    ${chip("f-c1", "floor = treasury ÷ supply · never zero", "left:120px;top:740px", "lime")}
    ${chip("f-c2", "redeem tokens → stNEAR", "left:120px;top:820px")}
    ${chip("f-c3", "withdraw your deposit any time", "left:760px;top:820px")}`,
  );
})();

const outro = (() => {
  const html = shot("o-launch", "launch", [
    [starts.outro, top],
    [cue("outro", "launch") + 0.3, { x: 556, y: 130, w: 808, h: 640 }, 30],
  ]);
  pop("#o-c1", cue("outro", "factory"));
  at("#o-end", cue("outro", "NoLossMeme") - 0.2, `{ opacity: 1, duration: 0.5 }`, `{ opacity: 0 }`);
  pop("#o-tag", cue("outro", "memecoins"));
  pop("#o-url", cue("outro", "Try"));
  return scene(
    "outro",
    `${html}
    ${chip("o-c1", "picture, name, ticker → one transaction", "left:120px;top:850px", "lime")}
    <div id="o-end">
      <div class="brand"><img src="brand/nlm-white.png" alt="" /><span>NoLossMeme</span></div>
      <p class="sub" id="o-tag" style="top:600px">Memecoins you can't lose on.</p>
      <div id="o-url"><b>app.nolossmeme.fun</b><span>nolossmeme.fun/demo · github.com/nolossmeme/nolossmeme</span></div>
    </div>`,
  );
})();

// ---- narration and captions
const audio = SCENES.map(
  (s) =>
    `<audio id="vo-${s.id}" src="voice/${s.id}.mp3" data-start="${r2(starts[s.id])}" data-duration="${r2(
      voices[s.id].duration,
    )}"></audio>`,
).join("\n");

const captions: string[] = [];
for (const s of SCENES) {
  let chunk: Word[] = [];
  /** Start of the word after the chunk, so a caption never runs into the next one. */
  let next: number | undefined;
  const flush = () => {
    if (!chunk.length) return;
    const t = r2(starts[s.id] + chunk[0]!.start);
    const end = r2(starts[s.id] + Math.min(chunk.at(-1)!.end + 0.15, next ?? Infinity));
    captions.push(
      `<div class="cap clip" id="cap-${captions.length}" data-start="${t}" data-duration="${r2(end - t)}">${esc(
        chunk.map((w) => w.text).join(" "),
      )}</div>`,
    );
    chunk = [];
  };
  const words = voices[s.id].words;
  for (const [i, w] of words.entries()) {
    chunk.push(w);
    next = words[i + 1]?.start;
    if (/[.,:;!?]$/.test(w.text) || chunk.length >= 7) flush();
  }
  flush();
}

const DUR = r2(total);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
:root { --bg:#050507; --surface:#0c0c12; --border:#1f1f2a; --text:#f5f5f8; --muted:#9a9aae;
  --lime:#a3ff5b; --red:#ff6b6b; --sans:"Inter",sans-serif; --mono:"JetBrains Mono",monospace; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${W}px; height:${H}px; overflow:hidden; background:var(--bg); color:var(--text); font-family:var(--sans); }
#root { position:relative; width:100%; height:100%; overflow:hidden;
  background: radial-gradient(1200px 600px at 50% -10%, rgba(163,255,91,.10), transparent 60%), var(--bg); }
.scene { position:absolute; inset:0; overflow:hidden; }
.shot { position:absolute; inset:0; overflow:hidden; background:var(--bg); }
.shot img { position:absolute; left:0; top:0; width:${W}px; transform-origin:0 0; }
.big { position:absolute; left:0; right:0; text-align:center; font-size:84px; font-weight:500; letter-spacing:-.03em; }
.sub { position:absolute; left:0; right:0; text-align:center; font-size:44px; color:var(--muted); font-weight:300; }
.kicker { position:absolute; left:0; right:0; text-align:center; font-family:var(--mono); font-size:26px;
  letter-spacing:.2em; text-transform:uppercase; color:var(--lime); }
#h-chart { position:absolute; left:410px; top:330px; width:1100px; height:420px; }
#h-chart .reveal { width:0; height:420px; overflow:hidden; }
.loss { position:absolute; left:1150px; top:470px; font-family:var(--mono); font-size:88px; color:var(--red); font-weight:600; }
#h-brand, .brand { position:absolute; left:0; right:0; top:330px; display:flex; justify-content:center; align-items:center; gap:36px; }
#h-brand img, .brand img { height:180px; }
#h-brand span, .brand span { font-size:150px; font-weight:600; letter-spacing:-.04em; }
.pill { position:absolute; left:0; right:0; margin:0 auto; width:fit-content; padding:18px 40px; border-radius:999px;
  border:1px solid var(--border); background:var(--surface); font-size:36px; white-space:nowrap; }
#h-safe { top:760px; }
.pill.lime { color:#050507; background:var(--lime); border-color:var(--lime); font-weight:600; }
.pill.red { color:var(--red); border-color:rgba(255,107,107,.5); }
.pill.small { position:static; margin:22px 0 0; display:inline-block; width:auto; font-size:24px; padding:8px 22px; }
.flow { position:absolute; left:0; right:0; top:330px; display:flex; justify-content:center; align-items:center; gap:26px; }
.node { width:330px; padding:40px 30px; border-radius:28px; background:var(--surface); border:1px solid var(--border); text-align:center; }
.node b { display:block; font-size:40px; font-weight:600; }
.node span { display:block; margin-top:10px; font-size:24px; color:var(--muted); }
.node.lime { border-color:var(--lime); box-shadow:0 0 60px rgba(163,255,91,.18); }
.arrow { font-size:56px; color:var(--lime); }
#v-back { top:640px; font-size:32px; }
.card { position:absolute; padding:36px 44px; border-radius:28px; background:var(--surface); border:1px solid var(--border); }
.card.red { border-color:rgba(255,107,107,.45); }
.card .label { font-family:var(--mono); font-size:22px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
.card .num { display:block; margin-top:14px; font-size:44px; font-weight:600; }
.card .muted, .muted { color:var(--muted); font-size:26px; }
.lime { color:var(--lime); }
.count { position:relative; margin-top:14px; font-family:var(--mono); font-size:96px; }
#s-n, #s-n2 { position:absolute; left:0; opacity:0; background:var(--surface); }
.bar { margin-top:20px; width:660px; height:16px; border-radius:99px; background:#1a1a24; overflow:hidden; }
#s-fill { width:0; height:100%; background:var(--lime); }
.card.wide { left:260px; top:130px; width:1400px; }
.card .head { display:flex; align-items:center; gap:22px; margin-bottom:22px; }
.card .head img { width:72px; height:72px; border-radius:50%; }
.card .head b { font-size:52px; font-weight:600; }
.card .head .pill.small { margin-top:0; }
#d-no { display:inline-block; }
.row { display:flex; justify-content:space-between; padding:20px 0; border-top:1px solid var(--border); font-size:34px; }
.row b { font-family:var(--mono); font-weight:600; }
.foot { margin-top:18px; font-size:24px; }
.chip { position:absolute; padding:14px 28px; border-radius:16px; background:rgba(12,12,18,.92);
  border:1px solid var(--border); font-size:32px; font-weight:500; box-shadow:0 20px 50px rgba(0,0,0,.5); }
.chip.lime { border-color:var(--lime); color:var(--lime); }
#o-end { position:absolute; inset:0; background:var(--bg); }
#o-url { position:absolute; left:0; right:0; top:740px; text-align:center; }
#o-url b { display:block; font-family:var(--mono); font-size:56px; color:var(--lime); }
#o-url span { display:block; margin-top:18px; font-size:28px; color:var(--muted); }
.cap { position:absolute; left:0; right:0; bottom:48px; margin:0 auto; width:fit-content; max-width:1600px; padding:10px 26px; border-radius:14px; background:rgba(5,5,7,.78); text-align:center; font-size:40px; font-weight:500;
  line-height:1.25; text-shadow:0 2px 12px #000, 0 0 2px #000; z-index:10; }
#logo { position:absolute; left:56px; top:44px; display:flex; align-items:center; gap:14px; font-size:28px; font-weight:600; z-index:10; }
#logo img { height:40px; }
#prog { position:absolute; left:0; bottom:0; height:6px; width:0; background:var(--lime); z-index:10; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">
<div id="logo" class="clip" data-start="${r2(starts.vault)}" data-duration="${r2(starts.live - starts.vault)}"><img src="brand/nlm-white.png" alt="" />NoLossMeme</div>
${[hook, vault, streak, live, drawScene, floor, outro].join("\n")}
${captions.join("\n")}
<div id="prog" class="clip" data-start="0" data-duration="${DUR}"></div>
${audio}
</div>
<script>
const tl = gsap.timeline({ paused: true });
tl.to("#prog", { width: ${W}, duration: ${DUR}, ease: "none" }, 0);
${tweens.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
writeFileSync(new URL("index.html", PUB), html);
console.log(`public/index.html: ${DUR}s, ${captions.length} captions, ${tweens.length} tweens`);
