# Design language

The web app follows one visual system across the landing page and the app screens. The
references come from the MotionSites library (Power plan) and were adapted, not copied:

| Part       | Reference                  | What we took                                                                                                                                                                                                         |
| ---------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero       | Vaultra Hero (crypto hero) | dotted particle globe plate (still + 4 s seamless loop, hotlinked), glass pill badge, light-weight gradient headline, pill nav and buttons, thin light lines and floating glass "coin chips", 1.6 s rise-in entrance |
| Benefits   | Guardnet Benefits          | three `neutral-950` cards (text / looping video / text) with blurred colour blobs, 380/460 px heights, `white/70` body                                                                                               |
| CTA band   | Fundora ("Emerald Vault")  | seven rotated spotlight beams from the top edge over a faint 94 px grid, gradient headline, primary + ghost pills, retuned from emerald to lime                                                                      |
| Footer     | Vantix ("Cobalt Flare")    | aurora glow band fading into the page, link columns, hairline and dashed dividers, oversized wordmark                                                                                                                |
| App chrome | Zapline dashboard          | glass tiles with a thin glow line on top, mono numbers, tables on `white/5` rows, pill tabs                                                                                                                          |

## Tokens

| Token                   | Value                 | Use                                   |
| ----------------------- | --------------------- | ------------------------------------- |
| `bg`                    | `#050507`             | page                                  |
| `surface` / `surface-2` | `#0c0c12` / `#14141c` | cards, inputs                         |
| `border`                | `#1f1f2a`             | hairlines                             |
| `text` / `muted`        | `#f5f5f8` / `#9a9aae` | copy                                  |
| `lime`                  | `#a3ff5b`             | primary accent, floor price, positive |
| `pink`                  | `#ff5bd6`             | secondary accent (globe rim, blobs)   |
| `blue`                  | `#4f7cff`             | tertiary (globe rim)                  |
| `amber` / `red`         | `#ffc857` / `#ff6b6b` | warnings, errors                      |

Type: Inter 300 for display (`.display`, letter-spacing −0.035em), Inter 400/500 for UI,
JetBrains Mono for every number and account id. Radii: 9999 px pills, 24 px cards.

Utilities live in `packages/ui/src/theme.css` (imported by both apps) (`glass`, `card`, `glow-top`, `btn-*`, `pill`,
`kicker`, `display`, `gradient-text`, `rise`, `floaty`). Motion respects
`prefers-reduced-motion` (no entrance, videos hidden).

## Assets

Hero plate and loops are hotlinked from MotionSites' CDN as their prompts instruct:

- globe still `…/f1631235-0a76-464d-8f1d-2c4b48a997d5.jpg`, globe loop `…/e71aea27-…-a469d49285d4.mp4`
- benefits loop `…/hf_20261022_235442_c62146c2-…-649a4aa26cf5.mp4` (green grid horizon)

If the CDN ever goes away, drop replacements into `apps/web/public/` and update
`apps/landing/src/components/Hero.tsx` and `Benefits.tsx`.
