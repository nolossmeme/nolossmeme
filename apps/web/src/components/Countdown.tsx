import { formatCountdown, useCountdown } from "../hooks/useCountdown";

export function Countdown({
  targetMs,
  dueLabel = "Draw is due",
}: {
  targetMs: number | undefined;
  dueLabel?: string;
}) {
  const seconds = useCountdown(targetMs);
  if (targetMs === undefined) return <span className="font-mono">—</span>;
  if (seconds === 0) return <span className="font-mono text-lime">{dueLabel}</span>;
  return <span className="font-mono tabular-nums">{formatCountdown(seconds)}</span>;
}
