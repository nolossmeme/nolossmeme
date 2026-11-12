import { Composition, staticFile } from "remotion";

import { Demo, sceneFrames, type DemoProps, type DrawEvent } from "./Demo";
import { SCENES, type SceneId } from "./script";
import type { ShotMeta, Voice } from "./ui";

const FPS = 30;

async function json<T>(path: string): Promise<T> {
  return (await fetch(staticFile(path))).json() as Promise<T>;
}

export function Root() {
  return (
    <Composition
      id="Demo"
      component={Demo}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={FPS * 60}
      defaultProps={
        { voices: {} as Record<SceneId, Voice>, shots: {}, draw: null } satisfies DemoProps
      }
      calculateMetadata={async () => {
        const voices = Object.fromEntries(
          await Promise.all(
            SCENES.map(async (s) => [s.id, await json<Voice>(`voice/${s.id}.json`)]),
          ),
        ) as Record<SceneId, Voice>;
        const shots = await json<Record<string, ShotMeta>>("shots/boxes.json");
        const draw = await json<DrawEvent | null>("shots/draw.json");
        const durationInFrames = SCENES.reduce((n, s) => n + sceneFrames(voices[s.id], FPS), 0);
        return { durationInFrames, props: { voices, shots, draw } };
      }}
    />
  );
}
