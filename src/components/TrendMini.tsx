"use client";
import { ResponsiveContainer, LineChart, Line, Tooltip } from "recharts";

export default function TrendMini({ data }:{ data:{x:string|number;y:number}[] }) {
  return (
    <div className="mt-2 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line type="monotone" dataKey="y" stroke="var(--brand)" strokeWidth={2} dot={false} />
          <Tooltip contentStyle={{ fontSize: 12 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
