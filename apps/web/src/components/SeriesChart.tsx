import { formatNear } from "@nolossmeme/sdk";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { SnapshotRow } from "../lib/indexer";

/** TVL, treasury and floor over time from backend snapshots. */
export function SeriesChart({ rows }: { rows: SnapshotRow[] }) {
  const data = rows.map((r) => ({
    t: r.taken_at,
    tvl: Number(formatNear(r.total_principal, 4)),
    treasury: Number(formatNear(r.treasury_near, 6)),
    floor: Number(formatNear(r.floor_price, 10)),
  }));
  const fmtTime = (t: number) =>
    new Date(t).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="tvlFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f7cff" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#4f7cff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#1f1f2a" strokeDasharray="3 3" />
        <XAxis dataKey="t" stroke="#9a9aae" fontSize={11} tickFormatter={fmtTime} minTickGap={40} />
        <YAxis yAxisId="left" stroke="#9a9aae" fontSize={11} width={56} />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#a3ff5b"
          fontSize={11}
          width={64}
          tickFormatter={(v: number) => v.toExponential(1)}
        />
        <Tooltip
          contentStyle={{
            background: "#0c0c12",
            border: "1px solid #1f1f2a",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelFormatter={(l) => fmtTime(Number(l))}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="tvl"
          name="NEAR locked"
          stroke="#4f7cff"
          fill="url(#tvlFill)"
          strokeWidth={2}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="treasury"
          name="Treasury Ⓝ"
          stroke="#ffc857"
          fill="transparent"
          strokeWidth={2}
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="floor"
          name="Floor Ⓝ/MEME"
          stroke="#a3ff5b"
          fill="transparent"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
