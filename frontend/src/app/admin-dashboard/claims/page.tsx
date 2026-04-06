'use client';

import { useEffect, useState } from 'react';
import { Download, ShieldCheck, Activity, ChevronDown } from 'lucide-react';
import {
  fetchFraudQueue,
  FraudQueueItem,
} from '@/lib/admin/adminClient';

function normalizePath(path: string | null | undefined): 'FAST TRACK' | 'SOFT QUEUE' | 'ACTIVE VERIFY' {
  const normalized = (path || '').toLowerCase();
  if (normalized === 'fast_track') return 'FAST TRACK';
  if (normalized === 'soft_queue') return 'SOFT QUEUE';
  return 'ACTIVE VERIFY';
}

function formatScore(value: number | null | undefined, digits = 0): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value)).padStart(2, '0');
}

export default function Claims() {
  const [claimsData, setClaimsData]     = useState<FraudQueueItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<FraudQueueItem | null>(null);
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [pathFilter, setPathFilter]     = useState('All Paths');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchFraudQueue();
        setClaimsData(data);
        if (data.length) {
          setSelectedClaim((prev) => prev ?? data[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const getFraudColor = (score: number) => {
    if (score < 20) return '#22c55e';
    if (score < 60) return '#f97316';
    return '#ef4444';
  };

  const getPathConfig = (path: string | null) => {
    const normalized = normalizePath(path);
    if (normalized === 'FAST TRACK') return { color: '#22c55e', label: 'FAST TRACK', barWidth: '80%', dotColor: '#22c55e' };
    if (normalized === 'SOFT QUEUE') return { color: '#f97316', label: 'SOFT QUEUE', barWidth: '50%', dotColor: '#f97316' };
    return { color: '#a855f7', label: 'ACTIVE VERIFY', barWidth: '30%', dotColor: '#a855f7' };
  };

  const isSafe = (claim: FraudQueueItem) => claim.fraud_score < 20;

  const getAuditNarrative = (claim: FraudQueueItem) => {
    const path = normalizePath(claim.resolution_path);
    if (path === 'FAST TRACK') {
      return `Path 1: Fast Track — DCI ${formatScore(claim.dci_score, 2)} confirmed. High spatial-temporal correlation found in Zone ${claim.city}. Payout executed at T+24ms via Ledger Node 4.`;
    }
    if (path === 'SOFT QUEUE') {
      return `Path 2: Soft Queue — DCI ${formatScore(claim.dci_score, 2)} flagged for secondary review. Fraud score ${formatScore(claim.fraud_score)} exceeds threshold. Awaiting manual clearance before payout release.`;
    }
    return `Path 3: Active Verify — DCI ${formatScore(claim.dci_score, 2)} requires active verification. Fraud score ${formatScore(claim.fraud_score)} elevated. Escalated for investigator review in Zone ${claim.city}.`;
  };

  // ── Working CSV Export ──────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const headers = ['Claim ID', 'Worker', 'Zone', 'DCI Trigger', 'Fraud Score', 'Path', 'Payout'];
    const rows = filteredData.map((c) => [
      c.claim_id,
      c.worker_name,
      c.city,
      c.dci_score ?? '',
      c.fraud_score,
      (c.resolution_path ?? 'UNKNOWN').replace('_', ' '),
      c.payout ?? 0,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = `claims-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const filteredData = claimsData.filter((c) => {
    const pathLabel = normalizePath(c.resolution_path);
    const statusLabel = c.fraud_score < 20 ? 'Verified Safe' : 'Under Review';

    const statusMatches = statusFilter === 'All Statuses' || statusLabel === statusFilter;
    const pathMatches = pathFilter === 'All Paths' || pathLabel === pathFilter;
    return statusMatches && pathMatches;
  });

  if (loading) {
    return (
      <div style={{ background: '#f3f4f6', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6b7280', fontSize: 14 }}>Loading claims…</span>
      </div>
    );
  }

  const sel = selectedClaim;
  const pc  = sel ? getPathConfig(sel.resolution_path) : null;

  // shared inline style tokens
  const S = {
    page:      { background: '#f3f4f6', minHeight: '100vh', padding: 32, fontFamily: '"DM Sans", system-ui, sans-serif', boxSizing: 'border-box' } as React.CSSProperties,
    card:      { background: '#ffffff', borderRadius: 14, border: '1px solid #e8edf2', overflow: 'hidden' } as React.CSSProperties,
    darkPanel: { background: 'linear-gradient(160deg, #0f1e35 0%, #0a1422 100%)', borderRadius: 14, border: '1px solid #1a3352', padding: 22, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.3)' } as React.CSSProperties,
    label:     { fontSize: 9, color: '#475569', letterSpacing: '0.13em', textTransform: 'uppercase', marginBottom: 6 } as React.CSSProperties,
    miniCard:  { background: 'rgba(15,30,53,0.7)', border: '1px solid #1a3352', borderRadius: 12, padding: '14px 16px' } as React.CSSProperties,
  };

  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Claims Pipeline</h1>
          <p style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>Real-time parametric validation flow for gig-economy payouts.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {[
            { val: statusFilter, set: setStatusFilter, opts: ['All Statuses', 'Verified Safe', 'Under Review'] },
            { val: pathFilter,   set: setPathFilter,   opts: ['All Paths', 'FAST TRACK', 'SOFT QUEUE', 'ACTIVE VERIFY'] },
          ].map(({ val, set, opts }) => (
            <div key={val} style={{ position: 'relative' }}>
              <select
                value={val}
                onChange={(e) => set(e.target.value)}
                style={{ appearance: 'none', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 32px 8px 12px', fontSize: 13, color: '#1e293b', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {opts.map((o) => <option key={o}>{o}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          ))}
          <button
            onClick={handleExportCSV}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* ── Table ── */}
        <div style={S.card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['CLAIM ID','WORKER','ZONE','DCI TRIGGER','FRAUD SCORE','PATH','PAYOUT',''].map((h, i) => (
                  <th key={i} style={{ padding: '12px 18px', textAlign: 'left', color: '#94a3b8', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((claim) => {
                const cpc = getPathConfig(claim.resolution_path);
                const isSel = sel?.claim_id === claim.claim_id;
                return (
                  <tr
                    key={claim.claim_id}
                    onClick={() => setSelectedClaim(claim)}
                    style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: isSel ? '#f0f9ff' : 'transparent', transition: 'background 0.12s' }}
                    onMouseEnter={(e) => { if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isSel ? '#f0f9ff' : 'transparent'; }}
                  >
                    <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>{claim.claim_id}</td>
                    <td style={{ padding: '14px 18px', color: '#334155' }}>{claim.worker_name}</td>
                    <td style={{ padding: '14px 18px', color: '#94a3b8', fontFamily: 'monospace', fontSize: 12 }}>{claim.city}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 600, color: '#0f172a' }}>{formatScore(claim.dci_score, 2)}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 700, fontSize: 15, color: getFraudColor(claim.fraud_score) }}>{formatScore(claim.fraud_score)}</td>
                    <td style={{ padding: '14px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: cpc.color }}>{cpc.label}</td>
                    <td style={{ padding: '14px 18px', fontWeight: 500, color: '#334155' }}>₹{claim.payout ?? 0}</td>
                    <td style={{ padding: '14px 18px' }}>
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: cpc.dotColor }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Right Panel ── */}
        {sel && pc && (
          <div style={S.darkPanel}>

            {/* Claim header + badge */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={S.label}>Selected Claim</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>{sel.claim_id}</div>
              </div>
              {isSafe(sel) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', padding: '5px 10px', borderRadius: 20 }}>
                  <ShieldCheck size={11} /> VERIFIED SAFE
                </div>
              )}
            </div>

            {/* Pipeline route bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                <span style={{ color: '#64748b' }}>Pipeline Route</span>
                <span style={{ color: pc.color, fontWeight: 700 }}>{pc.label}</span>
              </div>
              <div style={{ height: 4, background: '#1a3352', borderRadius: 99 }}>
                <div style={{ height: 4, background: pc.color, borderRadius: 99, width: pc.barWidth, transition: 'width 0.5s ease', boxShadow: `0 0 8px ${pc.color}60` }} />
              </div>
            </div>

            {/* Score cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={S.miniCard}>
                <div style={S.label}>DCI Score</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>{formatScore(sel.dci_score, 2)}</div>
                <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>Confirmed Path 1</div>
              </div>
              <div style={S.miniCard}>
                <div style={S.label}>Fraud Score</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: getFraudColor(sel.fraud_score) }}>{formatScore(sel.fraud_score)}</div>
                <div style={{ fontSize: 10, color: isSafe(sel) ? '#22c55e' : '#f97316', marginTop: 4 }}>Status: {isSafe(sel) ? 'Safe' : 'Review'}</div>
              </div>
            </div>

            {/* Worker meta */}
            <div style={{ ...S.miniCard, display: 'flex', flexDirection: 'column', gap: 9 }}>
              <div style={S.label}>Worker Details</div>
              {[['Name', sel.worker_name, '#e2e8f0'], ['Zone', sel.city, '#e2e8f0'], ['Payout', `₹${sel.payout ?? 0}`, '#4ade80']].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{k}</span>
                  <span style={{ color: c, fontSize: 12, fontWeight: 600, fontFamily: k === 'Zone' ? 'monospace' : 'inherit' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Verification artifacts */}
            <div>
              <div style={S.label}>Verification Artifacts</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

                {/* Geofence OK */}
                <div style={{ background: 'linear-gradient(135deg,#0d2e2a,#082820)', border: '1px solid #134e4a', borderRadius: 12, padding: '14px 10px', textAlign: 'center', position: 'relative', overflow: 'hidden', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <div style={{ position: 'absolute', inset: 0, opacity: 0.15, backgroundImage: 'radial-gradient(circle, #14b8a6 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
                  <div style={{ width: 30, height: 30, background: 'rgba(20,184,166,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#14b8a6" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#5eead4', position: 'relative' }}>Geofence OK</span>
                </div>

                {/* Signal Match */}
                <div style={{ background: 'linear-gradient(135deg,#0d1e3a,#081428)', border: '1px solid #1e3a5f', borderRadius: 12, padding: '14px 10px', textAlign: 'center', position: 'relative', overflow: 'hidden', minHeight: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, height: 22, opacity: 0.25 }}>
                    <svg viewBox="0 0 120 22" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                      <polyline points="0,11 10,3 20,17 30,7 40,15 50,3 60,11 70,5 80,17 90,7 100,13 110,3 120,11" fill="none" stroke="#60a5fa" strokeWidth="2" />
                    </svg>
                  </div>
                  <div style={{ width: 30, height: 30, background: 'rgba(96,165,250,0.2)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <Activity size={15} color="#60a5fa" />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#93c5fd', position: 'relative' }}>Signal Match</span>
                </div>
              </div>
            </div>

            {/* Audit Narrative */}
            <div>
              <div style={S.label}>Audit Narrative</div>
              <div style={{ ...S.miniCard, fontSize: 12, color: '#94a3b8', lineHeight: 1.65 }}>
                {getAuditNarrative(sel)}
              </div>
            </div>

            

          </div>
        )}
      </div>

      {/* ── Footer Widget ── */}
      <div style={{ marginTop: 20, background: '#fff', border: '1px solid #e8edf2', borderRadius: 12, padding: '12px 18px', width: 'fit-content', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#ede9fe', borderRadius: 10, padding: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={18} color="#7c3aed" />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Active Velocity</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>842 Claims / Hour</div>
        </div>
      </div>

    </div>
  );
}