import { formatNear, type Draw } from "@nolossmeme/sdk";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function FloorChart({ draws }: { draws: Draw[] }) {
  if (draws.length < 2) {
    return <p className="text-sm text-muted">The floor chart appears after two draws.</p>;
  }
  const data = draws.map((d) => ({
    epoch: d.epoch,
    floor: Number(formatNear(d.floor_after, 8)),
    treasury: Number(formatNear(d.yield_near, 6)),
  }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="floorFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a3ff5b" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#a3ff5b" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#262634" strokeDasharray="3 3" />
        <XAxis
          dataKey="epoch"
          stroke="#9b9bb3"
          fontSize={11}
          tickFormatter={(v: number) => `#${v}`}
        />
        <YAxis
          stroke="#9b9bb3"
          fontSize={11}
          width={70}
          tickFormatter={(v: number) => v.toExponential(1)}
        />
        <Tooltip
          contentStyle={{
            background: "#13131b",
            border: "1px solid #262634",
            borderRadius: 12,
            fontSize: 12,
          }}
          formatter={(value) => [`${String(value)} Ⓝ`, "Floor per MEME"]}
          labelFormatter={(l) => `Epoch #${String(l)}`}
        />
        <Area
          type="monotone"
          dataKey="floor"
          stroke="#a3ff5b"
          fill="url(#floorFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
