/** MotionSites "Vaultra" globe plate: still + 4 s seamless loop, hotlinked as the prompt instructs. */
const GLOBE_STILL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/f1631235-0a76-464d-8f1d-2c4b48a997d5.jpg";
const GLOBE_VIDEO =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/e71aea27-a808-4ae3-8231-a469d49285d4.mp4";

import { appLink } from "../lib/config";

const chips: { label: string; className: string; delay: string }[] = [
  { label: "Ⓝ", className: "left-[6%] top-[38%]", delay: "0s" },
  { label: "🐸", className: "right-[8%] top-[30%]", delay: "1.2s" },
  { label: "🐶", className: "left-[14%] top-[66%]", delay: "2.1s" },
  { label: "stⓃ", className: "right-[12%] top-[62%]", delay: "0.6s" },
];

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate min-h-[100svh] overflow-hidden flex items-center justify-center text-center"
    >
      {/* plate */}
      <div className="absolute inset-0 -z-10">
        <img
          src={GLOBE_STILL}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[50%_60%]"
          loading="eager"
          fetchPriority="high"
        />
        <video
          className="absolute inset-0 h-full w-full object-cover object-[50%_60%]"
          src={GLOBE_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(90%_80%_at_50%_45%,transparent_55%,rgba(5,5,7,0.6)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />
      </div>

      {/* light lines */}
      <div className="hairline w-[46vw] left-[-6vw] top-[22%] rotate-[28deg]" aria-hidden />
      <div className="hairline w-[40vw] right-[-8vw] top-[18%] -rotate-[24deg]" aria-hidden />
      <div className="hairline w-[30vw] left-[-4vw] top-[72%] -rotate-[14deg]" aria-hidden />

      {/* coin chips */}
      {chips.map((c) => (
        <div
          key={c.label}
          className={`absolute ${c.className} hidden md:grid place-items-center size-11 rounded-full glass text-sm font-semibold floaty`}
          style={{ animationDelay: c.delay }}
          aria-hidden
        >
          {c.label}
        </div>
      ))}

      <div className="relative mx-auto max-w-5xl px-4 pt-32 pb-24">
        <span className="pill rise" style={{ animationDelay: "0.1s" }}>
          <span className="text-lime">⚡</span> Built at NEAR HACKATHON 2026 · live on testnet
        </span>
        <h1
          className="display gradient-text mt-6 text-[clamp(2.6rem,7vw,5.2rem)] rise"
          style={{ animationDelay: "0.25s" }}
        >
          Memecoins you
          <br />
          can't lose on.
        </h1>
        <p
          className="mx-auto mt-6 max-w-2xl text-base sm:text-lg text-muted rise"
          style={{ animationDelay: "0.45s" }}
        >
          Deposit NEAR and keep every yocto. Only the staking yield is minted into the meme and
          raffled to depositors every epoch. Burn any token for its share of the treasury: the floor
          never hits zero, a rug is impossible.
        </p>
        <div
          className="mt-8 flex flex-wrap justify-center gap-3 rise"
          style={{ animationDelay: "0.6s" }}
        >
          <a href={appLink()} className="btn-primary">
            Open the app →
          </a>
          <a href={`${import.meta.env.BASE_URL}demo/`} className="btn-secondary">
            ▶ Watch the 99 s demo
          </a>
          <a href="#how" className="btn-secondary">
            How it works
          </a>
        </div>
        <div
          className="mt-16 flex flex-col items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted/70 rise"
          style={{ animationDelay: "0.9s" }}
        >
          <span className="h-9 w-5 rounded-full border border-white/20 relative">
            <span className="absolute left-1/2 top-1.5 -translate-x-1/2 size-1 rounded-full bg-lime floaty" />
          </span>
          scroll
        </div>
      </div>
    </section>
  );
}
