import { NavLink, Outlet, useLocation } from "react-router-dom";

import { NETWORK_ID } from "../lib/client";
import { Logo } from "./Logo";
import { WalletButton } from "./WalletButton";

const links = [
  { to: "/memes", label: "Memes" },
  { to: "/launch", label: "Launch" },
  { to: "/how-it-works", label: "How it works" },
];

export function Layout() {
  const { pathname } = useLocation();
  const landing = pathname === "/";
  return (
    <div className="min-h-screen flex flex-col">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="glass rounded-full h-14 px-3 pl-4 flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <Logo />
              NoLossMeme
              <span className="hidden sm:inline pill py-0.5 px-2 text-[10px] tracking-[0.14em] uppercase">
                {NETWORK_ID}
              </span>
            </NavLink>
            <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Primary">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) => `tab ${isActive ? "tab-active" : ""}`}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              {landing && (
                <NavLink to="/memes" className="btn-secondary hidden sm:inline-flex">
                  Open app
                </NavLink>
              )}
              <WalletButton />
            </div>
          </div>
        </div>
      </header>
      <main className={`flex-1 w-full ${landing ? "" : "mx-auto max-w-6xl px-4 pt-28 pb-16"}`}>
        <Outlet />
      </main>
      {!landing && (
        <footer className="border-t border-border text-muted text-xs">
          <div className="mx-auto max-w-6xl px-4 py-6 flex flex-wrap gap-4 justify-between">
            <span>
              Built at NEAR HACKATHON 2026. Principal is never at risk; only staking yield is
              played.
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
      )}
    </div>
  );
}
