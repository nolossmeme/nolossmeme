/** Writes public/index.html, the HyperFrames composition of the demo: one idea per scene on a
 *  white stage, the headline built word by word in sync with the ElevenLabs narration
 *  (src/script.ts + public/voice/*.json), UI that types and clicks itself, and one real
 *  screenshot of the live pool (public/shots). `pnpm render` turns it into docs/demo.mp4. */
import { readFileSync, writeFileSync } from "node:fs";

import { SCENES, type SceneId } from "../src/script.js";

const PUB = new URL("../public/", import.meta.url);
const read = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, PUB), "utf8")) as T;

interface Word {
  text: string;
  start: number;
  end: number;
}

const W = 1920;
const H = 1080;
const r2 = (n: number) => Math.round(n * 100) / 100;

const voices = Object.fromEntries(
  SCENES.map((s) => [s.id, read<{ duration: number; words: Word[] }>(`voice/${s.id}.json`)]),
) as Record<SceneId, { duration: number; words: Word[] }>;
const drawlogY =
  read<Record<string, { boxes: Record<string, { y: number }> }>>("shots/boxes.json").dogn!.boxes
    .drawlog!.y;

/** Scene start, when its narration starts, and its length. */
const start = {} as Record<SceneId, number>;
const voiceAt = {} as Record<SceneId, number>;
const len = {} as Record<SceneId, number>;
let total = 0;
for (const s of SCENES) {
  start[s.id] = r2(total);
  voiceAt[s.id] = r2(total + s.lead);
  len[s.id] = r2(s.lead + voices[s.id].duration + s.tail);
  total += len[s.id];
}

/** Film time of the nth word in `scene`'s narration that starts with `word`. */
function cue(scene: SceneId, word: string, nth = 1): number {
  let seen = 0;
  for (const w of voices[scene].words)
    if (w.text.toLowerCase().startsWith(word.toLowerCase()) && ++seen === nth)
      return r2(voiceAt[scene] + w.start);
  throw new Error(`no "${word}" #${nth} in ${scene}`);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- timeline, collected while the markup is built
const tweens: string[] = [];
/** Effects from the HyperFrames bundled library (public/sfx): peak offset, volume, length (s). */
const SFX = {
  click: [0.073, 0.6, 0.36],
  typing: [0, 0.45, 1.5],
  pop: [0.12, 0.5, 0.72],
  "impact-bass-1": [0.073, 0.3, 2.11],
  chime: [0.418, 0.45, 2.5],
  "whoosh-short": [0.162, 0.35, 0.57],
} as const;
const sounds: { name: keyof typeof SFX; at: number; dur?: number }[] = [];
/** Plays `name` so its peak lands one frame after the picture at `t`. */
const sfx = (name: keyof typeof SFX, t: number, dur?: number) =>
  sounds.push({ name, at: r2(Math.max(0, t - SFX[name][0] + 1 / 30)), dur });
const q = (sel: string) => JSON.stringify(sel);
const to = (sel: string, t: number, vars: string) =>
  tweens.push(`tl.to(${q(sel)}, ${vars}, ${r2(t)});`);
const fromTo = (sel: string, t: number, from: string, vars: string) =>
  tweens.push(`tl.fromTo(${q(sel)}, ${from}, ${vars}, ${r2(t)});`);
/** Fade and lift in; `sound` adds a pop. */
const pop = (sel: string, t: number, sound = false) => {
  fromTo(
    sel,
    t,
    `{ opacity: 0, y: 24 }`,
    `{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }`,
  );
  if (sound) sfx("pop", t + 0.1);
};
/** Scale in from a little smaller. */
const grow = (sel: string, t: number) =>
  fromTo(
    sel,
    t,
    `{ opacity: 0, scale: 0.92 }`,
    `{ opacity: 1, scale: 1, duration: 0.6, ease: "power3.out" }`,
  );
/** Button press with a click sound. */
function press(sel: string, t: number) {
  to(sel, t, `{ scale: 0.92, duration: 0.09, yoyo: true, repeat: 1, ease: "power1.inOut" }`);
  sfx("click", t);
}
/** Text that types itself: one span per character, shown `cps` characters a second. */
const typed = (id: string, text: string) => {
  const chars = [...text].map((c) => '<span class="ch">' + esc(c) + "</span>").join("");
  return `<span id="${id}">${chars}</span>`;
};
const type = (id: string, t: number, cps: number) =>
  to(`#${id} .ch`, t, `{ opacity: 1, duration: 0, stagger: ${r2(1 / cps)} }`);
/** Types `text`'s characters with a key burst as long as the typing. */
const typeWithKeys = (id: string, text: string, t: number, cps = 22) => {
  type(id, t, cps);
  sfx("typing", t, Math.min(1.5, r2(text.length / cps + 0.1)));
};

/** The scene's narration (words [from, until)) as a headline that builds with the voice. */
function headline(scene: SceneId, style = "", from = 0, until = Infinity): string {
  const spans = voices[scene].words
    .map((w, i) => {
      if (i < from || i >= until) return "";
      fromTo(
        `#hl-${scene}-${i}`,
        voiceAt[scene] + w.start - 0.05,
        `{ opacity: 0, y: 14 }`,
        `{ opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }`,
      );
      return `<span class="w" id="hl-${scene}-${i}">${esc(w.text)}</span>`;
    })
    .filter(Boolean)
    .join(" ");
  return `<h1 class="hl" id="hl-${scene}-${from}w" style="${style}">${spans}</h1>`;
}

function scene(id: SceneId, inner: string): string {
  // The first frame is the thumbnail, so the opening scene is on screen at 0 s.
  if (start[id] > 0) fromTo(`#${id}`, start[id], `{ opacity: 0 }`, `{ opacity: 1, duration: 0.3 }`);
  return `<section id="${id}" class="scene clip" data-start="${start[id]}" data-duration="${len[id]}">${inner}</section>`;
}

// ---- scenes
const hook = (() => {
  const t = start.hook;
  typeWithKeys("hk-q", "Buy $MEME at the top", t + 0.2);
  press("#hk-send", t + 2.0);
  to("#hk-bar", t + 2.2, `{ opacity: 0, y: -40, duration: 0.35 }`);
  grow("#hk-chart", t + 2.3);
  sfx("whoosh-short", t + 2.3);
  to("#hk-line", t + 2.45, `{ width: 980, duration: 1.4, ease: "none" }`);
  pop("#hk-loss", cue("hook", "zero") - 0.2, true);
  to("#hk-chart", voiceAt.hook - 0.1, `{ y: 90, duration: 0.5, ease: "power2.inOut" }`);
  return scene(
    "hook",
    `<div class="bar" id="hk-bar"><div class="plus">+</div><div class="field">${typed(
      "hk-q",
      "Buy $MEME at the top",
    )}<div class="send" id="hk-send">↑</div></div></div>
    <div class="card" id="hk-chart" style="left:410px;top:300px;width:1100px;height:520px">
      <div class="row-head"><b>$MEME</b><span class="muted">price</span><span class="loss" id="hk-loss">−97%</span></div>
      <div id="hk-line"><svg width="980" height="360" viewBox="0 0 980 360">
        <polyline fill="none" stroke="#e5484d" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"
          points="0,320 110,290 200,250 300,200 380,120 450,50 500,25 540,60 580,230 640,320 760,340 980,345" />
      </svg></div>
    </div>
    ${headline("hook", "top:150px")}`,
  );
})();

const flip = (() => {
  const meet = cue("flip", "Meet");
  to("#hl-flip-0w", meet - 0.3, `{ y: -250, scale: 0.8, duration: 0.45, ease: "power3.inOut" }`);
  grow("#fl-brand", meet);
  sfx("impact-bass-1", meet);
  return scene(
    "flip",
    `${headline("flip", "top:470px", 0, 5)}
    <div class="brand" id="fl-brand" style="top:440px"><img src="brand/nlm-black.png" alt="" /><span>NoLossMeme</span></div>`,
  );
})();

const deposit = (() => {
  const t = start.deposit;
  grow("#dp-card", t + 0.1);
  typeWithKeys("dp-amt", "1.00", t + 0.5, 8);
  press("#dp-btn", cue("deposit", "Deposit") + 0.1);
  pop("#dp-ok", cue("deposit", "stays"), true);
  pop("#dp-wd", cue("deposit", "Withdraw"), true);
  return scene(
    "deposit",
    `${headline("deposit", "top:180px;font-size:64px;max-width:1800px")}
    <div class="card" id="dp-card" style="left:510px;top:400px;width:900px;padding:34px 40px">
      <p class="label">Deposit</p>
      <div class="inrow"><img src="brand/near.png" alt="" class="tok" /><b class="amt">${typed("dp-amt", "1.00")}</b>
        <span class="muted unit">NEAR</span><div class="btn" id="dp-btn">Deposit</div></div>
    </div>
    <div class="pill ok side" id="dp-ok" style="top:690px;left:510px">✓ 1 NEAR · still yours</div>
    <div class="pill side" id="dp-wd" style="top:690px;left:960px">↩ Withdraw any time</div>`,
  );
})();

const yieldScene = (() => {
  const t = start.yield;
  grow("#yd-near", t + 0.15);
  const y = cue("yield", "yield");
  for (let i = 0; i < 3; i++) {
    const at = y + i * 0.45;
    fromTo(
      `#yd-d${i}`,
      at,
      `{ opacity: 0, x: 0 }`,
      `{ opacity: 1, x: 190, duration: 0.9, ease: "power1.inOut" }`,
    );
    to(`#yd-d${i}`, at + 1.0, `{ opacity: 0, duration: 0.2 }`);
  }
  grow("#yd-memes", cue("yield", "meme"));
  return scene(
    "yield",
    `${headline("yield", "top:170px")}
    <div class="card center" id="yd-near" style="left:330px;top:420px;width:420px">
      <img src="brand/near.png" alt="" class="tok big" /><b>1 NEAR</b><span class="muted">staked · yours</span></div>
    ${[0, 1, 2].map((i) => `<div class="drop" id="yd-d${i}" data-layout-allow-overlap data-layout-allow-occlusion>+ yield</div>`).join("")}
    <div class="card center" id="yd-memes" style="left:1170px;top:420px;width:420px">
      <div class="stack"><img src="logos/dogn.png" alt="" /><img src="logos/pepn.png" alt="" /><img src="logos/shbn.png" alt="" /></div>
      <b>meme tokens</b><span class="muted">minted from yield</span></div>`,
  );
})();

/** Community card: three accounts that light up as they check in. */
function community(prefix: string, lit: number[], note: string): string {
  const people = ["A", "B", "C"]
    .map((p, i) => {
      const on = lit.includes(i) ? " on" : "";
      return `<div class="who" id="${prefix}-a${i}"><div class="av${on}">${p}</div><div class="reward" id="${prefix}-r${i}">+150 DOGN</div></div>`;
    })
    .join("");
  const digits = [0, 1, 2, 3]
    .map(
      (n) =>
        `<span id="${prefix}-n${n}" data-layout-allow-overlap data-layout-allow-occlusion>${n}</span>`,
    )
    .join("");
  return `<div class="card" id="${prefix}-card" style="left:460px;top:360px;width:1000px;padding:40px 48px">
    <div class="row-head"><span class="label">Community check-ins · today</span><span class="pill small" id="${prefix}-pill">${note}</span></div>
    <div class="count" data-layout-allow-overlap data-layout-allow-occlusion>${digits} / 3</div>
    <div class="track"><div class="fill" id="${prefix}-fill"></div></div>
    <div class="people">${people}</div>
  </div>`;
}

const checkin = (() => {
  const t = start.checkin;
  grow("#ci-card", t + 0.1);
  const steps = [cue("checkin", "Check") + 0.1, cue("checkin", "Hit"), cue("checkin", "community")];
  steps.forEach((at, i) => {
    press(`#ci-a${i} .av`, at);
    to(`#ci-a${i} .av`, at, `{ backgroundColor: "#0d0d0d", color: "#ffffff", duration: 0.2 }`);
    to(`#ci-n${i + 1}`, at, `{ opacity: 1, duration: 0 }`);
    to("#ci-fill", at, `{ width: ${(i + 1) * 300}, duration: 0.25, ease: "power2.out" }`);
  });
  to("#ci-pill", cue("checkin", "target"), `{ opacity: 1, duration: 0.3 }`);
  sfx("chime", cue("checkin", "target"));
  [0, 1, 2].forEach((i) => pop(`#ci-r${i}`, cue("checkin", "everyone") + i * 0.15));
  pop("#ci-jack", cue("checkin", "paid"), true);
  return scene(
    "checkin",
    `${headline("checkin", "top:110px;font-size:64px;max-width:1500px")}
    ${community("ci", [], "✓ Target hit")}
    <div class="pill dark" id="ci-jack" style="top:850px">🏆 plus a 700 DOGN jackpot for one raffle winner</div>`,
  );
})();

const miss = (() => {
  const t = start.miss;
  fromTo("#ms-card", t, `{ opacity: 0 }`, `{ opacity: 1, duration: 0.3 }`);
  to("#ms-pill", cue("miss", "Miss"), `{ opacity: 1, duration: 0.3 }`);
  [0, 1, 2].forEach((i) => to(`#ms-r${i}`, cue("miss", "burns"), `{ opacity: 1, duration: 0.25 }`));
  pop("#ms-burn", cue("miss", "burns"), true);
  return scene(
    "miss",
    `${headline("miss", "top:150px")}
    ${community("ms", [0], "Target missed")}
    <div class="pill red" id="ms-burn" style="top:850px">🔥 community share burned · streak resets</div>`,
  );
})();

const live = (() => {
  const t = start.live;
  grow("#lv-win", t + 0.1);
  sfx("whoosh-short", t + 0.1);
  to(
    "#lv-shot",
    cue("live", "Every") - 0.2,
    `{ y: ${r2(-(drawlogY - 120) * (1280 / 1920))}, duration: 1.4, ease: "power3.inOut" }`,
  );
  const names = ["dogn", "pepn", "shbn"];
  names.forEach((_, i) => {
    const at = t + 0.3 + i * 1.3;
    if (i > 0) to(`#lv-t${i - 1}`, at - 0.05, `{ opacity: 0, y: -30, duration: 0.3 }`);
    fromTo(`#lv-t${i}`, at, `{ opacity: 0, y: 30 }`, `{ opacity: 1, y: 0, duration: 0.35 }`);
  });
  const ticks = names
    .map(
      (n, i) =>
        `<span class="tick" id="lv-t${i}" data-layout-allow-overlap data-layout-allow-occlusion><img src="logos/${n}.png" alt="" />$${n.toUpperCase()}</span>`,
    )
    .join("");
  return scene(
    "live",
    `<div class="carousel">${ticks}<b>live on NEAR testnet</b></div>
    <div class="win" id="lv-win"><div class="chrome"><i></i><i></i><i></i><span>app.nolossmeme.fun/m/dogn</span></div>
      <div class="view"><img id="lv-shot" src="shots/dogn.png" alt="" /></div></div>
    ${headline("live", "top:975px;font-size:44px;font-weight:500", 5)}`,
  );
})();

const launch = (() => {
  const t = start.launch;
  grow("#la-card", t + 0.1);
  grow("#la-img img", t + 0.45);
  typeWithKeys("la-name", "Shiba of NEAR", t + 0.7, 20);
  typeWithKeys("la-tick", "SHBN", t + 1.45, 10);
  press("#la-btn", cue("launch", "click"));
  pop("#la-ok", cue("launch", "click") + 0.35, true);
  return scene(
    "launch",
    `${headline("launch", "top:140px")}
    <div class="card" id="la-card" style="left:560px;top:300px;width:800px;padding:40px">
      <div class="inrow"><div class="pic" id="la-img"><img src="logos/shbn.png" alt="" /></div>
        <div class="fields"><div class="fieldbox"><span class="label">Name</span><b>${typed("la-name", "Shiba of NEAR")}</b></div>
        <div class="fieldbox"><span class="label">Ticker</span><b>${typed("la-tick", "SHBN")}</b></div></div></div>
      <div class="btn wide" id="la-btn">Launch</div>
    </div>
    <div class="pill ok" id="la-ok" style="top:820px">✓ shbn.streak.nolossmeme.testnet is live</div>`,
  );
})();

const outro = (() => {
  grow("#ot-brand", start.outro + 0.1);
  pop("#ot-url", cue("outro", "lose"));
  pop("#ot-near", cue("outro", "lose") + 0.3);
  return scene(
    "outro",
    `<div class="brand" id="ot-brand" style="top:300px"><img src="brand/nlm-black.png" alt="" /><span>NoLossMeme</span></div>
    ${headline("outro", "top:560px;font-weight:500;color:#6e6e73", 1)}
    <div class="pill dark" id="ot-url" style="top:720px">app.nolossmeme.fun</div>
    <p class="small-note" id="ot-near">Built on NEAR · no admin keys · open source</p>`,
  );
})();

// ---- audio: narration plus the effects
const audio = [
  ...SCENES.map(
    (s) =>
      `<audio id="vo-${s.id}" src="voice/${s.id}.mp3" data-start="${voiceAt[s.id]}" data-duration="${r2(voices[s.id].duration)}"></audio>`,
  ),
  ...sounds.map(
    ({ name, at, dur }, i) =>
      `<audio id="sfx-${i}" src="sfx/${name}.mp3" data-start="${at}" data-duration="${dur ?? SFX[name][2]}" data-volume="${SFX[name][1]}"></audio>`,
  ),
].join("\n");

const DUR = r2(total);
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
:root { --ink:#0d0d0d; --muted:#6e6e73; --line:#e8e8ed; --soft:#f4f4f6; --ok:#1f8a3b; --red:#e5484d; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { width:${W}px; height:${H}px; overflow:hidden; background:#fff; color:var(--ink); font-family:"Inter",sans-serif; }
#root { position:relative; width:100%; height:100%; overflow:hidden; background:#fff; }
.scene { position:absolute; inset:0; overflow:hidden; background:#fff; }
.hl { position:absolute; left:0; right:0; margin:0 auto; max-width:1600px; text-align:center; font-size:76px;
  font-weight:600; letter-spacing:-.035em; line-height:1.12; }
.hl .w { display:inline-block; opacity:0; }
.ch { opacity:0; }
.muted { color:var(--muted); }
.label { font-size:28px; font-weight:500; color:var(--muted); }
.bar { position:absolute; left:460px; top:480px; width:1000px; height:120px; display:flex; align-items:center; gap:22px; }
.plus { width:76px; height:76px; border-radius:50%; background:var(--soft); display:grid; place-items:center; font-size:44px; color:var(--muted); }
.field { flex:1; height:100%; border-radius:60px; background:var(--soft); display:flex; align-items:center; padding:0 120px 0 44px;
  font-size:44px; font-weight:500; position:relative; }
.send { position:absolute; right:22px; top:22px; width:76px; height:76px; border-radius:50%; background:var(--ink);
  color:#fff; display:grid; place-items:center; font-size:40px; font-weight:700; }
.card { position:absolute; background:#fff; border:1px solid var(--line); border-radius:36px; padding:36px 44px;
  box-shadow:0 30px 80px rgba(0,0,0,.08); }
.card.center { display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; }
.card.center b { font-size:46px; font-weight:600; letter-spacing:-.02em; }
.card.center .muted { font-size:30px; }
.row-head { display:flex; align-items:center; gap:18px; }
.row-head b { font-size:40px; font-weight:600; }
.row-head .muted { font-size:28px; }
.loss { margin-left:auto; font-family:"JetBrains Mono",monospace; font-size:64px; color:var(--red); font-weight:500; }
#hk-line { width:0; height:360px; overflow:hidden; margin-top:30px; }
.brand { position:absolute; left:0; right:0; top:400px; display:flex; justify-content:center; align-items:center; gap:40px; }
.brand img { height:200px; }
.brand span { font-size:150px; font-weight:700; letter-spacing:-.05em; }
.inrow { display:flex; align-items:center; gap:24px; margin-top:14px; }
.tok { width:84px; height:84px; border-radius:50%; }
.tok.big { width:120px; height:120px; }
.amt { font-family:"JetBrains Mono",monospace; font-size:84px; font-weight:500; min-width:220px; }
.unit { font-size:36px; }
.btn { margin-left:auto; padding:24px 46px; border-radius:999px; background:var(--ink); color:#fff; font-size:34px; font-weight:600; }
.btn.wide { margin:34px 0 0; text-align:center; }
.pill { position:absolute; left:0; right:0; margin:0 auto; width:fit-content; padding:18px 36px; border-radius:999px;
  background:var(--soft); font-size:32px; font-weight:500; white-space:nowrap; }
.pill.side { right:auto; margin:0; }
.pill.ok { background:#e9f7ee; color:var(--ok); }
.pill.red { background:#fdecec; color:var(--red); }
.pill.dark { background:var(--ink); color:#fff; }
.pill.small { position:static; margin:0 0 0 auto; padding:10px 24px; font-size:28px; opacity:0; }
#ci-pill { background:#e9f7ee; color:var(--ok); }
#ms-pill { background:#fdecec; color:var(--red); }
.drop { position:absolute; left:790px; top:560px; padding:12px 24px; border-radius:999px; background:#e9f7ee; color:var(--ok);
  font-size:28px; font-weight:600; opacity:0; }
.stack { display:flex; }
.stack img { width:110px; height:110px; border-radius:50%; border:6px solid #fff; margin-left:-26px; }
.stack img:first-child { margin-left:0; }
.count { position:relative; margin-top:16px; font-family:"JetBrains Mono",monospace; font-size:96px; font-weight:500; }
.count span { background:#fff; }
.count span + span { position:absolute; left:0; opacity:0; }
#ms-n1 { opacity:1; }
.track { margin-top:18px; height:16px; border-radius:99px; background:var(--soft); overflow:hidden; }
.fill { width:0; height:100%; background:var(--ink); }
#ms-fill { width:300px; background:var(--red); }
.people { display:flex; gap:80px; margin-top:44px; }
.who { display:flex; align-items:center; gap:20px; }
.av { width:84px; height:84px; border-radius:50%; background:var(--soft); color:var(--muted); display:grid; place-items:center;
  font-size:36px; font-weight:600; }
.av.on { background:var(--ink); color:#fff; }
.reward { font-family:"JetBrains Mono",monospace; font-size:28px; color:var(--ok); opacity:0; }
#ms-card .reward { color:var(--red); text-decoration:line-through; }
.carousel { position:absolute; left:0; right:0; top:80px; height:90px; }
.carousel .tick { position:absolute; right:calc(50% + 40px); top:6px; display:flex; align-items:center; gap:14px;
  padding:10px 28px 10px 12px; border-radius:999px; background:var(--soft); font-size:44px; font-weight:600; opacity:0; }
.carousel .tick img { width:58px; height:58px; border-radius:50%; }
.carousel b { position:absolute; left:calc(50% - 10px); top:14px; font-size:56px; font-weight:600; letter-spacing:-.03em; }
.win { position:absolute; left:320px; top:210px; width:1280px; height:740px; border-radius:28px; overflow:hidden;
  border:1px solid var(--line); box-shadow:0 40px 100px rgba(0,0,0,.14); background:#050507; }
.chrome { height:56px; background:#f4f4f6; display:flex; align-items:center; gap:10px; padding:0 22px; }
.chrome i { width:14px; height:14px; border-radius:50%; background:#d9d9de; }
.chrome span { margin:0 auto; font-size:28px; color:var(--muted); padding-right:60px; }
.view { position:relative; height:684px; overflow:hidden; }
#lv-shot { position:absolute; left:0; top:0; width:1280px; }
.pic { width:150px; height:150px; border-radius:50%; background:var(--soft); overflow:hidden; flex-shrink:0; }
.pic img { width:100%; height:100%; }
.fields { flex:1; display:flex; flex-direction:column; gap:16px; }
.fieldbox { border:1px solid var(--line); border-radius:20px; padding:14px 22px; }
.fieldbox b { display:block; font-size:36px; font-weight:600; margin-top:4px; min-height:44px; }
.small-note { position:absolute; left:0; right:0; top:860px; text-align:center; font-size:30px; color:var(--muted); }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${DUR}" data-width="${W}" data-height="${H}">
${[hook, flip, deposit, yieldScene, checkin, miss, live, launch, outro].join("\n")}
${audio}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${tweens.join("\n")}
window.__timelines = window.__timelines || {};
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
`;
writeFileSync(new URL("index.html", PUB), html);
console.log(
  `public/index.html: ${DUR}s, ${tweens.length} tweens, ${sounds.length} sounds; scene starts`,
  JSON.stringify(start),
);
