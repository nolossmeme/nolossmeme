# @nolossmeme/video

Source of [`docs/demo.mp4`](../../docs/demo.mp4): a [HyperFrames](https://hyperframes.heygen.com) composition (HTML + GSAP rendered to MP4) over screenshots of the live app, narrated with [ElevenLabs](https://elevenlabs.io) and captioned from its word timings.

```sh
pnpm capture   # screenshots of app.nolossmeme.fun + section boxes + latest DOGN draw → public/shots
pnpm voice     # narration per scene from src/script.ts → public/voice (needs ELEVENLABS_API_KEY in the root .env)
pnpm compose   # scripts/compose.ts → public/index.html, timed to the narration's word timings
pnpm preview   # HyperFrames Studio
pnpm render    # → out/demo-raw.mp4, then loudness-normalised (-14 LUFS) → docs/demo.mp4
```

`pnpm voice` skips scenes that already have audio; delete `public/voice/<scene>.*` after editing a line. Generated assets are not committed.

The draw scene shows draw #65, the first one that hit the community target: `capture` stores the latest draw, so put #65 back in `public/shots/draw.json` (`GET /pools/dogn.streak.nolossmeme.testnet/draws`) before `compose`.
