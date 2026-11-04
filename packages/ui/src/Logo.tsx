export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="nlm-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a3ff5b" />
          <stop offset="1" stopColor="#ff5bd6" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="22" fill="none" stroke="url(#nlm-g)" strokeWidth="7" />
      <path d="M20 32h24M32 20v24" stroke="url(#nlm-g)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}
