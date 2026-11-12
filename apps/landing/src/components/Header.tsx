import { Logo } from "@nolossmeme/ui";

import { NETWORK_ID, REPO_URL, appLink } from "../lib/config";

/** Anchors point at the home page so they also work from /demo/. */
const HOME = import.meta.env.BASE_URL;

export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="glass flex h-14 items-center gap-3 rounded-full px-3 pl-4">
          <a href={HOME} className="flex items-center gap-2 font-semibold tracking-tight">
            <Logo />
            NoLossMeme
            <span className="pill hidden px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] sm:inline">
              {NETWORK_ID}
            </span>
          </a>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Primary">
            <a className="tab" href={`${HOME}#how`}>
              How it works
            </a>
            <a className="tab" href={`${HOME}#memes`}>
              Memes
            </a>
            <a className="tab" href={`${HOME}demo/`}>
              Demo
            </a>
            <a className="tab" href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={appLink()} className="btn-primary">
              Open app →
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
