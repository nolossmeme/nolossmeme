import { useRef } from "react";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { REPO_URL, appLink } from "./lib/config";

const BASE = import.meta.env.BASE_URL;
const NEARBLOCKS = "https://testnet.nearblocks.io/txns/";

/** Scene starts in docs/demo.mp4 (tools/video), seconds. */
const CHAPTERS: [number, string][] = [
  [0, "Why no-loss"],
  [12, "Where your NEAR goes"],
  [26, "Streak rules"],
  [44, "Live on testnet"],
  [60, "The draw"],
  [78, "Floor, redeem, withdraw"],
  [87, "Launch your own"],
];

/** The on-chain steps the video shows, all on NEAR testnet. */
const TXS: [string, string][] = [
  ["degen.nolossmeme.testnet deposits 1 Ⓝ", "C44SRCEb43CdiD4mpB5n1RYnzDuaby7D8aeTcN9d6zd9"],
  ["degen.nolossmeme.testnet checks in", "4wL7aSrpuftZ7QPtUrXTbAvCdim2EUs7W8wbpf6hNxT8"],
  ["nolossmeme.testnet checks in (target 2 / 2)", "GspgWT2KNdm8MXMnTWnWJUvFiAvRYff4QpLz3ymoocqi"],
  ["Draw #65: target hit, 1,000 DOGN minted", "2AVGBXsrgr3gFeD49UBhiikAtdeu7WkXwbceZX3tJJLt"],
];

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function DemoPage() {
  const video = useRef<HTMLVideoElement>(null);
  const seek = (s: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = s;
    void v.play();
  };
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 pt-32 pb-16">
        <span className="kicker">Demo · 99 seconds</span>
        <h1 className="display mt-3 text-4xl sm:text-6xl">
          See it work, <span className="gradient-lime">on chain</span>
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Deposit NEAR, check in, hit the community target and watch the draw mint. Narrated
          walkthrough of the live testnet app; every transaction in it is real.
        </p>

        <div className="card mt-10 overflow-hidden p-0">
          <video
            ref={video}
            className="block aspect-video w-full bg-black"
            src={`${BASE}demo.mp4`}
            poster={`${BASE}demo-poster.jpg`}
            controls
            playsInline
            preload="metadata"
            aria-label="NoLossMeme demo video, captions burned in"
          />
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1.3fr]">
          <section className="card p-6">
            <h2 className="font-semibold">Chapters</h2>
            <ol className="mt-4 space-y-1">
              {CHAPTERS.map(([s, title]) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => seek(s)}
                    className="flex w-full items-center gap-4 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="font-mono text-sm text-lime">{clock(s)}</span>
                    <span>{title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-6">
            <h2 className="font-semibold">Verify it yourself</h2>
            <p className="mt-2 text-sm text-muted">
              The transactions from the video, on NearBlocks (testnet).
            </p>
            <ul className="mt-4 space-y-3">
              {TXS.map(([what, hash]) => (
                <li key={hash} className="flex flex-col gap-0.5">
                  <span className="text-sm">{what}</span>
                  <a
                    className="truncate font-mono text-xs text-muted hover:text-lime"
                    href={`${NEARBLOCKS}${hash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hash} ↗
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <a href={appLink("m/dogn")} className="btn-primary">
            Try DOGN on testnet →
          </a>
          <a href={`${BASE}demo.mp4`} download className="btn-secondary">
            Download mp4
          </a>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-secondary">
            Source on GitHub
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
