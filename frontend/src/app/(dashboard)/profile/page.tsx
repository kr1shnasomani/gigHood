'use client';

import { useEffect, useState } from 'react';
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
import { useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';

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
  if (score >= 90) return 'Fast-track payouts likely';
  if (score >= 70) return 'Standard processing profile';
  return 'Higher review checks may apply';
}

function normalizeRiskLabel(label?: string): 'High' | 'Moderate' | 'Low' {
  const v = (label || '').toLowerCase();
  if (v.includes('high')) return 'High';
  if (v.includes('mod')) return 'Moderate';
  return 'Low';
}

function parseFormulaString(formula?: string): Array<{ label: string; value: string; tone: 'pos' | 'neg' | 'neutral' }> {
  if (!formula) return [];
  const rows: Array<{ label: string; value: string; tone: 'pos' | 'neg' | 'neutral' }> = [];
  for (const chunk of formula.split('|')) {
    const [labelRaw, valueRaw] = chunk.split(':').map((s) => (s || '').trim());
    if (!labelRaw || !valueRaw) continue;
    let tone: 'pos' | 'neg' | 'neutral' = 'neutral';
    if (valueRaw.includes('+')) tone = 'pos';
    if (valueRaw.includes('-')) tone = 'neg';
    rows.push({ label: labelRaw, value: valueRaw, tone });
  }
  return rows;
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

const POLICY_CERTIFICATE_BASE_URL = 'https://ifddoiwbxvfxsidksydf.supabase.co/storage/v1/object/public/policy_certificates';

const POLICY_CERTIFICATES_BY_TIER: Record<string, string> = {
  A: `${POLICY_CERTIFICATE_BASE_URL}/gighood_policy_tier_A.pdf`,
  B: `${POLICY_CERTIFICATE_BASE_URL}/gighood_policy_tier_B.pdf`,
  C: `${POLICY_CERTIFICATE_BASE_URL}/gighood_policy_tier_C.pdf`,
};

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
  const language = useLanguageStore((s) => s.language);

  const [toast, setToast] = useState<string | null>(null);
  const [showEarningsSheet, setShowEarningsSheet] = useState(false);
  const [earningsInput, setEarningsInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const action = new URLSearchParams(window.location.search).get('action');
    if (action === 'update-earnings') {
      setShowEarningsSheet(true);
    }
  }, []);

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
    router.replace('/worker-app/login');
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 180px)', width: '100%' }}>
        <div className="spinner" />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────
  const tier = policy?.tier ?? '—';
  const tc = tierColor(tier);
  const ts = worker?.trust_score ?? 0;
  const tColor = trustColor(ts);
  const zoneRisk = normalizeRiskLabel(policy?.tier_explanation?.avg_dci_band);
  const claimRisk = normalizeRiskLabel(policy?.tier_explanation?.claim_frequency_band);
  const formulaRows = parseFormulaString(worker?.trust_breakdown?.formula_string);
  const totalTrust = ts;

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
  const tierKey = (policy?.tier ?? '').toUpperCase();
  const policyCertificateUrl = POLICY_CERTIFICATES_BY_TIER[tierKey];
  const policyCertificateFilename = policyCertificateUrl
    ? policyCertificateUrl.split('/').pop() ?? policyFilename
    : policyFilename;

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
            <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>{t(language, 'profile_title')}</h2>
            <p className="label-micro">{t(language, 'verified_member')}</p>
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

            <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
              <div>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'rgba(255,255,255,0.55)', marginBottom: '3px' }}>Partner Profile</p>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{worker?.platform_affiliation ?? '—'} • {worker?.platform_id ?? '—'}</p>
              </div>
              <span
                style={{
                  padding: '5px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: worker?.is_platform_verified ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.14)',
                  color: worker?.is_platform_verified ? '#34D399' : '#CBD5E1',
                  border: worker?.is_platform_verified ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(148, 163, 184, 0.28)',
                  whiteSpace: 'nowrap',
                }}
              >
                {worker?.is_platform_verified ? 'Verified Partner' : 'Not Verified'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. Coverage Certificate */}
        <section className="stagger-3 glass-panel" style={{ padding: '18px' }}>
          <div style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
              {t(language, 'active_coverage')}
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
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#67E8F9', marginBottom: '5px' }}>{t(language, 'how_it_works')}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Payouts are automatic. No claims required. If the Dynamic Coverage Index (DCI) in your zone exceeds 0.85 due to severe weather or traffic, your coverage is triggered.
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Policy Week: {policyWeek}</p>
            {policy?.is_waiting_period && (
              <p style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', fontSize: '12px', color: '#FBBF24' }}>
                <AlertCircle size={12} /> 7-day waiting period active
              </p>
            )}
            {policy?.tier_explanation && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(148,163,184,0.3)' }}>
                <p style={{ fontSize: '12px', color: '#93C5FD', fontWeight: 700, marginBottom: '8px' }}>Tier Assignment Breakdown</p>

                <div style={{ borderRadius: '12px', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(30,64,175,0.12)', padding: '10px' }}>
                  <p style={{ fontSize: '12px', color: '#DBEAFE', lineHeight: 1.5 }}>
                    Based on your zone risk and recent claim patterns, your coverage is set to Tier {tier}.
                  </p>
                </div>

                <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.2)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Zone Risk</p>
                    <span style={{ display: 'inline-block', marginTop: '4px', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: zoneRisk === 'High' ? 'rgba(245,158,11,0.2)' : zoneRisk === 'Moderate' ? 'rgba(96,165,250,0.2)' : 'rgba(52,211,153,0.18)', color: zoneRisk === 'High' ? '#FCD34D' : zoneRisk === 'Moderate' ? '#93C5FD' : '#6EE7B7' }}>
                      {zoneRisk}
                    </span>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>raw: {policy.tier_explanation.avg_dci_4w}</p>
                  </div>
                  <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(148,163,184,0.2)' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>Recent Claims</p>
                    <span style={{ display: 'inline-block', marginTop: '4px', padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: claimRisk === 'High' ? 'rgba(245,158,11,0.2)' : claimRisk === 'Moderate' ? 'rgba(96,165,250,0.2)' : 'rgba(52,211,153,0.18)', color: claimRisk === 'High' ? '#FCD34D' : claimRisk === 'Moderate' ? '#93C5FD' : '#6EE7B7' }}>
                      {claimRisk}
                    </span>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>raw: {policy.tier_explanation.claim_frequency_28d}</p>
                  </div>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <span style={{ display: 'inline-block', padding: '5px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: 'rgba(148,163,184,0.2)', color: '#CBD5E1' }}>
                    {policy.tier_explanation.seasonal_text || (policy.tier_explanation.seasonal_flag ? 'Monsoon Season' : 'Regular Season')} • {policy.tier_explanation.city}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Trust Score */}
        <section className="stagger-4 glass-panel" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h4 style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>{t(language, 'trust_score')}</h4>
            <span style={{ padding: '4px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(245,158,11,0.35)', background: 'rgba(120,53,15,0.35)', color: '#FCD34D' }}>
              Higher review checks may apply
            </span>
          </div>

          {worker?.trust_breakdown?.factors && (
            <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid rgba(52,211,153,0.35)', background: 'rgba(6,78,59,0.4)', color: '#6EE7B7', fontSize: '11px', fontWeight: 700 }}>
                Paid {worker.trust_breakdown.factors.paid_claims}
              </span>
              <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.4)', color: '#FCA5A5', fontSize: '11px', fontWeight: 700 }}>
                Denied {worker.trust_breakdown.factors.denied_claims}
              </span>
              <span style={{ padding: '4px 8px', borderRadius: '999px', border: '1px solid rgba(96,165,250,0.35)', background: 'rgba(30,58,138,0.4)', color: '#93C5FD', fontSize: '11px', fontWeight: 700 }}>
                Avg Fraud {worker.trust_breakdown.factors.average_fraud_score}
              </span>
            </div>
          )}

          {formulaRows.length > 0 && (
            <div style={{ marginTop: '12px', display: 'grid', gap: '7px' }}>
              {formulaRows.map((row) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#CBD5E1' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: row.tone === 'pos' ? '#22C55E' : row.tone === 'neg' ? '#EF4444' : '#E2E8F0' }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(148,163,184,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Total</span>
            <span style={{ fontSize: '18px', fontWeight: 800, color: tColor }}>{totalTrust.toFixed(1)}</span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>{trustLabel(ts)}</p>
        </section>

        {/* 4. Download Policy */}
        <section className="stagger-4" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 className="label-micro" style={{ marginBottom: '4px', marginLeft: '4px' }}>{t(language, 'documents')}</h3>
          <button
            onClick={() => {
              if (!policyCertificateUrl) {
                showToast('Policy certificate unavailable. Tier not assigned yet.');
                return;
              }
              window.open(policyCertificateUrl, '_blank', 'noopener,noreferrer');
            }}
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
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#E2E8F0' }}>{t(language, 'download_tier_policy')}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px', fontFamily: 'monospace' }}>{policyCertificateFilename}</div>
              </div>
            </div>
            <ChevronRight size={16} color="var(--text-muted)" />
          </button>
        </section>

        {/* 5. Account Settings */}
        <section className="stagger-5" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 className="label-micro" style={{ marginBottom: '4px', marginLeft: '4px' }}>{t(language, 'account_settings')}</h3>

          <SettingsRow
            onClick={() => { setEarningsInput(''); setShowEarningsSheet(true); }}
            icon={<div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(52,211,153,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><TrendingUp size={17} color="#34D399" /></div>}
            label={t(language, 'update_earnings_declaration')}
            sublabel={`Currently ₹${worker?.avg_daily_earnings ?? '—'}/day`}
          />

          <SettingsRow
            onClick={() => showToast('Notification Preferences coming soon')}
            icon={<div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(96,165,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={17} color="#60A5FA" /></div>}
            label={t(language, 'notification_preferences')}
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
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#EF4444' }}>{t(language, 'sign_out')}</span>
            </div>
            <ChevronRight size={16} color="rgba(239,68,68,0.5)" />
          </button>
        </section>

      </div>
    </>
  );
}
