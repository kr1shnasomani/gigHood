'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { register, parseUserAgent, RegisterPayload } from '@/lib/auth';
import { seedDemo } from '@/lib/worker';
import { useAuthStore } from '@/store/authStore';

const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Jaipur', 'Lucknow', 'Kolkata', 'Guwahati'];

const DARK_STORE_ZONES: Record<string, string[]> = {
  Delhi: [
    'Connaught Place', 'Karol Bagh', 'Saket', 'Dwarka', 'Rohini',
    'Lajpat Nagar', 'Vasant Kunj', 'Janakpuri', 'Hauz Khas', 'Rajouri Garden',
  ],

  Mumbai: [
    'Andheri', 'Bandra', 'Juhu', 'Dadar', 'Powai',
    'Colaba', 'Borivali', 'Malad', 'Lower Parel', 'Goregaon',
  ],

  Bengaluru: [
    'Whitefield', 'Indiranagar', 'Koramangala', 'Electronic City', 'Yelahanka',
    'Jayanagar', 'Malleshwaram', 'BTM Layout', 'Hebbal', 'Marathahalli',
  ],

  Hyderabad: [
    'Banjara Hills', 'Jubilee Hills', 'Gachibowli', 'Hitech City', 'Kondapur',
    'Madhapur', 'Secunderabad', 'Kukatpally', 'Begumpet', 'LB Nagar',
  ],

  Chennai: [
    'Anna Nagar', 'Adyar', 'Sholinganallur', 'Tambaram', 'Velachery',
    'T. Nagar', 'Porur', 'Perungudi', 'Nungambakkam', 'Mylapore',
  ],

  Kolkata: [
    'Salt Lake (Bidhannagar)', 'New Town', 'Park Street', 'Ballygunge', 'Dum Dum',
    'Howrah', 'Behala', 'Garia', 'Alipore', 'Jadavpur',
  ],

  Jaipur: [
    'Jaipur', 'Dausa', 'Alwar', 'Sikar', 'Ajmer',
    'Tonk', 'Nagaur', 'Jhunjhunu', 'Bharatpur', 'Karauli',
  ],

  Lucknow: [
    'Lucknow', 'Unnao', 'Raebareli', 'Barabanki', 'Sitapur',
    'Hardoi', 'Kanpur Nagar', 'Kanpur Dehat', 'Fatehpur', 'Ayodhya',
  ],

  Guwahati: [
    'Kamrup Metropolitan', 'Kamrup', 'Nalbari', 'Barpeta', 'Darrang',
    'Morigaon', 'Goalpara', 'Bongaigaon', 'Baksa', 'Chirang',
  ],
};

export default function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const phoneFromUrl = searchParams.get('phone') || '';

  const [formData, setFormData] = useState({
    phone: phoneFromUrl,
    name: '',
    city: 'Delhi',
    dark_store_zone: 'Central Delhi',
    avg_daily_earnings: 500,
    upi_id: '',
  });

  const [metadata, setMetadata] = useState({
    device_model: '',
    device_os_version: '',
    sim_carrier: 'Jio',
    sim_registration_date: '2023-01-15',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const extractErrorMessage = (err: unknown): string => {
    if (typeof err === 'object' && err !== null) {
      const maybeResponse = (err as { response?: { data?: { detail?: string } } }).response;
      if (maybeResponse?.data?.detail) {
        return maybeResponse.data.detail;
      }
    }
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return 'Registration failed';
  };

  useEffect(() => {
    const { device_model, device_os_version } = parseUserAgent();
    setMetadata((prev) => ({ ...prev, device_model, device_os_version }));
  }, []);

  useEffect(() => {
    const zones = DARK_STORE_ZONES[formData.city] || [];
    const activeZone = formData.dark_store_zone;
    if (zones.length > 0 && !zones.includes(activeZone)) {
      setFormData((prev) => ({ ...prev, dark_store_zone: zones[0] }));
    }
  }, [formData.city, formData.dark_store_zone]);

  const requestGpsPermission = useCallback(() => {
    return new Promise<void>((resolve) => {
      if (typeof navigator === 'undefined') {
        resolve();
        return;
      }

      setIsRequestingGps(true);
      navigator.geolocation.getCurrentPosition(
        () => {
          setIsRequestingGps(false);
          resolve();
        },
        () => {
          setIsRequestingGps(false);
          resolve();
        }
      );
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.upi_id) {
      setError('Please fill in all fields');
      return;
    }

    if (!agreedTerms) {
      setError('Please accept the Terms & Conditions to continue');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload: RegisterPayload = {
        phone: formData.phone,
        name: formData.name,
        city: formData.city,
        dark_store_zone: formData.dark_store_zone,
        avg_daily_earnings: formData.avg_daily_earnings,
        upi_id: formData.upi_id,
        device_model: metadata.device_model,
        device_os_version: metadata.device_os_version,
        sim_carrier: metadata.sim_carrier,
        sim_registration_date: metadata.sim_registration_date,
      };

      const registerResponse = await register(payload);
      setAuth(registerResponse.access_token, registerResponse.worker);

      try {
        await seedDemo();
      } catch (seedErr) {
        console.error('Seed failed:', seedErr);
      }

      await requestGpsPermission();
      router.push('/worker-app/home');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const zones = DARK_STORE_ZONES[formData.city] || [];

  return (
    <>
      {showTermsModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(2, 6, 23, 0.72)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setShowTermsModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '78vh',
              overflowY: 'auto',
              borderRadius: '18px',
              background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 30, 0.98) 100%)',
              border: '1px solid var(--border-glass)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              padding: '20px 18px',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>
              gigHood Parametric Income Protection Terms & Conditions
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.55 }}>
              Please review these core terms carefully before onboarding.
            </p>

            <ol style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '18px', color: 'var(--text-secondary)' }}>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Nature of Policy:</strong> Parametric income protection triggered by DCI {'>'} 0.85.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Proof of Presence:</strong> Worker must be physically present in the disrupted zone.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Fraud Prevention:</strong> GPS spoofing or zone hopping will result in claim denial.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Waiting Period:</strong> A 7-day waiting period applies to new accounts.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Auto Trigger Rule:</strong> Coverage triggers only when your zone&apos;s DCI exceeds 0.85.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Payout Basis:</strong> Payout is calculated from your declared daily earnings and disruption duration.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Coverage Cap:</strong> Daily payout is capped by your assigned policy tier limit.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Event Close Logic:</strong> A disruption closes only after the DCI returns to stable levels.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Premium Obligation:</strong> Weekly premium deductions are required to keep coverage active.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Appeals:</strong> Denied or high-risk claims may enter review and appeal workflows.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'white' }}>Data Use & Consent:</strong> Device and location signals are used for eligibility, fraud checks, and claim automation.
              </li>
            </ol>

            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              style={{
                marginTop: '18px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0EA5E9 0%, #0D9488 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="page-content" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }} className="stagger-1">
        <div style={{ width: '80px', height: '80px', background: 'var(--bg-card)', borderRadius: '24px', backdropFilter: 'var(--glass-blur)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: 'var(--shadow-glow)', border: '1px solid var(--border-light)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-glow)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>Complete Your <span className="text-gradient">Profile</span></h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '15px' }}>Get protected in seconds</p>
      </div>

      <div className="glass-panel stagger-2">
        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Mobile Number</label>
            <input type="tel" value={formData.phone} disabled className="input-glass" style={{ opacity: 0.6 }} />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Full Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Priya Sharma" className="input-glass" required />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>City *</label>
            <select value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} className="input-glass" style={{ cursor: 'pointer' }}>
              {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Dark Store Zone *</label>
            <select value={formData.dark_store_zone} onChange={(e) => setFormData((prev) => ({ ...prev, dark_store_zone: e.target.value }))} className="input-glass" style={{ cursor: 'pointer' }}>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Avg Daily Earnings (₹) *</label>
            <input type="number" value={formData.avg_daily_earnings} onChange={(e) => setFormData((prev) => ({ ...prev, avg_daily_earnings: parseFloat(e.target.value) || 0 }))} placeholder="500" className="input-glass" min="100" max="5000" step="50" required />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>UPI ID *</label>
            <input type="text" value={formData.upi_id} onChange={(e) => setFormData((prev) => ({ ...prev, upi_id: e.target.value }))} placeholder="priya.sharma@upi" className="input-glass" required />
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>Device & SIM info auto-detected • Location access will be requested next</p>

          <label style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              required
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              I agree to the gigHood Parametric Income Protection{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setShowTermsModal(true);
                }}
                style={{ color: '#67E8F9', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                Terms & Conditions
              </button>
              .
            </span>
          </label>

          <button type="submit" className="btn-premium mt-4" disabled={isLoading || isRequestingGps || !formData.name || !formData.upi_id || !agreedTerms} style={{ opacity: isLoading || isRequestingGps || !agreedTerms ? 0.6 : 1, cursor: isLoading || isRequestingGps || !agreedTerms ? 'not-allowed' : 'pointer' }}>
            {isLoading ? <div className="spinner" /> : isRequestingGps ? 'Requesting location access...' : 'Create Account & Start Protected'}
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', marginTop: '40px' }} className="stagger-3">
        <p className="label-micro">Your data is encrypted & secure</p>
      </div>
      </main>
    </>
  );
}
