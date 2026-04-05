'use client';

import { useEffect, useState } from 'react';
import { fetchLiveZones, HexZone } from '@/lib/admin/adminClient';

export default function LiveZoneMonitor() {
  const [zones, setZones] = useState<HexZone[]>([]);

  useEffect(() => {
    fetchLiveZones().then(setZones).catch(console.error);
  }, []);

  return (
    <div className="bg-[#111827] rounded-2xl shadow-[0_20px_40px_rgba(15,23,42,0.25)] p-5 text-white overflow-hidden relative border border-white/5 h-full">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-slate-200">Disruption Events</h2>
        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-[#EF4444] rounded text-[9px] font-black uppercase tracking-wider">Live</span>
      </div>
      
      <div className="space-y-3 font-mono overflow-y-auto max-h-[420px] pr-2 custom-scrollbar">
        {zones.map((zone, idx) => {
          const isDisrupted = zone.dci_score >= 0.85;
          const isAlert = zone.dci_score >= 0.65 && zone.dci_score < 0.85;
          const statusColor = isDisrupted ? 'border-[#EF4444]' : (isAlert ? 'border-amber-500' : 'border-slate-700');
          const dciTextColor = isDisrupted ? 'text-[#EF4444]' : (isAlert ? 'text-amber-500' : 'text-slate-300');
          const durationMinutes = 5 + ((idx * 7) % 20);

          return (
            <div key={`${zone.h3_index}-${idx}`} className={`p-3 bg-white/5 rounded-lg border-l-2 ${statusColor} transition-all hover:bg-white/10 cursor-default`}>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>T: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                <span>ID: {zone.h3_index}</span>
              </div>
              <p className="text-[11px] font-bold text-white">
                DCI Peak: <span className={dciTextColor}>{zone.dci_score.toFixed(2)}</span> · Dur: {durationMinutes}m
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                {isDisrupted ? `Critical disruption signals in ${zone.city}.` : 
                 (isAlert ? `Elevated risk signals in ${zone.city}.` : `Resolved: Under trigger threshold.`)}
              </p>
            </div>
          );
        })}
        {zones.length === 0 && (
          <div className="p-4 text-center text-slate-500 text-xs">No active disruption signals</div>
        )}
      </div>
    </div>
  );
}
