'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Home, IndianRupee, PieChart, Activity, Zap } from 'lucide-react';
import {
  fetchPayoutSummary,
  fetchRecentPayouts,
  PayoutSummary,
  PayoutItem,
} from '@/lib/admin/adminClient';

export default function PayoutSummaryPage() {
  const [summary, setSummary] = useState<PayoutSummary | null>(null);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);

  useEffect(() => {
    fetchPayoutSummary().then(setSummary).catch(console.error);
    fetchRecentPayouts().then(setPayouts).catch(console.error);
  }, []);

  if (!summary) {
    return (
      <div className="p-7 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_16px_rgba(249,115,22,0.3)]" />
      </div>
    );
  }

  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid rgba(249,115,22,0.12)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.05)',
  };

  return (
    <div className="p-7 space-y-7 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div>
        <nav className="flex items-center gap-1 text-[11px] text-stone-400 mb-3">
          <Home size={11} />
          <span className="mx-1">·</span>
          <span className="hover:text-orange-500 cursor-pointer transition-colors">Admin</span>
          <ChevronRight size={11} className="text-stone-300" />
          <span className="text-stone-700 font-semibold">Payout Summary</span>
        </nav>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              Ledger Disbursements
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Real-time analytics & financial tracking for parametric payouts.
            </p>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Payout volume card */}
        <div className="bg-gradient-to-br from-[#1c1917] to-[#292524] text-white p-6 rounded-2xl relative overflow-hidden"
             style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 60%)' }} />
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            Payout Volume (Mn) <Zap size={11} className="text-orange-400" />
          </p>
          <div className="text-4xl font-black text-orange-400 font-mono tracking-tight mt-1">
            {(summary.total_payouts / 1000000).toFixed(2)}
          </div>
          <p className="text-[11px] font-semibold text-stone-400 mt-2">
            Based on current disbursement totals
          </p>
        </div>

        {/* Standard KPIs */}
        <div style={cardStyle} className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <IndianRupee size={48} className="text-orange-500" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
            Total Payouts
          </p>
          <h3 className="text-3xl font-black text-stone-900 font-mono mt-2 tracking-tight">
            ₹{summary.total_payouts.toLocaleString()}
          </h3>
        </div>

        <div style={cardStyle} className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <PieChart size={48} className="text-orange-500" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
            Avg Payout
          </p>
          <h3 className="text-3xl font-black text-stone-900 font-mono mt-2 tracking-tight">
            ₹{Math.round(summary.avg_payout).toLocaleString()}
          </h3>
        </div>

        <div style={cardStyle} className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Activity size={48} className="text-emerald-500" />
          </div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">
            Success Rate
          </p>
          <h3 className="text-3xl font-black text-stone-900 font-mono mt-2 tracking-tight flex items-end gap-1">
            {summary.success_rate.toFixed(1)}<span className="text-lg text-emerald-500">%</span>
          </h3>
        </div>
      </div>

      {/* TABLE */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex justify-between items-center bg-[#FAFAF8]">
          <h2 className="text-[14px] font-bold text-stone-900 tracking-tight">
            Recent Disbursement Logs
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                {['ID', 'Worker', 'Amount', 'Date', 'Status'].map(h => (
                  <th key={h} className="px-6 py-4 text-left text-[9px] font-black uppercase text-stone-400 tracking-[0.2em] bg-white">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {payouts.map((item) => (
                <tr key={item.id} className="border-b border-stone-50 hover:bg-orange-50/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-stone-500">{item.id}</td>
                  <td className="px-6 py-4 font-bold text-stone-800 text-[13px]">{item.worker_name}</td>
                  <td className="px-6 py-4 font-black font-mono text-stone-900 text-[14px]">
                    ₹{item.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-stone-500 tracking-tight">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                      item.status === 'paid'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : item.status === 'pending'
                        ? 'bg-amber-50 text-amber-600 border-amber-100'
                        : 'bg-red-50 text-red-600 border-red-100'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payouts.length === 0 && (
            <div className="p-8 text-center text-stone-400 text-xs font-semibold">
              No payout records found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}