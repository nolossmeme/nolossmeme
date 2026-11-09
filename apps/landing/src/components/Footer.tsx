import { Logo } from "@nolossmeme/ui";

import { REPO_URL, appLink } from "../lib/config";

/** Vantix-style footer: aurora band on top, hairline dividers, link columns, big wordmark. */
export function Footer() {
  return (
    <footer className="relative mt-16 overflow-hidden border-t border-white/8">
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-70 [mask-image:linear-gradient(#000,transparent)]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(255,91,214,0.35), transparent 70%), radial-gradient(40% 80% at 20% 0%, rgba(79,124,255,0.35), transparent 70%), radial-gradient(40% 80% at 80% 0%, rgba(163,255,91,0.3), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 pt-24 pb-10">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2 font-semibold">
              <Logo /> NoLossMeme
            </div>
            <p className="mt-4 max-w-sm text-sm text-muted">
              Memecoins with a backed floor, built on NEAR with Meta Pool staking. Testnet software,
              not audited.
            </p>
            <a href={appLink()} className="mt-6 inline-flex items-center gap-3 text-lime">
              <span className="grid size-10 place-items-center rounded-full border border-lime/60">
                ↗
              </span>
              <span className="underline underline-offset-4">Open the app</span>
            </a>
          </div>
          <div>
            <h3 className="font-medium">Product</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>
                <a className="hover:text-text" href={appLink()}>
                  Live memes
                </a>
              </li>
              <li>
                <a className="hover:text-text" href={appLink("launch")}>
                  Launch a meme
                </a>
              </li>
              <li>
                <a className="hover:text-text" href="#how">
                  How it works
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium">Verify</h3>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>
                <a className="hover:text-text" href={REPO_URL} target="_blank" rel="noreferrer">
                  Source on GitHub
                </a>
              </li>
              <li>
                <a
                  className="hover:text-text"
                  href="https://testnet.nearblocks.io/address/pad.nolossmeme.testnet"
                  target="_blank"
                  rel="noreferrer"
                >
                  Factory on NearBlocks
                </a>
              </li>
              <li>
                <a
                  className="hover:text-text"
                  href="https://nearhackathon.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  NEAR HACKATHON
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-16 border-t border-dashed border-white/15 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted">
          <span>© 2026 NoLossMeme contributors · MIT</span>
          <span className="font-mono">pad.nolossmeme.testnet</span>
        </div>
        <div
          className="pointer-events-none select-none mt-6 display text-[clamp(3rem,14vw,11rem)] leading-none text-white/[0.04]"
          aria-hidden
        >
          NoLossMeme
        </div>
      </div>
    </footer>
  );
}
