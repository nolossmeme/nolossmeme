# @nolossmeme/video

Source of [`docs/demo.mp4`](../../docs/demo.mp4), a 46 s [HyperFrames](https://hyperframes.heygen.com) film (HTML + GSAP rendered to MP4): one idea per scene on a white stage, the headline built word by word with the [ElevenLabs](https://elevenlabs.io) narration, UI that types and clicks itself, and the live DOGN pool page.

```sh
pnpm capture   # screenshots of app.nolossmeme.fun + section boxes → public/shots
pnpm voice     # narration per scene from src/script.ts → public/voice (needs ELEVENLABS_API_KEY in the root .env)
pnpm compose   # scripts/compose.ts → public/index.html, timed to the narration's word timings
pnpm preview   # HyperFrames Studio
pnpm render    # → out/demo-raw.mp4, then loudness-normalised (-14 LUFS) → docs/demo.mp4
```

`pnpm voice` skips scenes that already have audio; delete `public/voice/<scene>.*` after editing a line. Screenshots and voice are generated, not committed. Sound effects in `public/sfx` come from the HyperFrames bundled library (Pixabay licence, see `public/sfx/CREDITS.md`). There is no music bed: the HyperFrames music catalog needs a HeyGen sign-in.
