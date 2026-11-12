# @nolossmeme/video

Source of [`docs/demo.mp4`](../../docs/demo.mp4): a [Remotion](https://www.remotion.dev) composition over screenshots of the live app, narrated with [ElevenLabs](https://elevenlabs.io) and captioned from its word timings.

```sh
pnpm capture   # screenshots of app.nolossmeme.fun + section boxes + latest DOGN draw → public/shots
pnpm voice     # narration per scene from src/script.ts → public/voice (needs ELEVENLABS_API_KEY in the root .env)
pnpm studio    # preview
pnpm render    # → out/demo-raw.mp4, then loudness-normalised (-14 LUFS) → docs/demo.mp4
```

`pnpm voice` skips scenes that already have audio; delete `public/voice/<scene>.*` after editing a line. Generated assets are not committed.
