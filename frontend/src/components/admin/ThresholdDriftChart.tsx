"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "@/lib/api";

type DriftData = {
  week: string;
  approve_threshold: number;
  deny_threshold: number;
  override_rate: number;
};

export default function ThresholdDriftChart() {
  const [data, setData] = useState<DriftData[]>([]);

  useEffect(() => {
    api
      .get<DriftData[]>("/admin/fraud/threshold-drift")
      .then((r) => setData(r.data))
      .catch(console.error);
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">
          Threshold Drift Analytics
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Adaptive threshold evolution tracking the machine learning feedback
          loop based on admin overrides.
        </p>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748B" }}
              dy={10}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748B" }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#64748B" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "none",
                boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
              }}
              itemStyle={{ fontSize: "13px" }}
              labelStyle={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#0F172A",
                marginBottom: "4px",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
            <Line
              yAxisId="left"
              type="monotone"
              name="Approve Limit"
              dataKey="approve_threshold"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4, fill: "#10B981", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              name="Deny Limit"
              dataKey="deny_threshold"
              stroke="#EF4444"
              strokeWidth={3}
              dot={{ r: 4, fill: "#EF4444", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              name="Override Rate"
              dataKey="override_rate"
              stroke="#8B5CF6"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
