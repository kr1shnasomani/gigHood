import api from './api';

export interface WorkerProfile {
  id: string; phone: string; name: string; city: string;
  dark_store_zone: string; hex_id: string;
  avg_daily_earnings: number; upi_id: string;
  platform_affiliation?: string;
  platform_id?: string;
  is_platform_verified?: boolean;
  trust_score: number; status: string; device_model?: string;
  tier?: string;
  dynamic_coverage_index?: number;
}

export interface PolicyData {
  id: string; tier: 'A' | 'B' | 'C' | string;
  type: string;
  weekly_premium?: number;
  premium_amount?: number;
  coverage_cap_daily: number; // actual DB field: ₹/day cap per tier
  status: string; is_waiting_period: boolean;
  week_start?: string; week_end?: string;
  start_date?: string; end_date?: string; created_at: string;
  expiry?: string;
}

export interface DciData {
  hex_id: string; current_dci: number;
  dci_status: 'normal' | 'elevated' | 'disrupted';
  city: string; dark_store_zone: string; note?: string;
}

export interface Claim {
  id: string;
  payout_amount: number;
  disrupted_hours: number;
  resolution_path: 'fast_track' | 'soft_queue' | 'active_verify' | 'denied' | string;
  status: 'pending' | 'approved' | 'paid' | 'processing' | 'denied' | 'appealed' | string;
  fraud_score: number;
  pop_validated: boolean;
  razorpay_payment_id?: string;
  razorpay_payout_id?: string;
  payout_transaction_id?: string;
  payout_channel?: string;
  created_at: string;
  resolved_at?: string;
}

export interface Alert {
  id: string;
  title: string;
  message: string;
}

export interface WeeklySummary {
  premium_paid: number;
  disruptions: number;
  total_paid_out: number;
}

export interface DashboardResponse {
  worker: WorkerProfile;
  active_policy: PolicyData | null;
  alerts: Alert[];
  weekly_summary: WeeklySummary;
  dci_forecast: number | null;
}

export async function getMe(): Promise<WorkerProfile> {
  return (await api.get('/workers/me')).data;
}
export async function getMyPolicy(): Promise<PolicyData> {
  return (await api.get('/workers/me/policy')).data;
}
export async function getDci(): Promise<DciData> {
  return (await api.get('/workers/me/hex/dci')).data;
}
export async function getClaims(): Promise<Claim[]> {
  return (await api.get('/workers/me/claims')).data;
}
export async function sendChatMessage(message: string, language = 'en') {
  try {
    const res = await api.post('/chat', { message, language });
    // Backend ChatResponse schema: { reply, language, worker_name }
    return { response: res.data.reply ?? res.data.response ?? '' };
  } catch {
    return { response: '' }; // caller handles errors
  }
}

// Composite dashboard function
export async function getDashboard(): Promise<DashboardResponse> {
  const worker = await getMe();

  const [policyResult, dciResult, claimsResult] = await Promise.allSettled([
    getMyPolicy(),
    getDci(),
    getClaims(),
  ]);

  const policy = policyResult.status === 'fulfilled'
    ? policyResult.value
    : null;

  const dciResponse = dciResult.status === 'fulfilled'
    ? dciResult.value
    : null;

  const claims = claimsResult.status === 'fulfilled'
    ? claimsResult.value
    : [];

  const paidClaims = claims.filter((c) => c.status === 'paid' || c.status === 'approved');
  const totalPaidOut = paidClaims.reduce((sum, c) => sum + (c.payout_amount ?? 0), 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const disruptionsThisWeek = claims.filter((c) => new Date(c.created_at) >= weekStart).length;

  return {
    worker: {
      ...worker,
      tier: policy?.tier,
      dynamic_coverage_index: dciResponse?.current_dci ?? 0.0,
    },
    active_policy: policy,
    alerts: (dciResponse?.current_dci ?? 0) > 0.5
      ? [{ id: 'a1', title: 'High Disruption Area', message: 'Proceed with caution. Claims process is expedited.' }]
      : [],
    weekly_summary: {
      premium_paid: policy?.weekly_premium || policy?.premium_amount || 0,
      disruptions: disruptionsThisWeek,
      total_paid_out: totalPaidOut,
    },
    dci_forecast: null,
  };
}

export interface SeedDemoResponse {
  worker_id: string;
  hex_id: string;
  dci_history_rows: number;
  location_ping_rows: number;
  rolling_4w_avg: number;
  gate2_mock_preview: unknown;
}

export interface SimulateDisruptionRequest {
  w: number;
  t: number;
  p: number;
  s: number;
}

export interface SimulateDisruptionResponse {
  hex_id: string;
  raw: number;
  current_dci: number;
  dci_status: 'normal' | 'elevated' | 'disrupted';
}

export interface ProcessClaimResponse {
  claim_id: string;
  event_id: string;
  policy_id: string;
  fraud_score: number;
  fraud_flags: string[];
  gate2_result: string;
  resolution_path: string;
  payout_amount: number;
  razorpay_payment_id: string;
  payout_transaction_id?: string;
  payout_channel?: string;
  pop_validated: boolean;
  status: string;
}

// Demo trigger endpoints
export async function seedDemo(): Promise<SeedDemoResponse> {
  const res = await api.post('/workers/me/demo/seed');
  return res.data;
}

export async function simulateDisruption(
  payload: SimulateDisruptionRequest
): Promise<SimulateDisruptionResponse> {
  const res = await api.post('/workers/me/demo/simulate-disruption', payload);
  return res.data;
}

export async function processClaim(): Promise<ProcessClaimResponse> {
  const res = await api.post('/workers/me/demo/process-claim');
  return res.data;
}

// Poll until DCI is disrupted
export async function pollUntilDisrupted(
  maxAttempts: number = 60,
  intervalMs: number = 1000
): Promise<DciData | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const dci = await getDci();
      if (dci.dci_status === 'disrupted') {
        return dci;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (err) {
      console.error('Poll error:', err);
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return null;
}

export const workerApi = {
  getMe,
  getMyPolicy,
  getDci,
  getClaims,
  sendChatMessage,
  getDashboard,
  seedDemo,
  simulateDisruption,
  processClaim,
  pollUntilDisrupted,
};
