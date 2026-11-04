import { formatMeme, formatNear } from "@nolossmeme/sdk";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ProjectionPoint } from "../lib/projection";

export function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  const data = points.map((p) => ({
    day: Math.round(p.day),
    supply: Number(formatMeme(p.supply, 0)),
    treasury: Number(formatNear(p.treasuryNear, 4)),
    floor: Number(formatNear(p.floor, 10)),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#262634" strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          stroke="#9b9bb3"
          fontSize={11}
          tickFormatter={(v: number) => `d${v}`}
        />
        <YAxis yAxisId="left" stroke="#9b9bb3" fontSize={11} width={60} />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="#ff5bd6"
          fontSize={11}
          width={60}
          tickFormatter={(v: number) => v.toExponential(1)}
        />
        <Tooltip
          contentStyle={{
            background: "#13131b",
            border: "1px solid #262634",
            borderRadius: 12,
            fontSize: 12,
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="supply"
          name="Supply (MEME)"
          stroke="#a3ff5b"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="treasury"
          name="Treasury (Ⓝ)"
          stroke="#ffc857"
          dot={false}
          strokeWidth={2}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="floor"
          name="Floor (Ⓝ/MEME)"
          stroke="#ff5bd6"
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
