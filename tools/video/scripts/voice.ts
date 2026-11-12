/** ElevenLabs narration: one mp3 per scene plus word timings for captions.
 *  Needs ELEVENLABS_API_KEY (read from the repo-root .env). Skips scenes already generated. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { SCENES } from "../src/script.js";

const VOICE = process.env.ELEVENLABS_VOICE_ID ?? "TX3LPaxmHKxFdv7VOQHJ"; // Liam
const MODEL = "eleven_multilingual_v2";
const OUT = new URL("../public/voice/", import.meta.url);

function apiKey(): string {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const env = readFileSync(new URL("../../../.env", import.meta.url), "utf8");
  const line = env.split("\n").find((l) => l.startsWith("ELEVENLABS_API_KEY="));
  if (!line) throw new Error("ELEVENLABS_API_KEY is not set");
  return line.slice("ELEVENLABS_API_KEY=".length).trim();
}

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}
export interface Word {
  text: string;
  start: number;
  end: number;
}

/** Group character timings into words. */
function words(a: Alignment): Word[] {
  const out: Word[] = [];
  let cur: Word | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    const start = a.character_start_times_seconds[i] ?? 0;
    const end = a.character_end_times_seconds[i] ?? start;
    if (cur) {
      cur.text += ch;
      cur.end = end;
    } else cur = { text: ch, start, end };
  });
  if (cur) out.push(cur);
  return out;
}

mkdirSync(OUT, { recursive: true });
const key = apiKey();
for (const s of SCENES) {
  const json = new URL(`${s.id}.json`, OUT);
  if (existsSync(json)) continue;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "content-type": "application/json" },
      body: JSON.stringify({
        text: s.text,
        model_id: MODEL,
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
      }),
    },
  );
  if (!res.ok) throw new Error(`${s.id}: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { audio_base64: string; alignment: Alignment };
  writeFileSync(new URL(`${s.id}.mp3`, OUT), Buffer.from(body.audio_base64, "base64"));
  const w = words(body.alignment);
  const duration = body.alignment.character_end_times_seconds.at(-1) ?? 0;
  writeFileSync(json, JSON.stringify({ duration, words: w }));
  console.log(s.id, `${duration.toFixed(1)}s`);
}
