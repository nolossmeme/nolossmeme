import type { ReactNode } from "react";

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="card glow-top p-5">
      <div className="kicker">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${accent ? "text-lime" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}
