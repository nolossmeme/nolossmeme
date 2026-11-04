import { NavLink, Outlet } from "react-router-dom";

import { NETWORK_ID } from "../lib/client";
import { WalletButton } from "./WalletButton";

const links = [
  { to: "/", label: "Memes" },
  { to: "/launch", label: "Launch" },
  { to: "/how-it-works", label: "How it works" },
];

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur bg-bg/80 border-b border-border">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center gap-6">
          <NavLink to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="inline-block size-6 rounded-md bg-lime" aria-hidden />
            NoLossMeme
            <span className="text-[10px] uppercase tracking-wider text-muted border border-border rounded px-1.5 py-0.5">
              {NETWORK_ID}
            </span>
          </NavLink>
          <nav className="hidden sm:flex items-center gap-1 ml-4">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <WalletButton />
          </div>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border text-muted text-xs">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-4 justify-between">
          <span>
            Built at NEAR HACKATHON 2026. Principal is never at risk; only staking yield is played.
          </span>
          <a
            className="hover:text-text"
            href="https://github.com/nolossmeme/nolossmeme"
            target="_blank"
            rel="noreferrer"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
