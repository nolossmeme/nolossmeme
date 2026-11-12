import { Logo } from "@nolossmeme/ui";
import { NavLink, Outlet } from "react-router-dom";

import { LANDING_URL, NETWORK_ID } from "../lib/client";
import { WalletButton } from "./WalletButton";

const links = [
  { to: "/", label: "Memes" },
  { to: "/launch", label: "Launch" },
  { to: "/faucet", label: "Faucet" },
  { to: "/how-it-works", label: "How it works" },
];

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="glass rounded-full h-14 px-3 pl-4 flex items-center gap-3">
            <a
              href={LANDING_URL}
              className="flex items-center gap-2 font-semibold tracking-tight"
              title="Back to the landing page"
            >
              <Logo />
              NoLossMeme
              <span className="hidden sm:inline pill py-0.5 px-2 text-[10px] tracking-[0.14em] uppercase">
                {NETWORK_ID}
              </span>
            </a>
            <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Primary">
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
        </div>
      </header>
      <main className="flex-1 w-full mx-auto max-w-6xl px-4 pt-28 pb-24 md:pb-16">
        <Outlet />
      </main>
      <nav
        className="md:hidden fixed inset-x-4 bottom-4 z-40 glass rounded-full h-12 flex items-center justify-around px-2"
        aria-label="Primary mobile"
      >
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) => `tab text-xs ${isActive ? "tab-active" : ""}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <footer className="border-t border-border text-muted text-xs">
        <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-4 justify-between">
          <span>
            Built at NEAR HACKATHON 2026. Principal is never at risk; only staking yield is played.
          </span>
          <span className="flex gap-4">
            <a className="hover:text-text" href={LANDING_URL}>
              About
            </a>
            <a
              className="hover:text-text"
              href="https://github.com/nolossmeme/nolossmeme"
              target="_blank"
              rel="noreferrer"
            >
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
