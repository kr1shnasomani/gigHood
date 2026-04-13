'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { sendOtp, verifyOtp } from '@/lib/auth';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getErrStatus = (err: unknown): number | undefined => {
    if (typeof err !== 'object' || err === null) {
      return undefined;
    }

    if ('status' in err && typeof (err as { status?: unknown }).status === 'number') {
      return (err as { status: number }).status;
    }

    const maybeResponse = (err as { response?: { status?: unknown } }).response;
    if (maybeResponse && typeof maybeResponse.status === 'number') {
      return maybeResponse.status;
    }

    return undefined;
  };

  const getErrMessage = (err: unknown, fallback: string): string => {
    if (typeof err === 'object' && err !== null) {
      const maybeDetail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      if (typeof maybeDetail === 'string' && maybeDetail.trim()) {
        return maybeDetail;
      }
    }

    if (err instanceof Error && err.message) {
      return err.message;
    }

    return fallback;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) return;
    setIsLoading(true);
    setError(null);
    try {
      await sendOtp(phone);
      setStep('otp');
    } catch (err: unknown) {
      console.error('OTP Send failed', err);
      setError(getErrMessage(err, 'Failed to send OTP. Try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setIsLoading(true);
    setError(null);

    const encodedPhone = encodeURIComponent(phone);

    try {
      const response = await verifyOtp(phone, otp);

      if (authMode === 'signin') {
        setAuth(response.access_token, response.worker);
        router.push('/worker-app/home');
        return;
      }

      setError('Account already exists. Please switch to Sign In.');
    } catch (err: unknown) {
      console.error('OTP Verify failed', err);

      if (getErrStatus(err) === 404) {
        if (authMode === 'signup') {
          router.push(`/worker-app/register?phone=${encodedPhone}`);
          return;
        }

        setError('Account not found. Please switch to Sign Up.');
        return;
      }
      
      setError(getErrMessage(err, 'Invalid OTP. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="page-content" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '40px' }} className="stagger-1">
        <div style={{ width: '80px', height: '80px', background: 'var(--bg-card)', borderRadius: '24px', backdropFilter: 'var(--glass-blur)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: 'var(--shadow-glow)', border: '1px solid var(--border-light)' }}>
          <Image src="/logo.jpeg" alt="gigHood logo" width={44} height={44} style={{ borderRadius: '12px' }} priority />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
          gigHood <span className="text-gradient">Protect</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
          Secure login for verified workers
        </p>
      </div>

      <div className="glass-panel stagger-2">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode('signin');
              setError(null);
              setStep('phone');
              setOtp('');
            }}
            disabled={isLoading}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: authMode === 'signin' ? '1px solid rgba(59, 130, 246, 0.6)' : '1px solid rgba(148, 163, 184, 0.3)',
              background: authMode === 'signin' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(15, 23, 42, 0.35)',
              color: authMode === 'signin' ? '#93C5FD' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMode('signup');
              setError(null);
              setStep('phone');
              setOtp('');
            }}
            disabled={isLoading}
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              border: authMode === 'signup' ? '1px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(148, 163, 184, 0.3)',
              background: authMode === 'signup' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.35)',
              color: authMode === 'signup' ? '#6EE7B7' : 'var(--text-secondary)',
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            Sign Up
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
          {authMode === 'signin'
            ? 'Use Sign In if you already created an account.'
            : 'Use Sign Up for first-time onboarding with a new number.'}
        </p>

        {error && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Mobile Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="input-glass"
                maxLength={15}
                required
              />
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Demo Phone: <strong style={{ color: 'var(--trust-emerald)' }}>9876543210</strong>
              </p>
            </div>
            <button 
              type="submit" 
              className="btn-premium mt-4"
              disabled={isLoading || phone.length < 10}
            >
              {isLoading ? <div className="spinner" /> : 'Continue securely'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>One-Time Password</label>
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="input-glass"
                style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '24px', fontWeight: 600 }}
                maxLength={6}
                required
              />
              <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Demo OTP: <strong style={{ color: 'var(--trust-emerald)' }}>123456</strong>
              </p>
            </div>
            <button 
              type="submit" 
              className="btn-premium mt-4"
              disabled={isLoading || otp.length < 6}
            >
              {isLoading ? <div className="spinner" /> : authMode === 'signin' ? 'Verify & Sign In' : 'Verify & Continue'}
            </button>
            <button 
              type="button" 
              onClick={() => { setStep('phone'); setOtp(''); }}
              style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer' }}
              disabled={isLoading}
            >
              Change number
            </button>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '40px' }} className="stagger-3">
        <p className="label-micro">Bank-grade encryption • ISO 27001</p>
      </div>
    </main>
  );
}
