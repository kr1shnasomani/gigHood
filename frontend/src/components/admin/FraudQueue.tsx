'use client';

import { useEffect, useState } from 'react';
import { fetchFraudQueue, FraudQueueItem } from '@/lib/admin/adminClient';

function normalizePathLabel(path: string | null | undefined, flags: string[] | undefined, fraudScore: number | null | undefined): string {
  const normalized = (path || '').toLowerCase();
  if (normalized === 'fast_track') return 'Fast Track';
  if (normalized === 'soft_queue') return 'Soft Queue';
  if (normalized === 'active_verify') return 'Active Verify';

  if ((flags?.length ?? 0) === 0) return 'Fast Track';
  if ((fraudScore ?? 0) > 70) return 'Active Verify';
  return 'Soft Queue';
}

function formatDciScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return value.toFixed(2);
}

function formatFraudScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return Math.round(value).toString().padStart(2, '0');
}

export default function FraudQueue() {
  const [queue, setQueue] = useState<FraudQueueItem[]>([]);

  useEffect(() => {
    fetchFraudQueue().then(setQueue).catch(console.error);
  }, []);

  const demoRows: FraudQueueItem[] = [
    { claim_id: 'CL-9902', created_at: '2026-04-05T10:12:00Z', worker_name: 'Rajesh Kumar', city: 'MH-E12', status: 'paid', resolution_path: 'fast_track', fraud_score: 4, dci_score: 0.72, payout: 450.00, flags: [] },
    { claim_id: 'CL-9903', created_at: '2026-04-05T10:18:00Z', worker_name: 'Ananya S.', city: 'KA-B08', status: 'pending', resolution_path: 'soft_queue', fraud_score: 18, dci_score: 0.58, payout: 0.00, flags: ['soft_queue'] },
    { claim_id: 'CL-9904', created_at: '2026-04-05T10:22:00Z', worker_name: 'Vikram Singh', city: 'DL-S14', status: 'verifying', resolution_path: 'active_verify', fraud_score: 62, dci_score: 0.81, payout: 0.00, flags: ['active_verify'] },
    { claim_id: 'CL-9905', created_at: '2026-04-05T10:28:00Z', worker_name: 'Priya Dash', city: 'TS-W21', status: 'denied', resolution_path: 'soft_queue', fraud_score: 88, dci_score: 0.92, payout: 0.00, flags: ['soft_queue'] },
    { claim_id: 'CL-9906', created_at: '2026-04-05T10:30:00Z', worker_name: 'Arjun Mehra', city: 'MH-E12', status: 'paid', resolution_path: 'fast_track', fraud_score: 2, dci_score: 0.34, payout: 320.50, flags: [] },
  ];

  const rows = queue.length > 0 ? queue.slice(0, 6) : demoRows;

  return (
    <div className="bg-white rounded-2xl shadow-[0_20px_40px_rgba(15,23,42,0.08)] border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#0F172A]">Claims Pipeline</h2>
          <p className="text-[11px] text-slate-500">Latest claims queued by route</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-100/70 p-1 rounded-full">
          <button className="px-3 py-1 text-[11px] font-semibold bg-white text-slate-900 rounded-full shadow-sm">All</button>
          <button className="px-3 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-all whitespace-nowrap">Path 1</button>
          <button className="px-3 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition-all whitespace-nowrap">Path 2</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em]">Claim ID</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em]">Worker</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em]">Zone</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em] text-center">DCI</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em] text-center">Fraud</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em]">Path</th>
              <th className="px-5 py-3 text-[9px] font-semibold text-slate-500 uppercase tracking-[0.18em]">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((item) => {
              let fraudScoreColor = 'text-emerald-500';
              if ((item.fraud_score ?? 0) > 70) fraudScoreColor = 'text-rose-500';
              else if ((item.fraud_score ?? 0) > 30) fraudScoreColor = 'text-amber-500';
              const pathLabel = normalizePathLabel(item.resolution_path, item.flags, item.fraud_score);

              return (
                <tr key={item.claim_id} className="hover:bg-slate-50 transition-all cursor-pointer">
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900">{item.claim_id}</td>
                  <td className="px-5 py-3 text-sm text-slate-700">{item.worker_name}</td>
                  <td className="px-5 py-3 text-sm text-slate-500">{item.city}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-slate-900 text-center">
                    {formatDciScore(item.dci_score)}
                  </td>
                  <td className={`px-5 py-3 text-sm font-semibold text-center ${fraudScoreColor}`}>
                    {formatFraudScore(item.fraud_score)}
                  </td>
                  <td className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{pathLabel}</td>
                  <td className="px-5 py-3 text-sm font-semibold">₹{Math.round(item.payout ?? 0).toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
