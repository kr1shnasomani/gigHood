'use client';

import { useEffect, useState } from 'react';
import { Home, ChevronRight, Zap } from 'lucide-react';
import {
  fetchPolicyStats,
  fetchPolicyTiers,
  fetchPayoutTrends,
  fetchRecentPayouts,
  PolicyStats,
  PolicyTier,
  MonthlyTrend,
  PayoutItem,
} from '@/lib/admin/adminClient';

const initials = (name: string) =>
  name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

const avatarColors = [
  'bg-stone-100 text-stone-700',
  'bg-orange-100 text-orange-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
];

function GaugeArc({ value }: { value: number }) {
  const clamp    = Math.min(1, Math.max(0, value));
  const cx = 100, cy = 100, r = 72;
  const toRad    = (deg: number) => (deg * Math.PI) / 180;
  const arcStart = 205, arcEnd = 335;
  const fullSweep = arcEnd - arcStart;

  const pt = (deg: number) => ({
    x: cx + r * Math.cos(toRad(deg)),
    y: cy + r * Math.sin(toRad(deg)),
  });

  const arcD = (from: number, to: number) => {
    const s = pt(from), e = pt(to);
    const large = to - from > 180 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const fillEnd = arcStart + clamp * fullSweep;
  const green   = arcStart + Math.min(clamp, 0.60) * fullSweep;
  const yellow  = arcStart + Math.min(clamp, 0.85) * fullSweep;
  const nx      = cx + (r - 20) * Math.cos(toRad(fillEnd));
  const ny      = cy + (r - 20) * Math.sin(toRad(fillEnd));
  const startPt = pt(arcStart), endPt = pt(arcEnd);

  return (
    <svg viewBox="0 0 200 130" className="w-full max-w-[200px] mx-auto overflow-visible">
      <path d={arcD(arcStart, arcEnd)} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={11} strokeLinecap="round" />
      {clamp > 0 && (
        <path d={arcD(arcStart, green)} fill="none" stroke="#22c55e" strokeWidth={11} strokeLinecap="round" />
      )}
      {clamp > 0.60 && (
        <path d={arcD(green, yellow)} fill="none" stroke="#f59e0b" strokeWidth={11} strokeLinecap="round" />
      )}
      {clamp > 0.85 && (
        <path d={arcD(yellow, fillEnd)} fill="none" stroke="#ef4444" strokeWidth={11} strokeLinecap="round" />
      )}
      <line x1={cx} y1={cy} x2={nx.toFixed(2)} y2={ny.toFixed(2)} stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="white" />
      <text x={startPt.x - 6} y={startPt.y + 14} fill="#a8a29e" fontSize="9" fontWeight="bold" textAnchor="middle">0</text>
      <text x={endPt.x + 6}   y={endPt.y + 14}   fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">1</text>
    </svg>
  );
}

const TierIcon = ({ idx }: { idx: number }) => {
  const colors = [
    'bg-stone-100 text-stone-500',
    'bg-orange-50 text-orange-500',
    'bg-amber-50 text-amber-500',
  ];
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colors[idx]}`}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
      </svg>
    </div>
  );
};

interface ChartDatum { name: string; premiums: number; payouts: number }
function PayoutChart({ data }: { data: ChartDatum[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const W = 560, H = 240;
  const padL = 50, padR = 16, padT = 12, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxVal = Math.max(...data.flatMap((d) => [d.premiums, d.payouts]), 1);
  const yMax   = Math.ceil(maxVal / 1_000_000) * 1_000_000;

  const groupW = chartW / data.length;
  const barW   = Math.round(groupW * 0.28);
  const gap    = Math.round(groupW * 0.04);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ val: f * yMax, y: chartH - f * chartH }));
  const fmtY = (v: number) => v === 0 ? '0' : `₹${(v / 1_000_000).toFixed(1)}M`;

  const rr = 5;
  const roundRect = (x: number, y: number, w: number, h: number) =>
    `M ${x + rr} ${y} H ${x + w - rr} Q ${x + w} ${y} ${x + w} ${y + rr} V ${y + h} H ${x} V ${y + rr} Q ${x} ${y} ${x + rr} ${y}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
      <defs>
        <linearGradient id="gradPremium" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d6d3d1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#e7e5e4" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#fb923c" stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id="gradPremiumHov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a8a29e" />
          <stop offset="100%" stopColor="#d6d3d1" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="gradPayoutHov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>

      <g transform={`translate(${padL},${padT})`}>
        {yTicks.map(({ val, y }) => (
          <g key={val}>
            <line x1={0} y1={y} x2={chartW} y2={y} stroke="#f5f5f4" strokeWidth={1.5} />
            <text x={-8} y={y + 3} fill="#a8a29e" fontSize={10} fontWeight="bold" textAnchor="end">{fmtY(val)}</text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx  = i * groupW + groupW / 2;
          const x1  = cx - barW - gap / 2;
          const x2  = cx + gap / 2;
          const ph  = (d.premiums / yMax) * chartH;
          const oh  = (d.payouts  / yMax) * chartH;
          const isHov = hovered === i;

          return (
            <g key={d.name} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              {isHov && <rect x={cx - groupW / 2 + 4} y={0} width={groupW - 8} height={chartH} rx={6} fill="#fafaf9" />}
              <path d={roundRect(x1, chartH - ph, barW, ph)} fill={isHov ? 'url(#gradPremiumHov)' : 'url(#gradPremium)'} />
              <path d={roundRect(x2, chartH - oh, barW, oh)} fill={isHov ? 'url(#gradPayoutHov)' : 'url(#gradPayout)'} />
              <text x={cx} y={chartH + 20} fill="#78716c" fontSize={10} fontWeight="600" textAnchor="middle">{d.name}</text>
              {isHov && (
                <g transform={`translate(${cx - 52}, ${chartH - Math.max(ph, oh) - 58})`}>
                  <rect width={104} height={46} rx={8} fill="white" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.08))" />
                  <text x={52} y={15} textAnchor="middle" fill="#1c1917" fontSize={10} fontWeight="800">{d.name}</text>
                  <text x={10} y={28} fill="#a8a29e" fontSize={9} fontWeight="bold">Premiums</text>
                  <text x={94} y={28} textAnchor="end" fill="#78716c" fontSize={9} fontWeight="900" fontFamily="mono">₹{(d.premiums / 1_000_000).toFixed(1)}M</text>
                  <text x={10} y={39} fill="#a8a29e" fontSize={9} fontWeight="bold">Payouts</text>
                  <text x={94} y={39} textAnchor="end" fill="#ea580c" fontSize={9} fontWeight="900" fontFamily="mono">₹{(d.payouts / 1_000_000).toFixed(1)}M</text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function ActivePoliciesPage() {
  const [policyStats, setPolicyStats] = useState<PolicyStats | null>(null);
  const [policyTiers, setPolicyTiers] = useState<PolicyTier[]>([]);
  const [payoutTrends, setPayoutTrends] = useState<MonthlyTrend[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<PayoutItem[]>([]);

  useEffect(() => {
    fetchPolicyStats().then(setPolicyStats).catch(console.error);
    fetchPolicyTiers().then(setPolicyTiers).catch(console.error);
    fetchPayoutTrends().then(setPayoutTrends).catch(console.error);
    fetchRecentPayouts().then(setRecentPayouts).catch(console.error);
  }, []);

  if (!policyStats) {
    return (
      <div className="p-7 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_16px_rgba(249,115,22,0.3)]" />
      </div>
    );
  }

  const chartData = payoutTrends.map((t) => ({ name: t.month, premiums: t.premiums || 0, payouts: t.payouts }));
  const cardStyle = { background: '#FFFFFF', borderRadius: 16, border: '1px solid rgba(249,115,22,0.12)', boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.05)' };
  const lossRatioThreshold = 0.75;
  const lossRatioDeltaPct = Math.round(Math.abs(policyStats.loss_ratio - lossRatioThreshold) * 100);
  const lossRatioBadge = policyStats.loss_ratio <= lossRatioThreshold
    ? `${lossRatioDeltaPct}% BELOW THRESHOLD`
    : `${lossRatioDeltaPct}% ABOVE THRESHOLD`;

  return (
    <div className="p-7 space-y-7 max-w-[1400px] mx-auto">
      <div>
        <nav className="flex items-center gap-1 text-[11px] text-stone-400 mb-3">
          <Home size={11} />
          <span className="mx-1">·</span>
          <span className="hover:text-orange-500 cursor-pointer transition-colors">Admin</span>
          <ChevronRight size={11} className="text-stone-300" />
          <span className="text-stone-700 font-semibold">Active Policies</span>
        </nav>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              Active Policies &amp; Payouts
            </h1>
            <p className="text-sm text-stone-500 mt-1">Real-time oversight of parametric gig-economy stability.</p>
          </div>
          <div className="flex gap-10 text-right">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 font-black">Total Value Locked</p>
              <h2 className="text-xl font-black text-stone-900 mt-0.5 font-mono">₹{policyStats.total_value_locked.toLocaleString()}</h2>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 font-black">Active Nodes</p>
              <h2 className="text-xl font-black text-stone-900 mt-0.5 font-mono">{policyStats.active_nodes.toLocaleString()}</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#1c1917] to-[#292524] text-white p-6 rounded-2xl relative overflow-hidden flex flex-col" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 60%)' }} />
          <div>
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1 flex items-center gap-2">
              Current Loss Ratio <Zap size={11} className="text-orange-400" />
            </p>
            <h2 className="text-5xl font-black mt-2 tracking-tight font-mono">{policyStats.loss_ratio.toFixed(2)}</h2>
            <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> {lossRatioBadge}
            </div>
          </div>
          <div className="mt-auto pt-6 text-center">
            <GaugeArc value={policyStats.loss_ratio} />
            <div className="flex justify-between text-[9px] font-black text-stone-500 mt-2 px-3 tracking-widest">
              <span>STABLE</span>
              <span className="text-red-400">CRITICAL</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 p-6" style={cardStyle}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-[14px] font-bold text-stone-900 tracking-tight">Payout Trends</h2>
              <p className="text-[11px] text-stone-500 font-semibold mt-0.5">Monthly premiums vs. payouts triggered</p>
            </div>
            <div className="flex gap-4 text-[10px] font-black text-stone-400 tracking-widest uppercase mt-0.5">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded shadow-sm bg-gradient-to-b from-stone-300 to-stone-200" /> PREMIUMS</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded shadow-sm bg-gradient-to-b from-orange-500 to-orange-400" /> PAYOUTS</span>
            </div>
          </div>
          <PayoutChart data={chartData} />
        </div>
      </div>

      <div>
        <h2 className="text-[14px] font-bold text-stone-900 tracking-tight mb-4 ml-1">Policy Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {policyTiers.map((tier, idx) => {
            const pct = ((tier.workers / policyStats.active_nodes) * 100).toFixed(0);
            const badge = [
              <span key="1" className="text-[9px] px-2 py-1 bg-stone-100 rounded-md text-stone-600 font-black tracking-widest border border-stone-200">ENTRY</span>,
              <span key="2" className="text-[9px] px-2 py-1 bg-orange-50 rounded-md text-orange-600 font-black tracking-widest border border-orange-200">POPULAR</span>,
              <span key="3" className="text-[9px] px-2 py-1 bg-amber-50 rounded-md text-amber-600 font-black tracking-widest border border-amber-200">PREMIUM</span>,
            ][idx];

            return (
              <div key={idx} className="p-5" style={cardStyle}>
                <div className="flex justify-between items-center mb-4">
                  <TierIcon idx={idx} />
                  {badge}
                </div>
                <h3 className="font-bold text-stone-900 text-[13px] mb-4">{tier.tier}</h3>
                <div className="flex justify-between mb-3 text-[11px]">
                  <div>
                    <p className="text-stone-400 font-semibold mb-1">Active Workers</p>
                    <p className="font-black text-stone-800 text-[14px] font-mono">{tier.workers.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-stone-400 font-semibold mb-1">Avg. Coverage</p>
                    <p className="font-black text-emerald-600 text-[14px] font-mono hover:text-emerald-500">₹{tier.avg_coverage}/mo</p>
                  </div>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                  <div className={`h-full rounded-full ${idx === 1 ? 'bg-orange-500' : 'bg-stone-300'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle} className="overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-stone-100 bg-[#FAFAF8]">
           <h2 className="text-[14px] font-bold text-stone-900 tracking-tight">Recent Payouts</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                {['TX ID', 'Worker', 'Amount', 'Status', 'Date'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[9px] font-black text-stone-400 uppercase tracking-[0.2em] bg-white">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentPayouts.slice(0, 6).map((p, i) => (
                <tr key={p.id} className="border-b border-stone-50 hover:bg-orange-50/40 transition-colors">
                  <td className="px-5 py-4 text-stone-400 text-xs font-mono font-bold">{p.id}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 border border-black/5 ${avatarColors[i % avatarColors.length]}`}>
                        {initials(p.worker_name)}
                      </div>
                      <span className="text-stone-800 font-bold text-[13px]">{p.worker_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-black text-stone-900 font-mono text-[14px]">₹{p.amount.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[9px] font-black tracking-wider uppercase rounded-md border ${
                      p.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full inline-block ${p.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {p.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-stone-500 text-xs font-semibold">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}