"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type SalesChartProps = {
  data: Array<{
    month: string;
    sales: number;
  }>;
};

export function SalesChart({ data }: SalesChartProps) {
  return (
    <div className="w-full h-64 sm:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#64748B", fontSize: 12 }}
            stroke="#64748B"
          />
          <YAxis
            tick={{ fill: "#64748B", fontSize: 12 }}
            stroke="#64748B"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "8px",
              color: "#102A56",
            }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#1677FF"
            strokeWidth={2}
            dot={{ fill: "#1677FF", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
