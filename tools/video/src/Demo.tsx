import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Series,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { SCENES, type SceneId } from "./script";
import {
  C,
  Captions,
  Chip,
  MONO,
  SANS,
  Shot,
  Title,
  cue,
  pad,
  useIn,
  type ShotMeta,
  type Voice,
} from "./ui";

export interface DemoProps extends Record<string, unknown> {
  voices: Record<SceneId, Voice>;
  shots: Record<string, ShotMeta>;
  draw: DrawEvent | null;
}

/** Silence after each line, seconds. */
export const GAP = 0.7;
export const sceneFrames = (v: Voice, fps: number) => Math.ceil((v.duration + GAP) * fps);

function Backdrop() {
  const f = useCurrentFrame();
  const drift = Math.sin(f / 90) * 60;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(900px 600px at ${300 + drift}px 120px, ${C.lime}14, transparent 70%),
          radial-gradient(900px 700px at ${1650 - drift}px 1000px, ${C.pink}12, transparent 70%), ${C.bg}`,
      }}
    />
  );
}

function Logo({
  slug,
  size,
  at,
  x,
  y,
}: {
  slug: string;
  size: number;
  at: number;
  x: number;
  y: number;
}) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 12, mass: 0.7 } });
  const bob = Math.sin((f - at) / 14) * 8;
  return (
    <Img
      src={staticFile(`logos/${slug}.png`)}
      style={{
        position: "absolute",
        left: x,
        top: y + bob,
        width: size,
        height: size,
        borderRadius: "50%",
        transform: `scale(${s}) rotate(${(1 - s) * -40}deg)`,
        boxShadow: `0 20px 80px rgba(0,0,0,.6)`,
      }}
    />
  );
}

/** NLM mark + name, sized by the surrounding Title. */
function Wordmark() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.22em" }}>
      <Img src={staticFile("brand/nlm-white.png")} style={{ height: "0.82em" }} />
      <span>
        NoLoss<span style={{ color: C.lime }}>Meme</span>
      </span>
    </span>
  );
}

function Hook({ v }: { v: Voice }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = cue(v, "NoLossMeme", fps, 140);
  const crash = interpolate(f, [10, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const out = interpolate(f, [reveal - 10, reveal], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // A pump, then the rug.
  const pts = [0, 0.1, 0.25, 0.35, 0.55, 0.7, 0.8, 0.86, 1].map((x, i) => [
    x * 1300,
    [520, 470, 380, 300, 160, 90, 60, 560, 600][i]!,
  ]);
  const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  return (
    <AbsoluteFill>
      <div style={{ opacity: out }}>
        <svg width={1300} height={640} style={{ position: "absolute", left: 310, top: 200 }}>
          <path
            d={path}
            fill="none"
            stroke={crash > 0.83 ? C.red : C.lime}
            strokeWidth={10}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - crash}
          />
        </svg>
        <Title
          at={62}
          size={150}
          color={C.red}
          style={{ position: "absolute", right: 260, top: 640 }}
        >
          −99%
        </Title>
        <Title at={0} size={60} style={{ position: "absolute", left: 160, top: 110 }}>
          Most memecoins end the same way.
        </Title>
      </div>
      {f >= reveal - 4 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <Logo slug="dogn" size={170} at={reveal} x={760} y={130} />
          <Logo slug="pepn" size={170} at={reveal + 6} x={990} y={130} />
          <Title at={reveal} size={168} style={{ textAlign: "center", marginTop: 120 }}>
            <Wordmark />
          </Title>
          <Title
            at={cue(v, "launchpad", fps, reveal + 30)}
            size={48}
            color={C.muted}
            style={{ marginTop: 24 }}
          >
            A memecoin launchpad on NEAR
          </Title>
          <Chip
            at={cue(v, "deposit", fps, reveal + 60)}
            style={{ position: "relative", marginTop: 60, fontSize: 40 }}
          >
            Your deposit is never at risk
          </Chip>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function Node({
  at,
  title,
  sub,
  color,
  x,
}: {
  at: number;
  title: string;
  sub: string;
  color: string;
  x: number;
}) {
  const a = useIn(at, 16);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 360,
        width: 360,
        height: 230,
        borderRadius: 28,
        background: C.surface,
        border: `2px solid ${color}`,
        boxShadow: `0 0 80px ${color}22`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 34px",
        ...a,
      }}
    >
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, color: C.text }}>{title}</div>
      <div style={{ fontFamily: SANS, fontSize: 28, color: C.muted, marginTop: 10 }}>{sub}</div>
    </div>
  );
}

function Arrow({ at, x, color = C.muted }: { at: number; x: number; color?: string }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg width={90} height={40} style={{ position: "absolute", left: x, top: 455, opacity: p }}>
      <path d={`M0,20 L${70 * p},20`} stroke={color} strokeWidth={6} />
      <path d="M62,6 L84,20 L62,34" fill="none" stroke={color} strokeWidth={6} opacity={p} />
    </svg>
  );
}

function Vault({ v }: { v: Voice }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const meta = cue(v, "Meta", fps, 60);
  const principal = cue(v, "principal", fps, 120);
  const yieldAt = cue(v, "yield", fps, 200);
  const treasury = cue(v, "treasury", fps, 260);
  const meme = cue(v, "meme", fps, 300);
  const back = interpolate(f, [principal, principal + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <Title at={0} size={58} style={{ position: "absolute", left: 120, top: 120 }}>
        Principal stays yours. <span style={{ color: C.lime }}>Only the yield plays.</span>
      </Title>
      <Node at={0} x={80} title="You" sub="deposit NEAR" color={C.text} />
      <Arrow at={meta - 8} x={455} />
      <Node at={meta} x={550} title="Meta Pool" sub="staked as stNEAR" color={C.blue} />
      <Arrow at={yieldAt - 4} x={925} color={C.amber} />
      <Node at={treasury} x={1020} title="Treasury" sub="yield + sponsors" color={C.amber} />
      <Arrow at={meme - 8} x={1395} color={C.lime} />
      <Node at={meme} x={1490} title="MEME" sub="minted, backed" color={C.lime} />
      <svg
        width={900}
        height={200}
        style={{ position: "absolute", left: 230, top: 600, opacity: back }}
      >
        <path
          d="M 560 10 C 560 150, 40 150, 40 10"
          fill="none"
          stroke={C.lime}
          strokeWidth={6}
          strokeDasharray="14 12"
          pathLength={1}
        />
        <path d="M 26 30 L 40 6 L 56 30" fill="none" stroke={C.lime} strokeWidth={6} />
      </svg>
      <Title
        at={principal + 6}
        size={36}
        color={C.lime}
        style={{ position: "absolute", left: 360, top: 760 }}
      >
        withdraw your principal any time
      </Title>
    </AbsoluteFill>
  );
}

function Streak({ v, shots }: { v: Voice; shots: DemoProps["shots"] }) {
  const { fps } = useVideoConfig();
  const d = shots.dogn!;
  const hit = cue(v, "Hit", fps, 120);
  const seventy = cue(v, "seventy", fps, 200);
  const rest = cue(v, "rest", fps, 280);
  const miss = cue(v, "Miss", fps, 380);
  const community = pad(d.boxes.community!, 30);
  const rules = pad(d.boxes.rules!, 30);
  return (
    <AbsoluteFill>
      <Shot
        name="dogn"
        meta={d}
        frame={{ x: 120, y: 90, w: 1680, h: 520 }}
        keys={[
          [0, { x: 0, y: 0, w: 1920, h: 1080 }],
          [40, community],
          [seventy - 10, community],
          [seventy + 20, rules],
        ]}
      />
      <Chip at={hit} style={{ left: 120, top: 700 }}>
        🎯 Target hit → new tokens mint
      </Chip>
      <Chip at={seventy} color={C.pink} style={{ left: 820, top: 700 }}>
        70% jackpot · one raffle winner
      </Chip>
      <Chip at={rest} color={C.blue} style={{ left: 120, top: 830 }}>
        30% shared by everyone who checked in
      </Chip>
      <Chip at={miss} color={C.red} style={{ left: 1030, top: 830 }}>
        Miss → burned, streak resets
      </Chip>
    </AbsoluteFill>
  );
}

const TXS = [
  ["degen.nolossmeme.testnet", "deposit 1.005 Ⓝ", "C44SRCEb…N9d6zd9"],
  ["degen.nolossmeme.testnet", "check_in", "4wL7aSrp…pf6hNxT8"],
  ["nolossmeme.testnet", "check_in", "GspgWT2K…3ymoocqi"],
];

function Terminal({ at, step }: { at: number; step: number }) {
  const a = useIn(at);
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        right: 90,
        top: 715,
        width: 1180,
        borderRadius: 20,
        background: "rgba(12,12,18,.96)",
        border: `1px solid ${C.border}`,
        boxShadow: "0 30px 100px rgba(0,0,0,.7)",
        padding: "22px 28px",
        fontFamily: MONO,
        fontSize: 22,
        color: C.text,
        ...a,
      }}
    >
      <div style={{ color: C.muted, marginBottom: 12 }}>testnet · real transactions</div>
      {TXS.map(([who, what, hash], i) => (
        <div
          key={hash}
          style={{ opacity: f >= at + i * step ? 1 : 0, display: "flex", gap: 20, lineHeight: 1.7 }}
        >
          <span style={{ color: C.lime }}>✓</span>
          <span style={{ width: 360 }}>{who}</span>
          <span style={{ width: 240, color: C.amber }}>{what}</span>
          <span style={{ color: C.muted }}>{hash}</span>
        </div>
      ))}
      <div style={{ opacity: f >= at + 3 * step ? 1 : 0, color: C.lime, marginTop: 8 }}>
        → community check-ins 2 / 2 · target hit
      </div>
    </div>
  );
}

function Live({ v, shots }: { v: Voice; shots: DemoProps["shots"] }) {
  const { fps } = useVideoConfig();
  const d = shots.dogn!;
  const faucet = cue(v, "faucet", fps, 90);
  const deposits = cue(v, "deposits", fps, 160);
  const two = cue(v, "Two", fps, 230);
  const every = cue(v, "Every", fps, 300);
  const home = shots.home!;
  const act = home.boxes.activity!;
  const top = { x: 0, y: 0, w: 1920, h: 560 };
  const area = { x: 120, y: 90, w: 1680, h: 500 };
  const f = useCurrentFrame();
  return (
    <AbsoluteFill>
      {f < every ? (
        <Shot
          name="dogn"
          meta={d}
          frame={area}
          keys={[
            [0, top],
            [faucet - 20, top],
            [faucet, pad(d.boxes.faucet!, 30)],
            [deposits, pad(d.boxes.position!, 30)],
            [two, pad(d.boxes.community!, 30)],
          ]}
        />
      ) : (
        // The home feed is full width, so it fills the frame without neighbours.
        <Shot
          name="home"
          meta={home}
          frame={area}
          keys={[[0, { x: act.x - 20, y: act.y - 20, w: act.w + 40, h: 420 }]]}
        />
      )}
      <Chip at={faucet} style={{ left: 120, top: 625 }}>
        Turnstile-gated faucet · 1 Ⓝ / day
      </Chip>
      <Terminal at={deposits - 10} step={Math.max(10, Math.round((two - deposits) / 3))} />
    </AbsoluteFill>
  );
}

export interface DrawEvent {
  txHash: string;
  blockHeight: number;
  data: {
    epoch: number;
    winner: string;
    checkins: number;
    target_hit: boolean;
    minted: string;
    burned: string;
    checkin_reward_each: string;
    community_streak: number;
  };
}

const meme = (yocto: string) => (Number(BigInt(yocto) / 10n ** 15n) / 1000).toLocaleString("en");

function Receipt({ at, draw }: { at: number; draw: DrawEvent }) {
  const a = useIn(at);
  const d = draw.data;
  const rows: [string, string, string?][] = [
    ["epoch", `#${d.epoch}`],
    ["check-ins", `${d.checkins} / 2`, d.target_hit ? C.lime : C.red],
    [
      "target",
      d.target_hit ? "hit ✓  community share minted" : "missed  community share burned",
      d.target_hit ? C.lime : C.red,
    ],
    ["jackpot winner", d.winner, C.pink],
    ["minted", `${meme(d.minted)} DOGN`],
    ["check-in reward", `${meme(d.checkin_reward_each)} DOGN each`],
    ["community streak", `🔥 ${d.community_streak}`],
    ["block", draw.blockHeight.toLocaleString("en")],
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: 360,
        top: 170,
        width: 1200,
        borderRadius: 26,
        background: "rgba(12,12,18,.97)",
        border: `2px solid ${C.lime}`,
        boxShadow: `0 40px 140px rgba(0,0,0,.8), 0 0 80px ${C.lime}22`,
        padding: "34px 44px",
        fontFamily: MONO,
        fontSize: 30,
        color: C.text,
        ...a,
      }}
    >
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 44, marginBottom: 20 }}>
        draw() on dogn.streak.nolossmeme.testnet
      </div>
      {rows.map(([k, val, color]) => (
        <div key={k} style={{ display: "flex", lineHeight: 1.75 }}>
          <span style={{ width: 360, color: C.muted }}>{k}</span>
          <span style={{ color: color ?? C.text }}>{val}</span>
        </div>
      ))}
      <div style={{ marginTop: 18, color: C.blue, fontSize: 24 }}>
        testnet.nearblocks.io/txns/{draw.txHash}
      </div>
    </div>
  );
}

function Draw({
  v,
  shots,
  draw,
}: {
  v: Voice;
  shots: DemoProps["shots"];
  draw: DemoProps["draw"];
}) {
  const { fps } = useVideoConfig();
  const f = useCurrentFrame();
  const d = shots.dogn!;
  const log = d.boxes.drawlog!;
  const verify = cue(v, "verifiable", fps, 170);
  // The fresh draw first, then the log of every earlier one.
  const receipt = draw ? cue(v, "keeper", fps, 30) + 10 : Infinity;
  const history = cue(v, "That", fps, 260);
  return (
    <AbsoluteFill>
      <Shot
        name="dogn"
        meta={d}
        frame={{ x: 120, y: 90, w: 1680, h: 600 }}
        keys={[
          [0, { x: log.x - 20, y: log.y - 20, w: log.w + 40, h: 520 }],
          [history + 30, { x: log.x - 20, y: log.y - 20, w: log.w + 40, h: 520 }],
          [verify + 90, { x: log.x - 20, y: log.y + 300, w: log.w + 40, h: 520 }],
        ]}
      />
      {draw && f >= receipt - 2 && f < history && <Receipt at={receipt} draw={draw} />}
      <Chip at={history} style={{ left: 120, top: 760 }}>
        Keeper calls draw() each epoch
      </Chip>
      <Chip at={cue(v, "sixty", fps, 90)} color={C.pink} style={{ left: 760, top: 760 }}>
        65 draws on testnet
      </Chip>
      <Chip at={verify} color={C.blue} style={{ left: 1240, top: 760 }}>
        Verifiable on NEAR Blocks
      </Chip>
    </AbsoluteFill>
  );
}

function Floor({ v, shots }: { v: Voice; shots: DemoProps["shots"] }) {
  const { fps } = useVideoConfig();
  const d = shots.dogn!;
  const redeem = cue(v, "Redeem", fps, 120);
  const stats = { x: 288, y: 40, w: 1344, h: 400 };
  return (
    <AbsoluteFill>
      <Shot
        name="dogn"
        meta={d}
        frame={{ x: 120, y: 90, w: 1680, h: 560 }}
        keys={[
          [0, stats],
          [redeem - 10, stats],
          [redeem + 10, pad(d.boxes.position!, 30)],
        ]}
      />
      <Chip at={cue(v, "floor", fps, 50)} style={{ left: 120, top: 740 }}>
        Floor = treasury ÷ supply
      </Chip>
      <Chip at={redeem} color={C.blue} style={{ left: 700, top: 740 }}>
        Redeem → stNEAR
      </Chip>
      <Chip at={cue(v, "withdraw", fps, 180)} color={C.amber} style={{ left: 1180, top: 740 }}>
        Withdraw at face value
      </Chip>
    </AbsoluteFill>
  );
}

function Outro({ v, shots }: { v: Voice; shots: DemoProps["shots"] }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const end = cue(v, "NoLossMeme", fps, 150);
  const l = shots.launch!;
  if (f < end - 4)
    return (
      <AbsoluteFill>
        <Shot
          name="launch"
          meta={l}
          frame={{ x: 120, y: 90, w: 1680, h: 760 }}
          keys={[
            [0, { x: 0, y: 0, w: 1920, h: 1000 }],
            [end, { x: 200, y: 100, w: 1520, h: 820 }],
          ]}
        />
        <Chip at={cue(v, "launch", fps, 20)} style={{ left: 120, top: 760 }}>
          Launch a streak coin in one transaction
        </Chip>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <Logo slug="dogn" size={150} at={end} x={790} y={120} />
      <Logo slug="pepn" size={150} at={end + 6} x={980} y={120} />
      <Title at={end} size={150} style={{ marginTop: 120 }}>
        <Wordmark />
      </Title>
      <Title at={end + 10} size={52} color={C.muted} style={{ marginTop: 20 }}>
        Memecoins you can't lose on.
      </Title>
      <Title
        at={cue(v, "Try", fps, end + 40)}
        size={56}
        color={C.lime}
        style={{ marginTop: 60, fontFamily: MONO }}
      >
        app.nolossmeme.fun
      </Title>
      <Title
        at={cue(v, "Try", fps, end + 40) + 8}
        size={30}
        color={C.muted}
        style={{ marginTop: 22, fontWeight: 400 }}
      >
        github.com/nolossmeme/nolossmeme · NEAR testnet · staked with Meta Pool
      </Title>
    </AbsoluteFill>
  );
}

const VIEWS: Record<
  SceneId,
  (p: { v: Voice; shots: DemoProps["shots"]; draw: DemoProps["draw"] }) => ReactNode
> = {
  hook: ({ v }) => <Hook v={v} />,
  vault: ({ v }) => <Vault v={v} />,
  streak: (p) => <Streak {...p} />,
  live: (p) => <Live {...p} />,
  draw: (p) => <Draw {...p} />,
  floor: (p) => <Floor {...p} />,
  outro: (p) => <Outro {...p} />,
};

export function Demo({ voices, shots, draw }: DemoProps) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop />
      <Series>
        {SCENES.map((s) => {
          const v = voices[s.id];
          return (
            <Series.Sequence key={s.id} durationInFrames={sceneFrames(v, fps)} name={s.id}>
              <Audio src={staticFile(`voice/${s.id}.mp3`)} />
              {VIEWS[s.id]({ v, shots, draw })}
              <Captions voice={v} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
}
