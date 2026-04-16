'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchFraudQueue, FraudQueueItem } from '@/lib/admin/adminClient';
import { Zap, Clock, Eye, ChevronRight } from 'lucide-react';

type FilterTab = 'All' | 'Fast Track' | 'Review Paths';

function normalizePathLabel(path: string | null | undefined, flags: string[] | undefined, fraudScore: number | null | undefined): string {
  const normalized = (path || '').toLowerCase();
  if (normalized === 'fast_track')    return 'Fast Track';
  if (normalized === 'soft_queue')    return 'Soft Queue';
  if (normalized === 'active_verify') return 'Active Verify';
  if ((flags?.length ?? 0) === 0)     return 'Fast Track';
  if ((fraudScore ?? 0) > 70)         return 'Active Verify';
  return 'Soft Queue';
}

function formatDciScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function formatFraudScore(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.round(value);
}

const PATH_STYLE: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
  'Fast Track':    { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: <Zap size={10} /> },
  'Soft Queue':    { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   icon: <Clock size={10} /> },
  'Active Verify': { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200',  icon: <Eye size={10} /> },
};

const STATUS_DOT: Record<string, string> = {
  paid:           'bg-emerald-500',
  verified:       'bg-emerald-400',
  pending:        'bg-amber-500',
  verifying:      'bg-orange-500',
  under_review:   'bg-orange-400',
  denied:         'bg-red-500',
};

export default function FraudQueue() {
  const [activeTab,  setActiveTab]  = useState<FilterTab>('All');

  const { data } = useQuery<FraudQueueItem[]>({
    queryKey: ['admin', 'fraud-queue'],
    queryFn: fetchFraudQueue,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  });

  const allRows = (data ?? []).slice(0, 6);

  const filtered = allRows.filter(item => {
    if (activeTab === 'All')         return true;
    if (activeTab === 'Fast Track')  return normalizePathLabel(item.resolution_path, item.flags, item.fraud_score) === 'Fast Track';
    if (activeTab === 'Review Paths') return normalizePathLabel(item.resolution_path, item.flags, item.fraud_score) !== 'Fast Track';
    return true;
  });

  const tabs: FilterTab[] = ['All', 'Fast Track', 'Review Paths'];

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-stone-100"
         style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.04)' }}>

      {/* Header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-stone-900 tracking-tight">Claims Pipeline</h2>
          <p className="text-[11px] text-stone-400 mt-0.5">Latest claims queued by decision route</p>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 p-1 rounded-xl">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: '#FAFAF8' }}>
              {['Claim ID', 'Worker', 'Zone', 'DCI Score', 'Fraud Risk', 'Path', 'Payout', ''].map(h => (
                <th key={h} className="px-5 py-3 text-[9px] font-bold text-stone-400 uppercase tracking-[0.2em] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(item => {
              const pathLabel  = normalizePathLabel(item.resolution_path, item.flags, item.fraud_score);
              const pathStyle  = PATH_STYLE[pathLabel] || PATH_STYLE['Soft Queue'];
              const fraudScore = formatFraudScore(item.fraud_score);
              const fraudPct   = fraudScore;
              const dotColor   = STATUS_DOT[item.status] || 'bg-stone-300';

              let fraudBarColor = 'from-emerald-400 to-emerald-500';
              if (fraudScore > 70)      fraudBarColor = 'from-red-400 to-red-500';
              else if (fraudScore > 30) fraudBarColor = 'from-amber-400 to-orange-400';

              return (
                <tr key={item.claim_id}
                    className="group border-t border-stone-50 hover:bg-orange-50/40 transition-colors cursor-pointer">

                  {/* Claim ID */}
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-bold text-stone-900 font-mono">{item.claim_id}</span>
                  </td>

                  {/* Worker */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                      <span className="text-[13px] text-stone-700 font-medium">{item.worker_name}</span>
                    </div>
                  </td>

                  {/* Zone */}
                  <td className="px-5 py-3.5">
                    <span className="text-[12px] text-stone-400 font-mono">{item.city}</span>
                  </td>

                  {/* DCI */}
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-bold text-stone-800 font-mono">{formatDciScore(item.dci_score)}</span>
                  </td>

                  {/* Fraud risk bar */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5 min-w-[80px]">
                      <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${fraudBarColor} transition-all`}
                             style={{ width: `${fraudPct}%` }} />
                      </div>
                      <span className={`text-[11px] font-bold min-w-[22px] ${
                        fraudScore > 70 ? 'text-red-500' : fraudScore > 30 ? 'text-amber-500' : 'text-emerald-500'
                      }`}>
                        {fraudScore}
                      </span>
                    </div>
                  </td>

                  {/* Path */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.08em] border ${pathStyle.bg} ${pathStyle.text} ${pathStyle.border}`}>
                      {pathStyle.icon}
                      {pathLabel}
                    </span>
                  </td>

                  {/* Payout */}
                  <td className="px-5 py-3.5">
                    <span className={`text-[13px] font-bold font-mono ${item.payout > 0 ? 'text-stone-900' : 'text-stone-300'}`}>
                      {item.payout > 0 ? `₹${Math.round(item.payout).toLocaleString()}` : '—'}
                    </span>
                  </td>

                  {/* Arrow */}
                  <td className="px-4 py-3.5">
                    <ChevronRight size={14} className="text-stone-300 group-hover:text-orange-400 transition-colors" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-stone-400 text-sm">No claims match this filter.</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-stone-50 flex items-center justify-between">
        <span className="text-[11px] text-stone-400">Showing {filtered.length} of {allRows.length} claims</span>
        <button className="text-[11px] font-semibold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors">
          View all claims <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}
