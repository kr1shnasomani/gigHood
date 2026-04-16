'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchKPIs, AdminKPIs } from '@/lib/admin/adminClient';
import { TrendingUp, Wallet, Activity, ShieldAlert } from 'lucide-react';

const ICONS = [TrendingUp, Wallet, Activity, ShieldAlert];

// Orange-themed accent colors per card
const ACCENTS = [
  { light: '#FFF7ED', border: '#FED7AA', icon: '#F97316', bar: 'from-orange-400 to-orange-500' },
  { light: '#FFF7ED', border: '#FED7AA', icon: '#EA580C', bar: 'from-amber-400 to-orange-400' },
  { light: '#FAFAFA', border: '#E2E8F0', icon: '#6366F1', bar: 'from-indigo-400 to-violet-500' },
  { light: '#FFF7ED', border: '#FED7AA', icon: '#F59E0B', bar: 'from-amber-400 to-yellow-500' },
];

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 animate-pulse"
         style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between mb-4">
        <div className="h-9 w-9 rounded-xl bg-stone-100" />
        <div className="h-4 w-12 rounded-full bg-stone-100" />
      </div>
      <div className="h-7 w-28 rounded-lg bg-stone-100 mb-2" />
      <div className="h-3 w-40 rounded-full bg-stone-100 mb-4" />
      <div className="h-1.5 w-full rounded-full bg-stone-100" />
    </div>
  );
}

export default function FinancialKPIs() {
  const { data: kpis } = useQuery<AdminKPIs>({
    queryKey: ['admin', 'kpis'],
    queryFn: fetchKPIs,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  if (!kpis) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const bcr = kpis.total_premium > 0 ? (kpis.total_claims_paid / kpis.total_premium) : 0;
  const lossRatio = kpis.system_loss_ratio;
  const lossRatioPercent = lossRatio * 100;
  const enrollmentsSuspended = lossRatioPercent > 85;
  const maxAmount = Math.max(1, Math.round(kpis.total_premium), Math.round(kpis.total_claims_paid));
  const formatINR = (value: number) => `₹${Math.round(value).toLocaleString('en-US')}`;

  const kpiData = [
    {
      label:   'Total Disbursed',
      value:   formatINR(kpis.total_claims_paid),
      raw:     kpis.total_claims_paid,
      caption: 'Approved + paid claims',
      trend:   'Live',
      trendUp: true,
      pct:     Math.min((kpis.total_claims_paid / maxAmount) * 100, 100),
    },
    {
      label:   'Premiums Collected',
      value:   formatINR(kpis.total_premium),
      raw:     kpis.total_premium,
      caption: 'Sum of active policy premiums',
      trend:   'Live',
      trendUp: true,
      pct:     Math.min((kpis.total_premium / maxAmount) * 100, 100),
    },
    {
      label:   'BCR (Burning Cost Rate)',
      value:   bcr.toFixed(2),
      raw:     bcr,
      caption: 'Total disbursed ÷ premiums collected',
      trend:   bcr > 0.6 ? '⚠ High' : 'Normal',
      trendUp: false,
      pct:     Math.min(bcr * 100, 100),
    },
    {
      label:   'Loss Ratio',
      value:   `${lossRatioPercent.toFixed(1)}%`,
      raw:     lossRatio,
      caption: 'Guardrail threshold: 85%',
      trend:   lossRatioPercent > 85 ? '⚠ Over limit' : 'Within limit',
      trendUp: lossRatioPercent <= 85,
      pct:     Math.min(lossRatioPercent, 100),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiData.map((item, idx) => {
          const Icon   = ICONS[idx];
          const accent = ACCENTS[idx];
          return (
            <div
              key={idx}
              className="group bg-white rounded-2xl border p-5 relative overflow-hidden cursor-default transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: accent.border,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(249,115,22,0.04)',
              }}
            >
              {/* Subtle bg halo */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style={{ background: `radial-gradient(circle at 80% 20%, ${accent.light} 0%, transparent 60%)` }} />

              <div className="relative">
                {/* Top row: icon + trend badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                       style={{ background: accent.light, border: `1px solid ${accent.border}` }}>
                    <Icon size={16} style={{ color: accent.icon }} strokeWidth={2.5} />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    item.trendUp
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      : 'bg-red-50 text-red-500 border border-red-100'
                  }`}>
                    {item.trend}
                  </span>
                </div>

                {/* Value */}
                <p className="text-2xl font-bold text-stone-900 tracking-tight leading-none mb-1">
                  {item.value}
                </p>

                {/* Label */}
                <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.14em] mb-3">
                  {item.label}
                </p>

                {/* Progress bar */}
                <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-700`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>

                {/* Caption */}
                <p className="text-[10px] text-stone-400 mt-2">{item.caption}</p>
              </div>
            </div>
          );
        })}
      </div>

      {enrollmentsSuspended && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 flex items-start gap-3">
          <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-red-700">New Enrollments Suspended</p>
            <p className="text-xs text-red-500 mt-0.5">
              Loss ratio has exceeded 85%. Temporarily pause onboarding until underwriting balance is restored.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
