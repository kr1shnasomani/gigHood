'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, Bell,
  CircleDollarSign, CloudLightning,
  Wallet, CheckCircle, ChevronLeft, ChevronRight,
  MessageSquare, FileText
} from 'lucide-react';
import { workerApi, simulateDisruption, processClaim } from '@/lib/worker';
import { useAuthStore } from '@/store/authStore';
import { LANGUAGE_OPTIONS, useLanguageStore } from '@/store/languageStore';
import { t } from '@/lib/i18n';
import { checkLocationPermission, requestLocationPermission, submitLocationPing } from '@/lib/location';

interface ClaimReceipt {
  claim_id: string;
  fraud_score: number;
  resolution_path: string;
  payout_amount: number | null;
  status: string;
  razorpay_payment_id: string;
  payout_transaction_id?: string;
  payout_channel?: string;
  pop_validated: boolean;
  gate2_result: string;
  fraud_flags: string[];
  decision_explanation?: {
    code: string;
    title: string;
    message: string;
    worker_tip: string;
  };
}

function SmsToast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: '14px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1200,
        background: 'rgba(2, 6, 23, 0.96)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        color: 'white',
        borderRadius: '12px',
        padding: '12px 14px',
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.45)',
        maxWidth: 'min(92vw, 720px)',
        animation: 'slideUpFade 0.25s ease both',
      }}
    >
      {message}
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const msg = String((error as { message: string }).message).trim();
    if (msg.length > 0) {
      return msg;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getResolutionPathColor(path: string): string {
  const normalized = (path || '').toLowerCase();
  if (normalized.includes('fast_track')) return '#10B981';
  if (normalized.includes('soft_queue')) return '#F59E0B';
  if (normalized.includes('active_verify')) return '#3B82F6';
  if (normalized.includes('denied')) return '#EF4444';
  return '#94A3B8';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DashboardPage() {
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const inferLanguageFromCity = useLanguageStore((s) => s.inferLanguageFromCity);

  // Load worker profile
  const { data: worker } = useQuery({
    queryKey: ['worker'],
    queryFn: workerApi.getMe,
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Load policy independently
  const { data: activePolicy } = useQuery({
    queryKey: ['policy'],
    queryFn: workerApi.getMyPolicy,
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Load DCI independently (refresh more often)
  const { data: dciData } = useQuery({
    queryKey: ['dci'],
    queryFn: workerApi.getDci,
    staleTime: 60 * 1000,
    enabled: !!accessToken,
  });

  // Load claims independently
  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: workerApi.getClaims,
    staleTime: 3 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Composite dashboard for backward compatibility
  const dashboard = worker && activePolicy && dciData
    ? {
        worker: { ...worker, dynamic_coverage_index: dciData.current_dci },
        active_policy: activePolicy,
        alerts: [],
        weekly_summary: {
          premium_paid: activePolicy?.weekly_premium || activePolicy?.premium_amount || 0,
          disruptions: claims.filter((c) => new Date(c.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
          total_paid_out: claims.filter((c) => c.status === 'paid').reduce((sum, c) => sum + (c.payout_amount ?? 0), 0),
        },
        dci_forecast: null,
      }
    : null;

  const isLoading = !worker || !activePolicy;
  const error = null;
  const refetch = () => {
    /* no-op */
  };

  // Phase 2 & 3 State
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [claimReceipt, setClaimReceipt] = useState<ClaimReceipt | null>(null);
  const [dciScore, setDciScore] = useState<number | null>(null);
  const [dciStatus, setDciStatus] = useState<'normal' | 'elevated' | 'disrupted' | 'degraded'>('degraded');
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [smsToast, setSmsToast] = useState<string | null>(null);
  const coverageCarouselRef = useRef<HTMLDivElement | null>(null);

  // Initialize DCI/status from dashboard payload.
  useEffect(() => {
    if (!dashboard?.worker) return;

    const rawDci = dashboard.worker.dynamic_coverage_index;
    const nextDci = typeof rawDci === 'number' && Number.isFinite(rawDci) ? rawDci : null;
    setDciScore(nextDci);

    if (nextDci === null) {
      setDciStatus('degraded');
      return;
    }

    if (nextDci > 0.85) {
      setDciStatus('disrupted');
    } else if (nextDci >= 0.5) {
      setDciStatus('elevated');
    } else {
      setDciStatus('normal');
    }
  }, [dashboard]);

  useEffect(() => {
    if (!dashboard?.worker?.city) {
      return;
    }
    inferLanguageFromCity(dashboard.worker.city);
  }, [dashboard?.worker?.city, inferLanguageFromCity]);

  useEffect(() => {
    if (!hasHydrated) return; // Wait for store to hydrate from localStorage
    
    if (!accessToken) {
      router.replace('/worker-app/login');
    }
  }, [hasHydrated, accessToken, router]);

  // Phase 2: Simulate Disruption
  const handleSimulateDisruption = useCallback(async () => {
    setIsSimulating(true);
    setSimulationError(null);

    try {
      // Call simulate endpoint - returns FINAL DCI status immediately
      // Weights: w=3.0 (weather), t=1.5 (traffic), p=2.0 (platform), s=1.2 (social)
      // Formula: DCI = sigmoid(0.45*3.0 + 0.25*1.5 + 0.20*2.0 + 0.10*1.2) ≈ sigmoid(2.155) ≈ 0.896 (disrupted)
      const result = await simulateDisruption({
        w: 3.0,   // Increased from 2.5 for more reliable disruption
        t: 1.5,   // Increased from 1.2
        p: 2.0,   // Increased from 1.8
        s: 1.2,   // Increased from 1.0
      });

      // Use response directly instead of polling - backend already calculated final DCI
      if (result && result.dci_status === 'disrupted') {
        setDciScore(result.current_dci);
        setDciStatus('disrupted');
        // Refresh dashboard data
        await refetch();
      } else {
        setSimulationError(`Simulation completed but did not reach disruption threshold (DCI: ${result?.current_dci?.toFixed(3) ?? 'N/A'}, Status: ${result?.dci_status ?? 'unknown'}). Try again with higher weights.`);
      }
    } catch (err: unknown) {
      console.error('Simulation error:', err);
      setSimulationError(getErrorMessage(err, 'Simulation failed. Please try again.'));
    } finally {
      setIsSimulating(false);
    }
  }, [refetch]);

  // Phase 3: Process Claim
  const handleProcessClaim = useCallback(async () => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const currentPermission = await checkLocationPermission();
      let hasLocationPermission = currentPermission === 'granted';

      if (!hasLocationPermission) {
        hasLocationPermission = await requestLocationPermission();
      }

      if (!hasLocationPermission) {
        setProcessingError('Location permission is required for claim eligibility.');
        setIsProcessing(false);
        return;
      }

      // Capture short burst of pings so backend guardrails can verify in-zone presence.
      // If ping capture partially fails, surface a useful reason instead of generic claim failure.
      let successfulPings = 0;
      let lastPingError: unknown = null;
      for (let i = 0; i < 3; i += 1) {
        try {
          await submitLocationPing();
          successfulPings += 1;
        } catch (pingError: unknown) {
          lastPingError = pingError;
        }

        if (i < 2) {
          await wait(1200);
        }
      }

      if (successfulPings === 0) {
        const pingHint = getErrorMessage(
          lastPingError,
          'Could not capture your latest location. Continuing with recent location history.'
        );
        setSmsToast(pingHint);
        setTimeout(() => setSmsToast(null), 4000);
      }

      const receipt = await processClaim();
      setClaimReceipt(receipt as ClaimReceipt);

      const channel = ((receipt as ClaimReceipt).payout_channel || 'UPI').toUpperCase();
      const phone = dashboard?.worker?.phone || '';
      const normalizedPhone = phone.startsWith('+91') ? phone : `+91 ${phone}`;
      const payoutAmountRaw = (receipt as ClaimReceipt).payout_amount;
      const payoutAmount: number = typeof payoutAmountRaw === 'number' && Number.isFinite(payoutAmountRaw)
        ? payoutAmountRaw
        : 0;
      if ((receipt as ClaimReceipt).status === 'paid') {
        setSmsToast(`SMS sent to ${normalizedPhone}: ₹${payoutAmount.toLocaleString('en-IN')} credited via ${channel}.`);
      } else {
        setSmsToast(`Claim updated for ${normalizedPhone}: status is ${(receipt as ClaimReceipt).status.toUpperCase()}.`);
      }
      setTimeout(() => setSmsToast(null), 5000);
    } catch (err: unknown) {
      console.error('Claim processing error:', err);
      setProcessingError(getErrorMessage(err, 'Claim processing failed. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  }, [dashboard?.worker?.phone]);

  if (!hasHydrated) {
    return (
      <div
        className="flex-col items-center justify-center"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: 'calc(100dvh - 84px)', width: '100%' }}
      >
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        <p className="text-muted" style={{ fontWeight: 500 }}>{t(language, 'initializing')}</p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div
        className="flex-col items-center justify-center"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: 'calc(100dvh - 84px)', width: '100%' }}
      >
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        <p className="text-muted" style={{ fontWeight: 500 }}>{t(language, 'redirecting_login')}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex-col items-center justify-center"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: 'calc(100dvh - 84px)', width: '100%' }}
      >
        <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px' }} />
        <p className="text-muted" style={{ fontWeight: 500 }}>{t(language, 'loading_dashboard')}</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex-col items-center justify-center h-full" style={{ display: 'flex', gap: '16px', padding: '24px' }}>
        <AlertCircle size={48} color="#EF4444" />
        <p className="text-muted" style={{ fontWeight: 500, textAlign: 'center' }}>Failed to load dashboard</p>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '16px' }}>
          {error?.message || 'Please check your connection and try again'}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: '10px 20px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const firstName = (worker?.name || '').split(' ')[0] || 'Worker';

  // Determine DCI status based on score
  const hasDci = typeof dciScore === 'number' && Number.isFinite(dciScore);
  const normalizedDci = hasDci ? dciScore : 0;
  const isNormal = dciStatus === 'normal' || (hasDci && normalizedDci < 0.5);
  const isElevated = dciStatus === 'elevated' || (hasDci && normalizedDci >= 0.5 && normalizedDci <= 0.85);
  const isDisrupted = dciStatus === 'disrupted' || (hasDci && normalizedDci > 0.85);

  const statusColor = !hasDci
    ? '#94A3B8'
    : isNormal ? 'var(--dci-normal)' : (isElevated ? 'var(--dci-elevated)' : 'var(--dci-disrupted)');
  const statusBg = !hasDci
    ? 'rgba(148, 163, 184, 0.12)'
    : isNormal ? 'var(--dci-normal-bg)' : (isElevated ? 'var(--dci-elevated-bg)' : 'var(--dci-disrupted-bg)');
  const statusLabel = !hasDci ? 'NO DATA' : isNormal ? 'NORMAL' : (isElevated ? 'ELEVATED' : 'DISRUPTED');
  const dciText = !hasDci
    ? 'DCI telemetry is still syncing for your zone. Risk score will appear after enough live signals are ingested.'
    : isNormal ? 'Zone operates optimally.' : (isElevated ? 'Your zone is at risk. Stay alert.' : 'Disruption detected. Claim processing available.');

  const lastUpdated = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const radius = 60;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * normalizedDci);

  // Format dates
  const startStr = dashboard?.active_policy?.week_start || dashboard?.active_policy?.start_date;
  const endStr = dashboard?.active_policy?.week_end || dashboard?.active_policy?.end_date;
  const start = startStr ? new Date(startStr) : null;
  const end = endStr ? new Date(endStr) : null;
  const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const policyWeek = start && end
    ? `${start.toLocaleDateString('en-US', dateOptions)} - ${end.toLocaleDateString('en-US', dateOptions)}`
    : '—';

  const coverageBadges = [
    'Heavy Rainfall',
    'Hazardous AQI',
    'Traffic Gridlock',
    'Platform Outage',
  ];

  const shiftCoverage = (direction: 'left' | 'right') => {
    const node = coverageCarouselRef.current;
    if (!node) return;

    node.scrollBy({
      left: direction === 'left' ? -160 : 160,
      behavior: 'smooth',
    });
  };

  // ===== RECEIPT VIEW (Phase 3 Success) =====
  if (claimReceipt) {
    const payoutSuccess = claimReceipt.status === 'paid';
    const receiptTitle = payoutSuccess ? 'Payout Successful' : claimReceipt.status === 'denied' ? 'Claim Denied' : 'Claim In Review';
    const receiptSubtitle = payoutSuccess
      ? 'Your claim has been processed and approved'
      : claimReceipt.status === 'denied'
        ? 'Your claim could not be approved for this event'
        : 'Your claim is being validated before payout';
    const receiptAccent = payoutSuccess ? '#10B981' : claimReceipt.status === 'denied' ? '#EF4444' : '#F59E0B';

    return (
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '28px', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', paddingBottom: '32px' }}>
        
        {/* Receipt Card */}
        <div style={{ width: '100%', maxWidth: '400px' }} className="stagger-1">
          <div className="glass-panel" style={{ padding: '32px 24px', textAlign: 'center', background: payoutSuccess ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)' : claimReceipt.status === 'denied' ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(127, 29, 29, 0.06) 100%)' : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(120, 53, 15, 0.06) 100%)', border: `1px solid ${receiptAccent}55` }}>
            
            {/* Success Icon */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 2s infinite' }}>
                <CheckCircle size={48} color={receiptAccent} />
              </div>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: receiptAccent, marginBottom: '8px' }}>{receiptTitle}</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '32px' }}>{receiptSubtitle}</p>

            {/* Claim Details Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
              
              {/* Claim ID */}
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px', textAlign: 'left' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Claim ID</p>
                <p style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'monospace', color: 'white', wordBreak: 'break-all' }}>{claimReceipt.claim_id}</p>
              </div>

              {/* Payout Amount - Prominent */}
              <div style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payout Amount</p>
                <p style={{ fontSize: '32px', fontWeight: 800, color: '#10B981' }}>
                  {typeof claimReceipt.payout_amount === 'number' && Number.isFinite(claimReceipt.payout_amount)
                    ? `₹${claimReceipt.payout_amount.toLocaleString('en-IN')}`
                    : 'TBD'}
                </p>
              </div>

              {/* Fraud Score */}
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fraud Score</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: claimReceipt.fraud_score === 0 ? '#10B981' : '#F59E0B' }}>
                  {claimReceipt.fraud_score.toFixed(0)}/100 {claimReceipt.fraud_score === 0 ? 'Clean' : 'Review'}
                </p>
              </div>

              {/* Resolution Path */}
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Processing Track</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: getResolutionPathColor(claimReceipt.resolution_path), textTransform: 'capitalize' }}>
                  {claimReceipt.resolution_path.replace('_', ' ')}
                </p>
              </div>

              {claimReceipt.decision_explanation && (
                <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Why this happened</p>
                  <p style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>
                    {claimReceipt.decision_explanation.title}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {claimReceipt.decision_explanation.message}
                  </p>
                  <p style={{ fontSize: '12px', color: '#93C5FD', lineHeight: 1.5, marginTop: '6px' }}>
                    Tip: {claimReceipt.decision_explanation.worker_tip}
                  </p>
                </div>
              )}

              {/* Payment ID */}
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment ID</p>
                <p style={{ fontSize: '13px', fontFamily: 'monospace', color: '#94A3B8', wordBreak: 'break-all' }}>{claimReceipt.razorpay_payment_id}</p>
              </div>

              {/* PoP Status */}
              <div style={{ padding: '16px', background: 'rgba(0, 0, 0, 0.3)', borderRadius: '12px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proof of Presence</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: claimReceipt.pop_validated ? '#10B981' : '#EF4444' }}>
                  {claimReceipt.pop_validated ? 'Validated' : 'Failed'}
                </p>
              </div>

            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
              <button
                onClick={() => {
                  setClaimReceipt(null);
                  router.push('/worker-app/home');
                }}
                className="btn-premium"
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)',
                  fontSize: '16px',
                }}
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => router.push('/worker-app/payouts')}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  color: '#10B981',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                View All Payouts
              </button>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '20px' }}>
              Receipt generated on {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

      </div>
    );
  }

  // ===== MAIN DASHBOARD VIEW =====
  return (
    <div className="dashboard-page">

      {smsToast && <SmsToast message={smsToast} />}

      {isProcessing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(2, 6, 23, 0.78)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            pointerEvents: 'all',
          }}
        >
          <div className="spinner" style={{ width: '42px', height: '42px', borderWidth: '3px' }} />
          <p style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Running 7-Layer Fraud Engine...</p>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Please wait while your claim is securely evaluated.</p>
        </div>
      )}
      
      {/* 1. Worker Greeting + Policy Status Card */}
      <section className="stagger-1">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: '4px' }}>
              Hey {firstName} 👋
            </h2>
            <p className="label-micro" style={{ fontSize: '13px' }}>
              {worker.city} • {t(language, 'zone')}: <span style={{ color: 'var(--text-primary)' }}>{worker.dark_store_zone}</span>
            </p>
          </div>
          <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <Bell size={20} color="var(--text-secondary)" />
          </div>
        </header>

        <div className="glass-panel" style={{ padding: '10px 14px', marginBottom: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {t(language, 'select_language')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t(language, 'applies_entire_app')}</span>
          </div>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGE_OPTIONS)[number]['code'])}
            style={{
              minWidth: '170px',
              padding: '10px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-glass)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.code} value={option.code} style={{ background: '#0f172a', color: 'white' }}>
                {option.label} - {option.name}
              </option>
            ))}
          </select>
        </div>

        <div className="glass-panel status-card" style={{ borderLeftColor: statusColor }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <ShieldCheck size={18} color={statusColor} />
              <span style={{ fontSize: '15px', fontWeight: 600 }}>
                {dashboard?.active_policy ? `Active Tier ${dashboard.active_policy.tier}` : 'Tier Pending Calculation'}
              </span>
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{policyWeek}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              Weekly Premium: <strong style={{ color: 'white' }}>
                {dashboard?.active_policy ? `₹${dashboard.active_policy.weekly_premium ?? dashboard.active_policy.premium_amount ?? '—'}` : '—'}
              </strong>
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>
              Cap: <strong style={{ color: 'white' }}>
                {dashboard?.active_policy ? `₹${dashboard.active_policy.coverage_cap_daily}/day` : '—'}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Live Zone Risk Panel */}
      <section className="stagger-2 glass-panel risk-panel">
        <div style={{ position: 'absolute', top: '-50px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', background: `${statusColor}20`, filter: 'blur(50px)', borderRadius: '50%', pointerEvents: 'none' }} />
        
        <div className="risk-head">
          <h3 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>Zone Risk Level</h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated: {lastUpdated}</span>
        </div>
        
        {/* DCI Gauge */}
        <div className="risk-gauge-wrap">
          <svg className="gauge-svg" width="220" height="90" viewBox="0 0 140 75" style={{ overflow: 'visible' }}>
            <defs>
              <filter id="glow-panel" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <path
              d="M 10 72 A 60 60 0 0 1 130 72"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <path
              d="M 10 72 A 60 60 0 0 1 130 72"
              fill="none"
              stroke={statusColor}
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="url(#glow-panel)"
              style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)', transformOrigin: '70px 72px' }}
            />
          </svg>
          
          <div className="risk-score">
            <div style={{ fontSize: '42px', fontWeight: 800, lineHeight: 1, letterSpacing: '-1px', textShadow: `0 4px 20px ${statusColor}60` }} className="tabular-nums">
              {hasDci ? normalizedDci.toFixed(2) : '--'}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.5px' }}>DCI Score / 1.00</div>
            <div className="badge-pill" style={{ display: 'inline-flex', marginTop: '10px', background: statusBg, color: statusColor, borderColor: `${statusColor}40`, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '11px' }}>
              {statusLabel}
            </div>
          </div>
        </div>

        <p className="risk-caption">
          {dciText}
        </p>
      </section>

      {/* 3. What Is Covered */}
      <section className="stagger-3" style={{ marginTop: '-10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p className="label-micro" style={{ fontSize: '11px' }}>What Is Covered</p>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              aria-label="Scroll coverage badges left"
              onClick={() => shiftCoverage('left')}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'rgba(15, 23, 42, 0.45)',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              aria-label="Scroll coverage badges right"
              onClick={() => shiftCoverage('right')}
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'rgba(15, 23, 42, 0.45)',
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div
          ref={coverageCarouselRef}
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '2px',
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {coverageBadges.map((label) => (
            <span
              key={label}
              style={{
                whiteSpace: 'nowrap',
                padding: '8px 12px',
                borderRadius: '999px',
                background: 'rgba(14, 165, 233, 0.08)',
                border: '1px solid rgba(14, 165, 233, 0.22)',
                color: '#BAE6FD',
                fontSize: '12px',
                fontWeight: 600,
                scrollSnapAlign: 'start',
              }}
            >
              {label === 'Heavy Rainfall' && '🌧️ '}
              {label === 'Hazardous AQI' && '🌫️ '}
              {label === 'Traffic Gridlock' && '🚧 '}
              {label === 'Platform Outage' && '📉 '}
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* 4. Phase 2: Simulate Disruption Button */}
      {!isDisrupted && (
        <section className="stagger-4">
          <button
            onClick={handleSimulateDisruption}
            disabled={isSimulating}
            className="action-button primary"
            style={{ background: isSimulating ? 'rgba(14, 165, 233, 0.3)' : undefined }}
          >
            {isSimulating ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                Simulating Extreme Weather...
              </>
            ) : (
              <>
                <CloudLightning size={20} />
                Simulate Extreme Weather
              </>
            )}
          </button>
          {simulationError && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '14px' }}>
              {simulationError}
            </div>
          )}
        </section>
      )}

      {/* 5. Phase 3: Process Claim Button (only when disrupted) */}
      {isDisrupted && !claimReceipt && (
        <section className="stagger-4">
          <button
            onClick={handleProcessClaim}
            disabled={isProcessing}
            className="action-button success"
            style={{ background: isProcessing ? 'rgba(16, 185, 129, 0.3)' : undefined }}
          >
            {isProcessing ? (
              <>
                <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
                Processing Claim...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Process Claim
              </>
            )}
          </button>
          {processingError && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '14px' }}>
              {processingError}
            </div>
          )}
        </section>
      )}

      {/* 6. Earnings Snapshot */}
      <section className="stagger-5">
        <h3 className="label-micro section-title">Earnings Snapshot</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Declared Avg</span>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'white' }}>₹{worker.avg_daily_earnings}</span>
          </div>
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Coverage Cap</span>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--trust-emerald)' }}>
              {dashboard?.active_policy ? `₹${dashboard.active_policy.coverage_cap_daily}` : '—'}
              {dashboard?.active_policy && <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-muted)' }}>/day</span>}
            </span>
          </div>
        </div>
      </section>

      {/* 7. Weekly Summary */}
      <section className="stagger-5">
        <h3 className="label-micro section-title">This Week&apos;s Summary</h3>
        <div className="summary-grid">
          <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet size={13} color="#94A3B8" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Premium</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>₹{dashboard?.weekly_summary.premium_paid ?? '—'}</span>
          </div>

          <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertCircle size={13} color="#F59E0B" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Events</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700 }}>{dashboard?.weekly_summary.disruptions ?? '—'}</span>
          </div>

          <div className="glass-panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CircleDollarSign size={13} color="#10B981" />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Paid Out</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#10B981' }}>₹{dashboard?.weekly_summary.total_paid_out ?? '—'}</span>
          </div>
        </div>
      </section>

      {/* 8. Quick Actions */}
      <section className="stagger-5">
        <h3 className="label-micro section-title">Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
          <Link href="/worker-app/payouts" style={{ textDecoration: 'none' }}>
            <div className="glass-panel hover-glow" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', height: '100%' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={18} color="#8B5CF6" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#E2E8F0', lineHeight: 1.2 }}>View<br/>Payouts</span>
            </div>
          </Link>

          <Link href="/worker-app/chat" style={{ textDecoration: 'none' }}>
            <div className="glass-panel hover-glow" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', height: '100%' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={18} color="#3B82F6" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#E2E8F0', lineHeight: 1.2 }}>Gig<br/>Copilot</span>
            </div>
          </Link>

          <Link href="/worker-app/profile?action=update-earnings" style={{ textDecoration: 'none' }}>
            <div className="glass-panel hover-glow" style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center', height: '100%' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="#94A3B8" />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#E2E8F0', lineHeight: 1.2 }}>Update<br/>Earnings</span>
            </div>
          </Link>
        </div>
      </section>

    </div>
  );
}
