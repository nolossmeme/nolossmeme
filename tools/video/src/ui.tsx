import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import type { CSSProperties, ReactNode } from "react";
import {
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const SANS = loadInter("normal", {
  weights: ["400", "600", "800"],
  subsets: ["latin"],
}).fontFamily;
export const MONO = loadMono("normal", { weights: ["400", "700"], subsets: ["latin"] }).fontFamily;

/** Same tokens as packages/ui/src/theme.css. */
export const C = {
  bg: "#050507",
  surface: "#0c0c12",
  surface2: "#14141c",
  border: "#1f1f2a",
  text: "#f5f5f8",
  muted: "#9a9aae",
  lime: "#a3ff5b",
  pink: "#ff5bd6",
  blue: "#4f7cff",
  amber: "#ffc857",
  red: "#ff6b6b",
};

export interface Word {
  text: string;
  start: number;
  end: number;
}
export interface Voice {
  duration: number;
  words: Word[];
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface ShotMeta {
  width: number;
  height: number;
  boxes: Record<string, Box>;
}

/** Frame at which `word` (case-insensitive prefix) is first spoken, or `fallback`. */
export function cue(voice: Voice, word: string, fps: number, fallback = 0): number {
  const w = voice.words.find((x) => x.text.toLowerCase().startsWith(word.toLowerCase()));
  return w ? Math.round(w.start * fps) : fallback;
}

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Fade + rise in from `at`. */
export function useIn(at: number, dur = 14): { opacity: number; transform: string } {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - at, fps, config: { damping: 200 }, durationInFrames: dur });
  return { opacity: s, transform: `translateY(${(1 - s) * 30}px)` };
}

/** A full-page screenshot seen through a camera that moves between boxes. */
export function Shot({
  name,
  meta,
  keys,
  frame: area = { x: 120, y: 110, w: 1680, h: 760 },
}: {
  name: string;
  meta: ShotMeta;
  /** Camera stops: [frame, box]. The camera eases from one stop to the next. */
  keys: [number, Box][];
  frame?: Box;
}) {
  const f = useCurrentFrame();
  const at = (i: number) => keys[Math.max(0, Math.min(keys.length - 1, i))]!;
  let i = 0;
  while (i < keys.length - 1 && f >= at(i + 1)[0]) i++;
  const [f0, b0] = at(i);
  const [f1, b1] = at(i + 1);
  const p =
    f1 > f0
      ? interpolate(f, [f0, f1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        })
      : 0;
  const lerp = (a: number, b: number) => a + (b - a) * p;
  const box = {
    x: lerp(b0.x, b1.x),
    y: lerp(b0.y, b1.y),
    w: lerp(b0.w, b1.w),
    h: lerp(b0.h, b1.h),
  };
  const scale = Math.min(area.w / box.w, area.h / box.h);
  const tx = area.x + (area.w - box.w * scale) / 2 - box.x * scale;
  const ty = area.y + (area.h - box.h * scale) / 2 - box.y * scale;
  return (
    <div
      style={{
        position: "absolute",
        left: area.x - 12,
        top: area.y - 12,
        width: area.w + 24,
        height: area.h + 24,
        overflow: "hidden",
        borderRadius: 24,
        border: `1px solid ${C.border}`,
        boxShadow: "0 40px 120px rgba(0,0,0,.6)",
        background: C.bg,
      }}
    >
      <Img
        src={staticFile(`shots/${name}.png`)}
        style={{
          position: "absolute",
          left: tx - area.x + 12,
          top: ty - area.y + 12,
          width: meta.width * scale,
          height: meta.height * scale,
        }}
      />
    </div>
  );
}

/** Grow a box by `pad` on every side. */
export const pad = (b: Box, p: number): Box => ({
  x: b.x - p,
  y: b.y - p,
  w: b.w + 2 * p,
  h: b.h + 2 * p,
});

export function Chip({
  children,
  color = C.lime,
  at,
  style,
}: {
  children: ReactNode;
  color?: string;
  at: number;
  style?: CSSProperties;
}) {
  const a = useIn(at);
  return (
    <div
      style={{
        position: "absolute",
        padding: "18px 28px",
        borderRadius: 18,
        background: "rgba(12,12,18,.92)",
        border: `2px solid ${color}`,
        color: C.text,
        fontFamily: SANS,
        fontSize: 34,
        fontWeight: 600,
        boxShadow: `0 0 60px ${color}33`,
        ...a,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Join "app dot nolossmeme dot fun" back into the URL it reads out. */
function spoken(words: Word[]): Word[] {
  const out: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const prev = out.at(-1);
    if (w.text === "dot" && prev && words[i + 1]) {
      const next = words[++i]!;
      out[out.length - 1] = { text: `${prev.text}.${next.text}`, start: prev.start, end: next.end };
    } else out.push({ ...w });
  }
  return out;
}

/** Burned-in captions: a few words at a time, the spoken one in lime. */
export function Captions({ voice }: { voice: Voice }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const lines: Word[][] = [];
  for (const w of spoken(voice.words)) {
    const last = lines.at(-1);
    const prev = last?.at(-1);
    if (!last || last.length >= 7 || (prev && /[.,:!?]$/.test(prev.text) && last.length >= 3))
      lines.push([w]);
    else last.push(w);
  }
  const line = lines.find((l) => t <= (l.at(-1)?.end ?? 0) + 0.25) ?? [];
  if (line.length === 0 || t < (line[0]?.start ?? 0) - 0.2) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 46,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: SANS,
        fontSize: 38,
        fontWeight: 600,
        letterSpacing: -0.3,
        textShadow: "0 2px 16px rgba(0,0,0,.9)",
      }}
    >
      <span style={{ background: "rgba(5,5,7,.72)", padding: "10px 22px", borderRadius: 14 }}>
        {line.map((w) => (
          <span key={`${w.start}-${w.text}`} style={{ color: t >= w.start ? C.text : C.muted }}>
            {w.text}{" "}
          </span>
        ))}
      </span>
    </div>
  );
}

export function Title({
  children,
  at,
  size = 64,
  color = C.text,
  style,
}: {
  children: ReactNode;
  at: number;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  const a = useIn(at);
  return (
    <div
      style={{
        fontFamily: SANS,
        fontWeight: 800,
        fontSize: size,
        letterSpacing: -size / 28,
        lineHeight: 1.05,
        color,
        ...a,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
