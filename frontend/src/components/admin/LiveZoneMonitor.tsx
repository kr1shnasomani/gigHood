'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchLiveZones, HexZone } from '@/lib/admin/adminClient';

export default function LiveZoneMonitor() {
  const { data: zones = [] } = useQuery<HexZone[]>({
    queryKey: ['admin', 'zones'],
    queryFn: fetchLiveZones,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: 45_000,
  });

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden border border-stone-100 flex flex-col"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.04)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-[13px] font-bold text-stone-900 uppercase tracking-[0.12em]">
            Disruption Events
          </h2>
          <p className="text-[10px] text-stone-400 mt-0.5">Live DCI zone signals</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          <span className="text-[9px] font-black text-orange-600 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Zone feed — capped at 320px, scrollable inside the card */}
      <div className="overflow-y-auto p-4 space-y-2.5" style={{ maxHeight: 320 }}>
        {zones.map((zone, idx) => {
          const isDisrupted = zone.dci_score >= 0.85;
          const isAlert     = zone.dci_score >= 0.65 && zone.dci_score < 0.85;
          const barPct      = Math.round(zone.dci_score * 100);

          const borderColor = isDisrupted ? '#EF4444' : isAlert ? '#F59E0B' : '#10B981';
          const barColor    = isDisrupted
            ? 'from-red-400 to-red-500'
            : isAlert
              ? 'from-amber-400 to-orange-400'
              : 'from-emerald-400 to-emerald-500';
          const textColor   = isDisrupted ? 'text-red-600' : isAlert ? 'text-amber-600' : 'text-emerald-600';
          const bgColor     = isDisrupted ? '#FFF5F5' : isAlert ? '#FFFBEB' : '#F0FDF4';
          const label       = isDisrupted ? 'DISRUPTED' : isAlert ? 'ELEVATED' : 'NORMAL';
          const durationMin = 5 + ((idx * 7) % 20);

          return (
            <div
              key={`${zone.h3_index}-${idx}`}
              className="rounded-xl p-3 transition-all hover:scale-[1.01] cursor-default"
              style={{
                background: bgColor,
                borderLeft: `3px solid ${borderColor}`,
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
            >
              {/* Top row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-stone-800">{zone.city}</span>
                  <span
                    className={`text-[9px] font-black rounded-full px-2 py-0.5 uppercase tracking-wider ${textColor}`}
                    style={{ background: `${borderColor}18` }}
                  >
                    {label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-stone-400">{durationMin}m ago</span>
              </div>

              {/* DCI bar */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1 h-1.5 bg-white/80 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className={`text-[11px] font-black font-mono min-w-[34px] text-right ${textColor}`}>
                  {zone.dci_score.toFixed(2)}
                </span>
              </div>

              {/* Hex ID */}
              <p className="text-[9px] font-mono text-stone-400 truncate">{zone.h3_index}</p>
            </div>
          );
        })}

        {zones.length === 0 && (
          <div className="py-8 text-center text-stone-400 text-xs">
            <div className="text-2xl mb-2">🌐</div>
            No active disruption signals
          </div>
        )}
      </div>
    </div>
  );
}
