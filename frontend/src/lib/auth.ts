import api from './api';
import { WorkerProfile } from '@/store/authStore';
import { getMe } from './worker';

const JWT_KEY = 'gighood_jwt';

export function saveToken(token: string) {
  localStorage.setItem(JWT_KEY, token);
}
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(JWT_KEY);
}
export function deleteToken() {
  localStorage.removeItem(JWT_KEY);
}
export function isAuthenticated(): boolean {
  return !!getToken();
}

function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return phone;
}

export async function sendOtp(phone: string): Promise<void> {
  await api.post('/workers/auth/otp/send', { phone: normalizePhone(phone) });
}

export interface VerifyOtpResponse {
  access_token: string;
  worker: WorkerProfile;
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  const normalizedPhone = normalizePhone(phone);
  const res = await api.post('/workers/auth/otp/verify', { phone: normalizedPhone, otp });
  const worker = res.data.worker || (await getMe());
  return {
    access_token: res.data.access_token,
    worker,
  };
}

export interface RegisterPayload {
  phone: string;
  name: string;
  city: string;
  platform_affiliation: string;
  platform_id: string;
  is_platform_verified: boolean;
  dark_store_zone: string;
  avg_daily_earnings: number;
  upi_id: string;
  device_model: string;
  device_os_version: string;
  sim_carrier: string;
  sim_registration_date: string;
}

export interface RegisterResponse {
  access_token: string;
  worker: WorkerProfile;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  const normalizedPayload = {
    ...payload,
    phone: normalizePhone(payload.phone),
  };
  const res = await api.post('/workers/auth/register', normalizedPayload);
  const worker = res.data.worker || (await getMe());
  return {
    access_token: res.data.access_token,
    worker,
  };
}

export function parseUserAgent(): { device_model: string; device_os_version: string } {
  if (typeof navigator === 'undefined') {
    return { device_model: 'Unknown', device_os_version: '0.0' };
  }

  const ua = navigator.userAgent;
  let device_model = 'Unknown Device';
  let device_os_version = '0.0';

  // Parse device model
  if (/iPhone/.test(ua)) {
    device_model = 'iPhone';
    const match = ua.match(/iPhone OS ([\d_]+)/);
    if (match) device_os_version = match[1].replace(/_/g, '.');
  } else if (/iPad/.test(ua)) {
    device_model = 'iPad';
    const match = ua.match(/OS ([\d_]+)/);
    if (match) device_os_version = match[1].replace(/_/g, '.');
  } else if (/Android/.test(ua)) {
    device_model = 'Android Device';
    const match = ua.match(/Android ([\d.]+)/);
    if (match) device_os_version = match[1];
  } else if (/Mac/.test(ua)) {
    device_model = 'Mac';
    const match = ua.match(/Mac OS X ([\d_]+)/);
    if (match) device_os_version = match[1].replace(/_/g, '.');
  } else if (/Windows/.test(ua)) {
    device_model = 'Windows PC';
    const match = ua.match(/Windows NT ([\d.]+)/);
    if (match) device_os_version = match[1];
  }

  return { device_model, device_os_version };
}
