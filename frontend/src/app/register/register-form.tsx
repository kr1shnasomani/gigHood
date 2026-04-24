'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { register, parseUserAgent, RegisterPayload } from '@/lib/auth';
import { seedDemo } from '@/lib/worker';
import { useAuthStore } from '@/store/authStore';

const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Jaipur', 'Lucknow', 'Kolkata', 'Guwahati'];
const DELIVERY_PLATFORMS = ['Zepto', 'Blinkit', 'Other'];

function toTenDigitPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits.slice(0, 10);
}

const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  Delhi: { lat: 28.6139, lon: 77.2090 },
  Mumbai: { lat: 19.0760, lon: 72.8777 },
  Bengaluru: { lat: 12.9716, lon: 77.5946 },
  Chennai: { lat: 13.0827, lon: 80.2707 },
  Hyderabad: { lat: 17.3850, lon: 78.4867 },
  Jaipur: { lat: 26.9124, lon: 75.7873 },
  Lucknow: { lat: 26.8467, lon: 80.9462 },
  Kolkata: { lat: 22.5726, lon: 88.3639 },
  Guwahati: { lat: 26.1445, lon: 91.7362 },
};

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
    'Potheri', 'Kattankulathur',
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

  const phoneFromUrl = toTenDigitPhone(searchParams.get('phone') || '');
  const shouldSeedDemo = searchParams.get('demo') === '1';

  const [formData, setFormData] = useState({
    phone: phoneFromUrl,
    name: '',
    city: '',
    platform_affiliation: '',
    platform_id: '',
    dark_store_zone: '',
    avg_daily_earnings: '',
    upi_id: '',
  });

  const [metadata, setMetadata] = useState({
    device_model: '',
    device_os_version: '',
    sim_carrier: 'Jio',
    sim_registration_date: '2023-01-15',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isVerifyingPlatformId, setIsVerifyingPlatformId] = useState(false);
  const [isPlatformVerified, setIsPlatformVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRequestingGps, setIsRequestingGps] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'detecting' | 'detected' | 'denied' | 'manual' | 'unsupported'>('idle');
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

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const inferNearestSupportedCity = (lat: number, lon: number): string | null => {
    let bestCity: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const city of CITIES) {
      const center = CITY_COORDINATES[city];
      if (!center) continue;
      const dist = haversineKm(lat, lon, center.lat, center.lon);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestCity = city;
      }
    }

    // Do not infer when user is very far from supported regions.
    if (bestDistance > 120) {
      return null;
    }
    return bestCity;
  };

  useEffect(() => {
    const { device_model, device_os_version } = parseUserAgent();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetadata((prev) => ({ ...prev, device_model, device_os_version }));
  }, []);

  useEffect(() => {
    const normalizeCity = (raw?: string | null): string | null => {
      if (!raw) return null;
      const val = raw.trim().toLowerCase();
      const aliases: Record<string, string> = {
        bangalore: 'Bengaluru',
        bengaluru: 'Bengaluru',
        mumbai: 'Mumbai',
        bombay: 'Mumbai',
        delhi: 'Delhi',
        'new delhi': 'Delhi',
        chennai: 'Chennai',
        hyderabad: 'Hyderabad',
        jaipur: 'Jaipur',
        lucknow: 'Lucknow',
        kolkata: 'Kolkata',
        calcutta: 'Kolkata',
        guwahati: 'Guwahati',
      };
      const mapped = aliases[val];
      if (mapped && CITIES.includes(mapped)) return mapped;
      const title = raw.trim();
      return CITIES.includes(title) ? title : null;
    };

    const inferCityFromIp = async (): Promise<string | null> => {
      try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) return null;
        const data = await response.json();
        const rawCity = (data?.city as string | undefined) || (data?.region as string | undefined) || null;
        return normalizeCity(rawCity);
      } catch {
        return null;
      }
    };

    const applyDetectedCity = (city: string) => {
      const zones = DARK_STORE_ZONES[city] || [];
      setFormData((prev) => ({
        ...prev,
        city,
        dark_store_zone: zones[0] || '',
      }));
      setLocationStatus('detected');
    };

    const getPosition = (options: PositionOptions): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const detectCityFromLocation = async () => {
      if (typeof navigator === 'undefined' || !navigator.geolocation || !window.isSecureContext) {
        setLocationStatus('unsupported');
        return;
      }

      setLocationStatus('detecting');

      try {
        let position: GeolocationPosition;
        try {
          position = await getPosition({
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 5 * 60 * 1000,
          });
        } catch {
          // Retry once with relaxed options; high-accuracy often fails indoors.
          position = await getPosition({
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 10 * 60 * 1000,
          });
        }

        const { latitude, longitude } = position.coords;
        let normalized: string | null = null;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          if (response.ok) {
            const data = await response.json();
            const address = data?.address ?? {};
            const rawCity = address.city ?? address.town ?? address.village ?? address.state_district ?? address.state;
            normalized = normalizeCity(rawCity);
          }
        } catch {
          normalized = null;
        }

        if (!normalized) {
          normalized = inferNearestSupportedCity(latitude, longitude);
        }

        if (normalized) {
          applyDetectedCity(normalized);
          return;
        }

        const ipCity = await inferCityFromIp();
        if (ipCity) {
          applyDetectedCity(ipCity);
          return;
        }

        setLocationStatus('manual');
      } catch (geoError: unknown) {
        const err = geoError as GeolocationPositionError;
        const ipCity = await inferCityFromIp();
        if (ipCity) {
          applyDetectedCity(ipCity);
          return;
        }

        if (err?.code === 1) {
          setLocationStatus('denied');
          return;
        }

        setLocationStatus('manual');
      }
    };

    detectCityFromLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const zones = DARK_STORE_ZONES[formData.city] || [];
    const activeZone = formData.dark_store_zone;
    if (zones.length > 0 && !zones.includes(activeZone)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData((prev) => ({ ...prev, dark_store_zone: zones[0] }));
    }
  }, [formData.city, formData.dark_store_zone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPlatformVerified(false);
  }, [formData.platform_id, formData.platform_affiliation]);

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
    if (!formData.name || !formData.upi_id || !formData.platform_affiliation || !formData.platform_id || !formData.city || !formData.dark_store_zone) {
      setError('Please fill in all fields');
      return;
    }

    if (!/^\d{10}$/.test(formData.phone)) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    const parsedEarnings = Number(formData.avg_daily_earnings);
    if (!Number.isFinite(parsedEarnings) || parsedEarnings <= 0) {
      setError('Please enter a valid average daily earnings amount');
      return;
    }

    if (!isPlatformVerified) {
      setError('Please verify your Platform Employee ID before submitting');
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
        platform_affiliation: formData.platform_affiliation,
        platform_id: formData.platform_id,
        is_platform_verified: true,
        dark_store_zone: formData.dark_store_zone,
        avg_daily_earnings: parsedEarnings,
        upi_id: formData.upi_id,
        device_model: metadata.device_model,
        device_os_version: metadata.device_os_version,
        sim_carrier: metadata.sim_carrier,
        sim_registration_date: metadata.sim_registration_date,
      };

      const registerResponse = await register(payload);
      setAuth(registerResponse.access_token, registerResponse.worker);

      if (shouldSeedDemo) {
        try {
          await seedDemo();
        } catch (seedErr) {
          console.error('Seed failed:', seedErr);
        }
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

  const handleVerifyPlatformId = () => {
    if (!formData.platform_id.trim() || !formData.platform_affiliation) {
      setError('Please select a platform and enter Platform Employee ID first');
      return;
    }

    setError(null);
    setIsVerifyingPlatformId(true);
    setTimeout(() => {
      setIsVerifyingPlatformId(false);
      setIsPlatformVerified(true);
    }, 1500);
  };

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
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
              gigHood Parametric Income Protection Terms & Conditions
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.55 }}>
              Please review these core terms carefully before onboarding.
            </p>

            <ol style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '18px', color: 'var(--text-secondary)' }}>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Nature of Policy:</strong> Parametric income protection triggered by DCI {'>'} 0.85.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Proof of Presence:</strong> Worker must be physically present in the disrupted zone.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Fraud Prevention:</strong> GPS spoofing or zone hopping will result in claim denial.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Waiting Period:</strong> A 7-day waiting period applies to new accounts.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Auto Trigger Rule:</strong> Coverage triggers only when your zone&apos;s DCI exceeds 0.85.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Payout Basis:</strong> Payout is calculated from your declared daily earnings and disruption duration.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Coverage Cap:</strong> Daily payout is capped by your assigned policy tier limit.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Event Close Logic:</strong> A disruption closes only after the DCI returns to stable levels.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Premium Obligation:</strong> Weekly premium deductions are required to keep coverage active.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Appeals:</strong> Denied or high-risk claims may enter review and appeal workflows.
              </li>
              <li style={{ lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Data Use & Consent:</strong> Device and location signals are used for eligibility, fraud checks, and claim automation.
              </li>
            </ol>

            <div style={{ marginTop: '16px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-glass)', background: 'rgba(255, 255, 255, 0.02)' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#FCA5A5', marginBottom: '8px' }}>Policy Exclusions (No Payout Trigger)</p>
              <ul style={{ margin: 0, paddingLeft: '18px', display: 'grid', gap: '8px', color: 'var(--text-secondary)' }}>
                <li style={{ lineHeight: 1.5 }}>War, armed conflict, or civil war events.</li>
                <li style={{ lineHeight: 1.5 }}>Government-declared national emergency or pandemic shutdown events.</li>
                <li style={{ lineHeight: 1.5 }}>Platform-initiated worker account deactivation or suspension.</li>
                <li style={{ lineHeight: 1.5 }}>Disruptions shorter than minimum trigger duration (brief DCI spikes).</li>
                <li style={{ lineHeight: 1.5 }}>Claims raised during the initial 7-day waiting period.</li>
                <li style={{ lineHeight: 1.5 }}>Zones below minimum active policyholder density threshold.</li>
                <li style={{ lineHeight: 1.5 }}>Self-inflicted outages (worker app issues, personal device/network failure).</li>
                <li style={{ lineHeight: 1.5 }}>Disruptions outside your registered dark-store assignment zone.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowTermsModal(false)}
              style={{
                marginTop: '18px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0EA5E9 0%, #0D9488 100%)',
                color: 'var(--text-primary)',
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
          <Image src="/logo.jpeg" alt="gigHood logo" width={44} height={44} style={{ borderRadius: '12px' }} priority />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>Complete Your <span className="text-gradient">Profile</span></h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>Get protected in seconds</p>
      </div>

      <div className="glass-panel stagger-2">
        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', marginBottom: '20px', fontSize: '14px', textAlign: 'center' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Mobile Number</label>
            <input
              type="tel"
              value={formData.phone}
              disabled
              className="input-glass"
              minLength={10}
              maxLength={10}
              pattern="[0-9]{10}"
              style={{ opacity: 0.6 }}
            />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Full Name *</label>
            <input type="text" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Priya Sharma" className="input-glass" required />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>City *</label>
            <select value={formData.city} onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))} className="input-glass" style={{ cursor: 'pointer' }} required>
              <option value="" disabled>Select location</option>
              {CITIES.map((city) => <option key={city} value={city}>{city}</option>)}
            </select>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
              {locationStatus === 'detecting' && 'Detecting your location...'}
              {locationStatus === 'detected' && 'Location detected and city selected automatically.'}
              {locationStatus === 'denied' && 'Location permission is blocked in browser settings for this site. Enable location for this site and retry, or choose your city manually.'}
              {locationStatus === 'manual' && 'Live GPS position is currently unavailable. We tried nearest-city and IP fallback, but still need manual selection.'}
              {locationStatus === 'unsupported' && 'Auto-detect needs HTTPS and browser geolocation support. Please choose your city manually.'}
            </p>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Primary Delivery Platform *</label>
            <select value={formData.platform_affiliation} onChange={(e) => setFormData((prev) => ({ ...prev, platform_affiliation: e.target.value }))} className="input-glass" style={{ cursor: 'pointer' }} required>
              <option value="" disabled>Select your primary platform</option>
              {DELIVERY_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
            </select>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Platform Employee ID *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
              <input
                type="text"
                value={formData.platform_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, platform_id: e.target.value.toUpperCase() }))}
                placeholder="ZEP-8492"
                className="input-glass"
                required
                style={{
                  borderColor: isPlatformVerified ? 'rgba(16, 185, 129, 0.7)' : undefined,
                  boxShadow: isPlatformVerified ? '0 0 0 1px rgba(16, 185, 129, 0.35) inset' : undefined,
                }}
              />
              <button
                type="button"
                onClick={handleVerifyPlatformId}
                disabled={isVerifyingPlatformId || !formData.platform_id || !formData.platform_affiliation || isPlatformVerified}
                style={{
                  borderRadius: '10px',
                  padding: '0 12px',
                  minHeight: '44px',
                  fontWeight: 700,
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-glass)',
                  background: isPlatformVerified
                    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                    : 'rgba(14, 165, 233, 0.2)',
                  opacity: isVerifyingPlatformId ? 0.8 : 1,
                  cursor: isVerifyingPlatformId ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isVerifyingPlatformId && <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />}
                {isVerifyingPlatformId ? 'Contacting Partner API...' : isPlatformVerified ? 'Verified' : 'Verify ID'}
              </button>
            </div>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Dark Store Zone *</label>
            <select value={formData.dark_store_zone} onChange={(e) => setFormData((prev) => ({ ...prev, dark_store_zone: e.target.value }))} className="input-glass" style={{ cursor: 'pointer' }} required disabled={!formData.city}>
              <option value="" disabled>Select dark store zone</option>
              {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
            </select>
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>Avg Daily Earnings (₹) *</label>
            <input type="number" value={formData.avg_daily_earnings} onChange={(e) => setFormData((prev) => ({ ...prev, avg_daily_earnings: e.target.value }))} placeholder="e.g. 500" className="input-glass" min="100" max="5000" step="1" required />
          </div>

          <div>
            <label className="label-micro" style={{ marginBottom: '8px', display: 'block' }}>UPI ID *</label>
            <input type="text" value={formData.upi_id} onChange={(e) => setFormData((prev) => ({ ...prev, upi_id: e.target.value }))} placeholder="priya.sharma@upi" className="input-glass" required />
          </div>

          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px' }}>Device & SIM info auto-detected • Location access will be requested next</p>

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

          <button type="submit" className="btn-premium mt-4" disabled={isLoading || isRequestingGps || !formData.name || !formData.city || !formData.dark_store_zone || !formData.upi_id || !formData.avg_daily_earnings || !formData.platform_affiliation || !formData.platform_id || !isPlatformVerified || !agreedTerms} style={{ opacity: isLoading || isRequestingGps || !agreedTerms ? 0.6 : 1, cursor: isLoading || isRequestingGps || !agreedTerms ? 'not-allowed' : 'pointer' }}>
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
