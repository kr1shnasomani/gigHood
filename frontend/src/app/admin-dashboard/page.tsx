'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import FinancialKPIs from '@/components/admin/FinancialKPIs';
import FraudQueue from '@/components/admin/FraudQueue';
import LiveZoneMonitor from '@/components/admin/LiveZoneMonitor';
import RiskForecastPanel from '@/components/admin/RiskForecast';
import {
  fetchFraudQueue,
  fetchPayoutTrends,
  FraudQueueItem,
  MonthlyTrend,
} from '@/lib/admin/adminClient';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Home, ChevronRight, Shield, AlertTriangle, TrendingUp } from 'lucide-react';

// Custom tooltip for the chart
const ChartTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-stone-100 rounded-xl px-3 py-2.5 shadow-lg text-sm">
        <p className="text-stone-400 text-[10px] uppercase tracking-wider mb-1">{label}</p>
        <p className="font-bold text-stone-900">₹{Math.round(payload[0].value).toLocaleString('en-US')}</p>
      </div>
    );
  }
  return null;
};

export default function AdminOverviewPage() {
  const [activeBar, setActiveBar] = useState<number | null>(null);

  const { data: chartData = [] } = useQuery<MonthlyTrend[]>({
    queryKey: ['admin', 'payout-trends'],
    queryFn: fetchPayoutTrends,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const { data: queue = [] } = useQuery<FraudQueueItem[]>({
    queryKey: ['admin', 'fraud-queue'],
    queryFn: fetchFraudQueue,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  const data          = chartData;
  const highRisk      = queue.filter(i => i.fraud_score > 70).length;
  const medRisk       = queue.filter(i => i.fraud_score > 30 && i.fraud_score <= 70).length;
  const lowRisk       = queue.filter(i => i.fraud_score <= 30).length;
  const total         = queue.length || 1;
  const fraudBands    = [
    { label: 'High risk',   value: highRisk, pct: Math.round((highRisk / total) * 100),  barColor: 'from-red-400 to-red-500',         dot: 'bg-red-500' },
    { label: 'Medium risk', value: medRisk,  pct: Math.round((medRisk  / total) * 100),  barColor: 'from-amber-400 to-orange-400',     dot: 'bg-amber-500' },
    { label: 'Low risk',    value: lowRisk,  pct: Math.round((lowRisk  / total) * 100),  barColor: 'from-emerald-400 to-emerald-500',  dot: 'bg-emerald-500' },
  ];

  return (
    <div className="p-7 space-y-7">

      {/* ── HERO SECTION ──────────────────────────────────── */}
      <section className="relative rounded-2xl overflow-hidden border border-orange-100"
               style={{
                 background: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 60%, #FEF3E2 100%)',
                 boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 8px 32px rgba(249,115,22,0.08)',
               }}>
        {/* decorative orange glow blobs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/3 w-40 h-20 pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />

        <div className="relative px-7 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-[11px] text-stone-400 mb-4">
            <Home size={11} />
            <span className="mx-1">·</span>
            <span className="hover:text-orange-500 cursor-pointer transition-colors">Admin</span>
            <ChevronRight size={11} className="text-stone-300" />
            <span className="text-stone-700 font-semibold">Command Overview</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-1">
                Admin Operations
              </p>
              <h1 className="text-3xl font-black text-stone-900 tracking-tight leading-tight">
                Command Overview
              </h1>
              <p className="text-sm text-stone-500 mt-2 max-w-md">
                Risk, payouts, fraud, and disruption monitoring in one control view.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Live badge */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-[11px] font-bold shadow-md"
                   style={{ boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                LIVE STREAM ACTIVE
              </div>
            </div>
          </div>

          {/* Mini stat row */}
          <div className="mt-5 flex flex-wrap gap-6">
            {[
              { icon: Shield,        label: 'System Health', value: 'Operational', color: 'text-emerald-600' },
              { icon: AlertTriangle, label: 'Active Alerts',  value: `${highRisk} critical`, color: 'text-orange-600' },
              { icon: TrendingUp,    label: 'This Sprint',    value: 'Apr 2026', color: 'text-stone-600' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-2">
                  <Icon size={13} className={stat.color} />
                  <span className="text-[11px] text-stone-400">{stat.label}:</span>
                  <span className={`text-[11px] font-bold ${stat.color}`}>{stat.value}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── KPI STRIP ─────────────────────────────────────── */}
      <FinancialKPIs />

      {/* ── CHART + FORECAST ──────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6">

        {/* Payout chart */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-stone-100 p-6"
             style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.04)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Payout Trends</h2>
              <p className="text-[11px] text-stone-400 mt-0.5">Monthly disbursement volume · 2026</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-[11px] text-stone-500">Payouts (₹)</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barCategoryGap="35%" onMouseLeave={() => setActiveBar(null)}>
              <CartesianGrid strokeDasharray="4 4" stroke="#F5F5F4" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8A29E', fontSize: 11, fontWeight: 600 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8A29E', fontSize: 11 }}
                tickFormatter={v => `₹${Math.round(v).toLocaleString('en-US')}`}
                width={52}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(249,115,22,0.05)', radius: 8 }} />
              <Bar dataKey="payouts" radius={[8, 8, 0, 0]} maxBarSize={48}
                   onMouseEnter={(_, idx) => setActiveBar(idx)}>
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={activeBar === idx
                      ? '#EA580C'
                      : activeBar !== null
                        ? '#FED7AA'
                        : '#F97316'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {data.length === 0 && (
            <div className="mt-4 text-center text-xs text-stone-400">No payout trend data available yet.</div>
          )}
        </div>

        {/* Risk forecast */}
        <div className="col-span-12 lg:col-span-4">
          <RiskForecastPanel />
        </div>
      </div>

      {/* ── CLAIMS PIPELINE + LIVE ZONES ──────────────────── */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <FraudQueue />
        </div>
        <div className="col-span-12 lg:col-span-4">
          <LiveZoneMonitor />
        </div>
      </div>

      {/* ── FRAUD SIGNAL BREAKDOWN ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-100 p-6"
           style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.04)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Fraud Signal Breakdown</h2>
            <p className="text-[11px] text-stone-400 mt-0.5">Risk distribution across the active claims pipeline</p>
          </div>
          <span className="text-[11px] text-stone-400 font-mono">{queue.length} total claims</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fraudBands.map(band => (
            <div key={band.label} className="space-y-3">
              {/* Label row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${band.dot}`} />
                  <span className="text-[12px] font-semibold text-stone-700">{band.label} claims</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-stone-900">{band.pct}</span>
                  <span className="text-[10px] text-stone-400">%</span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2.5 w-full bg-stone-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${band.barColor} transition-all duration-700`}
                  style={{ width: `${band.pct}%` }}
                />
              </div>

              {/* Count */}
              <p className="text-[11px] text-stone-400">
                {band.value} claim{band.value !== 1 ? 's' : ''} in this band
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}