'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRiskForecast, RiskForecast } from '@/lib/admin/adminClient';
import { TrendingUp } from 'lucide-react';

const CITY_FLAGS: Record<string, string> = {
  Chennai:   '🔴',
  Bengaluru: '🟠',
  Hyderabad: '🟡',
  Mumbai:    '🟢',
  Delhi:     '🔴',
  Kolkata:   '🟡',
};

export default function RiskForecastPanel() {
  const { data: forecast = [] } = useQuery<RiskForecast[]>({
    queryKey: ['admin', 'risk-forecast'],
    queryFn: fetchRiskForecast,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });

  const normalized = forecast.map(item => ({
    ...item,
    // API returns 0–1, normalise to 0–100 for display
    risk: item.risk <= 1 ? Math.round(item.risk * 100) : Math.round(item.risk),
  }));

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-stone-100 flex flex-col h-full"
         style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.04)' }}>

      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
            <TrendingUp size={14} className="text-orange-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-[14px] font-bold text-stone-900 tracking-tight">7-Day Predictive Risk</h3>
        </div>
        <p className="text-[10px] text-stone-400 ml-9">Forward zone risk confidence score</p>
      </div>

      {/* Bars */}
      <div className="flex-1 p-5">
        {normalized.length === 0 ? (
          <div className="space-y-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex justify-between mb-1.5">
                  <div className="h-3 w-20 bg-stone-100 rounded" />
                  <div className="h-3 w-8 bg-stone-100 rounded" />
                </div>
                <div className="h-2 w-full bg-stone-100 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {normalized.map(item => {
              const isHigh   = item.risk > 70;
              const isMed    = item.risk > 30 && item.risk <= 70;
              const barGrad  = isHigh ? 'from-red-400 to-orange-500' : isMed ? 'from-amber-400 to-orange-400' : 'from-emerald-400 to-emerald-500';
              const riskText = isHigh ? 'text-red-600' : isMed ? 'text-amber-600' : 'text-emerald-600';
              const flag     = CITY_FLAGS[item.city] || '📍';

              return (
                <div key={item.city} className="group">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-stone-700 flex items-center gap-1.5 text-[13px]">
                      <span className="text-base leading-none">{flag}</span>
                      {item.city}
                    </span>
                    <span className={`text-[13px] font-black font-mono ${riskText}`}>{item.risk}%</span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${barGrad} transition-all duration-700`}
                      style={{ width: `${item.risk}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="px-5 py-3 border-t border-stone-50 bg-stone-50/50">
        <p className="text-[10px] text-stone-400">
          Forecast updated every 6h · Based on DCI trend index
        </p>
      </div>
    </div>
  );
}
