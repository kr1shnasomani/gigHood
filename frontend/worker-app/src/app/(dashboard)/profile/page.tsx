'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  User, LogOut, ShieldCheck, Download, Award,
  ChevronRight, Bell, TrendingUp, X, Check,
  AlertCircle
} from 'lucide-react';
import { deleteToken } from '@/lib/auth';
import { workerApi } from '@/lib/worker';
import api from '@/lib/api';

// ── Tiny toast ─────────────────────────────────────────────

function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: 'sticky', bottom: '16px',
      zIndex: 1000, alignSelf: 'center',
      background: 'rgba(30,41,59,0.95)', backdropFilter: 'blur(20px)',
      border: '1px solid var(--border-glass)', borderRadius: '14px',
      padding: '12px 20px', color: 'white', fontSize: '14px',
      fontWeight: 500, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: '10px',
      animation: 'slideUpFade 0.3s ease both',
      maxWidth: '320px', textAlign: 'center',
    }}>
      <Check size={16} color="#34D399" />
      {msg}
    </div>
  );
}

// ── Trust score description ────────────────────────────────

function trustLabel(score: number): string {
  if (score >= 90) return 'Fast Track payouts enabled';
  if (score >= 70) return 'Standard payout processing';
  return 'Additional verification may apply';
}

function trustColor(score: number): string {
  if (score >= 90) return '#34D399';
  if (score >= 70) return '#60A5FA';
  return '#F59E0B';
}

// ── Tier colors ────────────────────────────────────────────

function tierColor(tier: string): string {
  switch (tier) {
    case 'A': return '#8B5CF6';
    case 'B': return '#3B82F6';
    case 'C': return '#F59E0B';
    default:  return '#3B82F6';
  }
}

function tierGradient(tier: string): string {
  switch (tier) {
    case 'A': return 'linear-gradient(135deg, rgba(139,92,246,0.4) 0%, rgba(59,130,246,0.2) 100%)';
    case 'B': return 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(16,185,129,0.2) 100%)';
    case 'C': return 'linear-gradient(135deg, rgba(245,158,11,0.4) 0%, rgba(239,68,68,0.18) 100%)';
    default:  return 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(16,185,129,0.2) 100%)';
  }
}

// ── Row item ────────────────────────────────────────────────

function SettingsRow({
  icon, label, sublabel, color = 'white', onClick,
}: {
  icon: React.ReactNode; label: string; sublabel?: string;
  color?: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '14px 16px',
        borderRadius: '14px', background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border-glass)', fontFamily: 'inherit',
        textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s',
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {icon}
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color }}>{label}</div>
          {sublabel && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>{sublabel}</div>}
        </div>
      </div>
      <ChevronRight size={16} color="var(--text-muted)" />
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [toast, setToast] = useState<string | null>(null);
  const [showEarningsSheet, setShowEarningsSheet] = useState(false);
  const [earningsInput, setEarningsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Data fetching ───────────────────────────────────────
  const { data: worker, isLoading: workerLoading } = useQuery({
    queryKey: ['me'],
    queryFn: workerApi.getMe,
    staleTime: 60000,
  });

  const { data: policy, isLoading: policyLoading } = useQuery({
    queryKey: ['policy'],
    queryFn: workerApi.getMyPolicy,
    staleTime: 60000,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Logout ──────────────────────────────────────────────
  const handleLogout = () => {
    deleteToken();
    queryClient.clear(); // wipe all react-query cache
    router.replace('/login');
  };

  // ── Update earnings ─────────────────────────────────────
  const handleSaveEarnings = async () => {
    const val = parseFloat(earningsInput);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      await api.patch('/workers/me', { avg_daily_earnings: val });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowEarningsSheet(false);
      setEarningsInput('');
      showToast('Earnings declaration updated');
    } catch {
      showToast('Update failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────
  if (workerLoading || policyLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────
  const tier = policy?.tier ?? '—';
  const tc = tierColor(tier);
  const ts = worker?.trust_score ?? 0;
  const tColor = trustColor(ts);

  // Policy week dates
  const policyStart = policy?.week_start || policy?.start_date;
  const policyEnd   = policy?.week_end   || policy?.end_date;
  const fmtDate = (s?: string) => s
    ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';
  const policyWeek = `${fmtDate(policyStart)} – ${fmtDate(policyEnd)}`;

  // Phone: ensure +91 prefix
  const rawPhone = worker?.phone ?? '';
  const displayPhone = rawPhone.startsWith('+91') ? rawPhone : `+91 ${rawPhone}`;

  // SVG ring math — circumference of radius-16 circle = ~100.5
  const circ = 2 * Math.PI * 16;
  const ringOffset = circ - (circ * ts / 100);

  // Policy file name
  const policyFilename = policy?.id
    ? `gighood-policy-${policy.id.substring(0, 8)}.pdf`
    : '—';

  return (
    <>
      {/* Toast */}
      {toast && <Toast msg={toast} />}

      {/* Earnings bottom sheet */}
      {showEarningsSheet && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setShowEarningsSheet(false)}
        >
          <div
            style={{
              width: '100%', maxWidth: '440px',
              background: 'linear-gradient(180deg, rgba(20,28,48,0.98) 0%, rgba(9,14,26,1) 100%)',
              borderRadius: '24px 24px 0 0', padding: '24px 24px calc(24px + var(--safe-bottom))',
              border: '1px solid var(--border-glass)',
              animation: 'slideUpFade 0.3s ease both',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Update Earnings</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Current: ₹{worker?.avg_daily_earnings}/day
                </p>
              </div>
              <button
                onClick={() => setShowEarningsSheet(false)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                New Avg Daily Earnings (₹)
              </label>
              <input
                type="number"
                inputMode="numeric"
                value={earningsInput}
                onChange={e => setEarningsInput(e.target.value)}
                placeholder={`e.g. ${worker?.avg_daily_earnings ?? 600}`}
                style={{
                  width: '100%', padding: '14px 16px', borderRadius: '12px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
                  color: 'white', fontSize: '18px', fontFamily: 'inherit',
                  outline: 'none', boxSizing: 'border-box',
                }}
                autoFocus
              />
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
                <AlertCircle size={11} style={{ display: 'inline', marginRight: '4px' }} />
                This affects your policy premium at next renewal.
              </p>
            </div>

            <button
              onClick={handleSaveEarnings}
              disabled={saving || !earningsInput || parseFloat(earningsInput) <= 0}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
                color: 'white', fontSize: '15px', fontWeight: 700,
                fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {saving ? 'Saving…' : 'Save Declaration'}
            </button>
          </div>
        </div>
      )}

      {/* Main page */}
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

        {/* Header */}
        <header className="stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>Profile</h2>
            <p className="label-micro">Verified Member</p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="Sign out"
          >
            <LogOut size={18} color="#EF4444" />
          </button>
        </header>

        {/* 1. Worker Info Card */}
        <div
          className="stagger-2"
          style={{
            position: 'relative', borderRadius: '24px',
            background: tierGradient(tier), padding: '24px',
            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: `0 12px 32px ${tc}30`,
          }}
        >
          {/* Shine sweep */}
          <div style={{ position: 'absolute', top: '-50%', left: '-50%', right: '-50%', bottom: '-50%', background: 'linear-gradient(60deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)', animation: 'shine 6s linear infinite', transform: 'rotate(25deg)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Name row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
                  <User size={22} color="white" />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.3px' }}>
                    {worker?.name ?? '—'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>
                    {displayPhone}
                  </p>
                </div>
              </div>
              <Award size={28} color="white" style={{ opacity: 0.7 }} />
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.55)', marginBottom: '3px' }}>Zone</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{worker?.dark_store_zone ?? '—'}</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{worker?.city ?? '—'}</p>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.55)', marginBottom: '3px' }}>UPI</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'white', wordBreak: 'break-all' }}>{worker?.upi_id ?? '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Coverage Certificate */}
        <section className="stagger-3 glass-panel" style={{ padding: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
              🛡️ gigHood Protect: Active Coverage
            </h3>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              background: policy?.status === 'active' ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.12)',
              color: policy?.status === 'active' ? '#34D399' : '#94A3B8',
              border: `1px solid ${policy?.status === 'active' ? 'rgba(52,211,153,0.3)' : 'rgba(148,163,184,0.3)'}`,
            }}>
              <ShieldCheck size={13} />
              {policy?.status === 'active' ? 'Active' : policy?.status ?? 'Pending'}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
            <div style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>Tier</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{policy ? `Tier ${tier}` : '—'}</p>
            </div>

            <div style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>Premium</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                {policy ? `₹${policy?.weekly_premium ?? policy?.premium_amount ?? '—'}/week` : '—'}
              </p>
            </div>

            <div style={{ padding: '10px', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '3px' }}>Coverage</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>
                {policy ? `Up to ₹${policy?.coverage_cap_daily}/day` : '—'}
              </p>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '12px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#67E8F9', marginBottom: '5px' }}>⚡ How it Works</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Payouts are automatic. No claims required. If the Dynamic Coverage Index (DCI) in your zone exceeds 0.85 due to severe weather or traffic, your coverage is triggered.
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Policy Week: {policyWeek}</p>
            {policy?.is_waiting_period && (
              <p style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', fontSize: '12px', color: '#FBBF24' }}>
                <AlertCircle size={12} /> 7-day waiting period active
              </p>
            )}
          </div>
        </section>

        {/* 3. Trust Score */}
        <section className="stagger-4 glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0 }}>
            <svg width="64" height="64" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
              <circle
                cx="20" cy="20" r="16" fill="none"
                stroke={tColor} strokeWidth="4"
                strokeDasharray={`${circ}`}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: tColor }}>
              {ts}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>Trust Score</h4>
            <p style={{ fontSize: '13px', color: tColor, fontWeight: 500 }}>{trustLabel(ts)}</p>
          </div>
        </section>

        {/* 4. Download Policy */}
        <section className="stagger-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 className="label-micro" style={{ marginBottom: '4px', marginLeft: '4px' }}>Documents</h3>
          <button
            onClick={() => showToast('Policy document download coming in Phase 3')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '14px 16px',
              borderRadius: '14px', background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-glass)', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Download size={17} color="#60A5FA" />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#E2E8F0' }}>Download Policy Document</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px', fontFamily: 'monospace' }}>{policyFilename}</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </section>

        {/* 5. Account Settings */}
        <section className="stagger-5" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 className="label-micro" style={{ marginBottom: '4px', marginLeft: '4px' }}>Account Settings</h3>

          <SettingsRow
            onClick={() => { setEarningsInput(''); setShowEarningsSheet(true); }}
            icon={<div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingUp size={17} color="#34D399" /></div>}
            label="Update Earnings Declaration"
            sublabel={`Currently ₹${worker?.avg_daily_earnings ?? '—'}/day`}
          />

          <SettingsRow
            onClick={() => showToast('Notification Preferences coming soon')}
            icon={<div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={17} color="#60A5FA" /></div>}
            label="Notification Preferences"
          />

          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', padding: '14px 16px',
              borderRadius: '14px', background: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.15)', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <LogOut size={17} color="#EF4444" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444' }}>Sign Out</span>
            </div>
            <ChevronRight size={16} color="rgba(239,68,68,0.5)" />
          </button>
        </section>

      </div>
    </>
  );
}
