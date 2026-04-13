'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchAuditLogs, AuditLog } from '@/lib/admin/adminClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────
type Meta = Record<string, unknown>;
const s = (v: unknown): string => String(v ?? '');
const n = (v: unknown): number => Number(v ?? 0);

const ACTION_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string; icon: string }> = {
  AUTO_DECISION: { label: 'AI Decision',    icon: '🧠', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  text: '#2563EB', dot: '#3B82F6' },
  OVERRIDE:      { label: 'Admin Override', icon: '👤', bg: 'rgba(217,119,6,0.08)',   border: 'rgba(217,119,6,0.2)',   text: '#D97706', dot: '#F59E0B' },
  CREATE:        { label: 'Created',        icon: '✨', bg: 'rgba(22,163,74,0.08)',   border: 'rgba(22,163,74,0.2)',   text: '#16A34A', dot: '#22C55E' },
  STATUS_CHANGE: { label: 'Status Change',  icon: '🔄', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.2)', text: '#7C3AED', dot: '#8B5CF6' },
};
const DEFAULT_CFG  = { label: 'Event', icon: '📋', bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.2)', text: '#64748B', dot: '#94A3B8' };
const DEC_COLOR    = { APPROVE: '#16A34A', REVIEW: '#D97706', DENY: '#DC2626' } as Record<string, string>;

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function KV({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold tracking-widest uppercase text-slate-400">{k}</span>
      <span className="text-[11px] font-black" style={{ color: color ?? '#0F172A' }}>{v}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AuditPage() {
  const [logs,       setLogs]       = useState<AuditLog[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search,     setSearch]     = useState('');

  useEffect(() => {
    fetchAuditLogs(100).then(setLogs).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    let rows = filter === 'ALL' ? logs : logs.filter(l => l.action === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(l =>
        l.entity_id.toLowerCase().includes(q) ||
        l.performed_by.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [logs, filter, search]);

  const stats = useMemo(() => ({
    total:       logs.length,
    ai:          logs.filter(l => l.action === 'AUTO_DECISION').length,
    overrides:   logs.filter(l => l.action === 'OVERRIDE').length,
    corrections: logs.filter(l => l.action === 'OVERRIDE' && !!(l.metadata as Meta)?.was_correction).length,
  }), [logs]);

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A]">📜 Compliance Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-1">Immutable ledger · Every AI decision + admin action · RBI / IRDAI ready</p>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Append-only</span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">🔒 Tamper-evident</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {([
          { label: 'Total Events',    value: stats.total,       icon: '📋', color: '#0F172A' },
          { label: 'AI Decisions',    value: stats.ai,          icon: '🧠', color: '#2563EB' },
          { label: 'Admin Overrides', value: stats.overrides,   icon: '👤', color: '#D97706' },
          { label: 'AI Corrections',  value: stats.corrections, icon: '⚠',  color: '#DC2626' },
        ] as const).map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center gap-3">
            <div className="text-2xl">{icon}</div>
            <div>
              <p className="text-2xl font-black" style={{ color }}>{value}</p>
              <p className="text-[11px] text-slate-500 font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
          {(['ALL', 'AUTO_DECISION', 'OVERRIDE', 'CREATE'] as const).map(key => {
            const cfg    = key === 'ALL' ? DEFAULT_CFG : (ACTION_CONFIG[key] ?? DEFAULT_CFG);
            const cnt    = key === 'ALL' ? logs.length : logs.filter(l => l.action === key).length;
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: active ? cfg.bg    : 'transparent',
                  color:      active ? cfg.text  : '#64748B',
                  border:     `1px solid ${active ? cfg.border : 'transparent'}`,
                }}
              >
                {cfg.icon} {cfg.label} <span className="font-bold opacity-60">{cnt}</span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
            <span className="text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search entity ID, actor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-[12px] text-slate-700 outline-none w-48 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Rows */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading audit logs…</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No events match your filters.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {visible.map(log => {
              const cfg      = ACTION_CONFIG[log.action] ?? DEFAULT_CFG;
              const meta     = (log.metadata ?? {}) as Meta;
              const isOpen   = expandedId === log.id;
              const decStr   = s(meta.decision ?? meta.new_decision) || null;
              const topR     = s(meta.top_reason) || null;
              const reasonTx = s(meta.reason) || null;

              return (
                <div
                  key={log.id}
                  className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                  onClick={() => setExpandedId(isOpen ? null : log.id)}
                >
                  {/* Row */}
                  <div className="px-5 py-3.5 flex items-center gap-4">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold flex-shrink-0 w-36"
                      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                      {cfg.icon} {cfg.label}
                    </span>

                    <span className="text-sm font-bold text-slate-900 w-28 flex-shrink-0 font-mono">{log.entity_id}</span>

                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: log.performed_by === 'AI' ? 'rgba(59,130,246,0.08)' : 'rgba(217,119,6,0.08)',
                        color:      log.performed_by === 'AI' ? '#2563EB' : '#D97706',
                      }}
                    >
                      {log.performed_by === 'AI' ? '🧠 AI' : `👤 ${log.performed_by}`}
                    </span>

                    {decStr !== null && (
                      <span className="text-[11px] font-black flex-shrink-0" style={{ color: DEC_COLOR[decStr] ?? '#64748B' }}>
                        → {decStr}
                      </span>
                    )}

                    {meta.fraud_score !== undefined && (
                      <span className="text-[11px] text-slate-500 flex-shrink-0">
                        Score <strong className="text-slate-800">{s(meta.fraud_score)}</strong>
                      </span>
                    )}

                    {!!meta.was_correction && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 flex-shrink-0">
                        ⚠ AI corrected
                      </span>
                    )}

                    {topR !== null && topR !== 'none' && (
                      <span className="text-[10px] text-slate-400 truncate">
                        Primary: <span className="text-slate-600 font-semibold">{topR.replace(/_/g, ' ')}</span>
                      </span>
                    )}

                    <span className="ml-auto text-[11px] text-slate-400 flex-shrink-0">{timeAgo(log.created_at)}</span>
                    <span className="text-slate-300 text-xs flex-shrink-0 transition-transform duration-150"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="px-5 pb-4 bg-slate-50/60 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-4 pt-3">

                        {/* Key-value details */}
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-1">Event Details</p>
                          <KV k="Entity Type"  v={log.entity_type} />
                          <KV k="Entity ID"    v={log.entity_id} />
                          <KV k="Action"       v={log.action} />
                          <KV k="Performed By" v={log.performed_by} />
                          <KV k="Timestamp"    v={new Date(log.created_at).toLocaleString()} />
                          {meta.fraud_score !== undefined && (
                            <KV k="Fraud Score" v={`${s(meta.fraud_score)}/100`}
                              color={n(meta.fraud_score) >= 75 ? '#DC2626' : n(meta.fraud_score) >= 45 ? '#D97706' : '#16A34A'} />
                          )}
                          {decStr !== null && (
                            <KV k="Decision" v={decStr!} color={DEC_COLOR[decStr as string] ?? '#64748B'} />
                          )}
                          {!!meta.top_reason_label && (
                            <KV k="Top Risk Factor" v={s(meta.top_reason_label)} color="#DC2626" />
                          )}
                        </div>

                        {/* XAI breakdown OR raw JSON */}
                        {meta.breakdown && typeof meta.breakdown === 'object' ? (
                          <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">📊 Feature Breakdown</p>
                            <div className="space-y-1.5">
                              {Object.entries(meta.breakdown as Record<string, number>)
                                .sort(([, a], [, b]) => b - a)
                                .map(([key, val]) => {
                                  const v  = Number(val);
                                  const bc = v > 30 ? '#EF4444' : v > 10 ? '#F59E0B' : '#10B981';
                                  const lbl = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <span className="text-[10px] text-slate-500 w-44 flex-shrink-0 truncate">{lbl}</span>
                                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${Math.min(v, 100)}%`, background: bc }} />
                                      </div>
                                      <span className="text-[10px] font-semibold w-7 text-right" style={{ color: bc }}>{v}</span>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-2">Raw Metadata</p>
                            <pre className="text-[10px] bg-slate-100 rounded-lg p-3 overflow-auto max-h-40 text-slate-600 leading-relaxed">
                              {JSON.stringify(meta, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* AI reasoning */}
                      {reasonTx !== null && (
                        <div className="mt-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-[9px] font-bold tracking-widest uppercase text-blue-400 mb-0.5">AI Reasoning</p>
                          <p className="text-[11px] text-blue-700 leading-relaxed">{reasonTx}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] text-slate-400">Click any row to expand · Append-only, tamper-evident</p>
          <p className="text-[10px] font-semibold text-slate-400">{visible.length} event{visible.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  );
}
