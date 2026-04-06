import api from '../api';

export interface AdminKPIs {
  active_policies: number;
  total_premium: number;
  total_claims_paid: number;
  system_loss_ratio: number;
}

export interface HexZone {
  city: string;
  h3_index: string;
  dci_score: number;
  status: string;
}

export interface RiskForecast {
  city: string;
  risk: number;
}

export interface FraudQueueItem {
  claim_id: string;
  created_at: string;
  worker_name: string;
  city: string;
  status: string;
  resolution_path: string | null;
  fraud_score: number;
  dci_score: number;
  payout: number;
  flags: string[];
}

export interface PayoutSummary {
  total_payouts: number;
  avg_payout: number;
  success_rate: number;
  pending_amount: number;
}

export interface PayoutItem {
  id: string;
  worker_name: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface PolicyStats {
  total_value_locked: number;
  active_nodes: number;
  loss_ratio: number;
}

export interface PolicyTier {
  tier: string;
  workers: number;
  avg_coverage: number;
}

export interface MonthlyTrend {
  month: string;
  premiums?: number;
  payouts: number;
}

type StatusError = Error & { status?: number };

function isPreviewRuntime(): boolean {
  const env = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (env === 'preview') return true;
  if (env === 'production') return false;

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host.endsWith('.vercel.app') && !host.includes('gighood.vercel.app');
  }

  return false;
}

function shouldUsePreviewFallback(error: unknown): boolean {
  const maybe = error as StatusError;
  const status = maybe?.status;
  // Fallback demo data should be used only for missing admin routes on preview backends.
  return isPreviewRuntime() && status === 404;
}

async function getWithFallback<T>(url: string, fallbackFactory: () => T): Promise<T> {
  try {
    const { data } = await api.get<T>(url);
    return data;
  } catch (error: unknown) {
    if (shouldUsePreviewFallback(error)) {
      console.warn(`[adminClient] Falling back to preview data for ${url}`);
      return fallbackFactory();
    }
    throw error;
  }
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function fallbackKPIs(): AdminKPIs {
  return {
    active_policies: 2180,
    total_premium: 4720000,
    total_claims_paid: 1680000,
    system_loss_ratio: 0.71,
  };
}

function fallbackZones(): HexZone[] {
  return [
    { city: 'Chennai', h3_index: '8961892d22fffff', dci_score: 0.91, status: 'DISRUPTED' },
    { city: 'Bengaluru', h3_index: '8960145b4b7ffff', dci_score: 0.78, status: 'ELEVATED' },
    { city: 'Hyderabad', h3_index: '8960f05ac87ffff', dci_score: 0.66, status: 'ELEVATED' },
    { city: 'Mumbai', h3_index: '8960a65b42fffff', dci_score: 0.49, status: 'NORMAL' },
  ];
}

function fallbackRiskForecast(): RiskForecast[] {
  return [
    { city: 'Chennai', risk: 0.84 },
    { city: 'Bengaluru', risk: 0.72 },
    { city: 'Hyderabad', risk: 0.63 },
    { city: 'Mumbai', risk: 0.41 },
  ];
}

function fallbackPayoutTrends(): MonthlyTrend[] {
  return [
    { month: 'Jan', payouts: 950000 },
    { month: 'Feb', payouts: 1010000 },
    { month: 'Mar', payouts: 1180000 },
    { month: 'Apr', payouts: 1320000 },
    { month: 'May', payouts: 1260000 },
    { month: 'Jun', payouts: 1410000 },
  ];
}

function fallbackPayoutSummary(): PayoutSummary {
  return {
    total_payouts: 1680000,
    avg_payout: 772,
    success_rate: 96.4,
    pending_amount: 132000,
  };
}

function fallbackRecentPayouts(): PayoutItem[] {
  return [
    { id: 'PO_2031', worker_name: 'Arun K', amount: 860, status: 'paid', created_at: isoMinutesAgo(18) },
    { id: 'PO_2030', worker_name: 'Divya S', amount: 540, status: 'paid', created_at: isoMinutesAgo(46) },
    { id: 'PO_2029', worker_name: 'Pranav R', amount: 1040, status: 'pending', created_at: isoMinutesAgo(61) },
    { id: 'PO_2028', worker_name: 'Nisha P', amount: 790, status: 'paid', created_at: isoMinutesAgo(83) },
    { id: 'PO_2027', worker_name: 'Ravi T', amount: 620, status: 'failed', created_at: isoMinutesAgo(119) },
  ];
}

function fallbackPolicyStats(): PolicyStats {
  return {
    total_value_locked: 4720000,
    active_nodes: 42,
    loss_ratio: 0.71,
  };
}

function fallbackPolicyTiers(): PolicyTier[] {
  return [
    { tier: 'A', workers: 640, avg_coverage: 780 },
    { tier: 'B', workers: 980, avg_coverage: 540 },
    { tier: 'C', workers: 560, avg_coverage: 320 },
  ];
}

function fallbackFraudMetrics(): FraudMetrics {
  return {
    avg_fraud_score: 31.8,
    mock_locations_24h: 17,
    velocity_violations: 11,
    blacklisted_devices: 5,
  };
}

function fallbackFraudSignals(): FraudSignal[] {
  return [
    { label: 'location_spoofing', value: 42 },
    { label: 'velocity_anomaly', value: 29 },
    { label: 'device_cluster', value: 19 },
    { label: 'order_gap_mismatch', value: 24 },
  ];
}

function fallbackFraudWorkers(): FraudWorker[] {
  return [
    { id: 'WK_10091', violation: 'High velocity mismatch', risk: 'HIGH', lastActive: isoMinutesAgo(4) },
    { id: 'WK_10037', violation: 'Mock GPS suspected', risk: 'CRITICAL', lastActive: isoMinutesAgo(11) },
    { id: 'WK_10028', violation: 'Device overlap cluster', risk: 'MEDIUM', lastActive: isoMinutesAgo(17) },
  ];
}

function fallbackFraudEvents(): string[] {
  return [
    `[${new Date().toLocaleTimeString()}] Velocity spike detected in Chennai-ADY cluster`,
    `[${new Date().toLocaleTimeString()}] Repeated GPS drift pattern in BLR-East`,
    `[${new Date().toLocaleTimeString()}] Device reuse anomaly raised for WK_10037`,
  ];
}

function fallbackFraudQueue(): FraudQueueItem[] {
  return [
    {
      claim_id: 'CLM_90211',
      created_at: isoMinutesAgo(6),
      worker_name: 'Pranav M',
      city: 'Chennai',
      status: 'under_review',
      resolution_path: 'SOFT_QUEUE',
      fraud_score: 56,
      dci_score: 0.89,
      payout: 860,
      flags: ['velocity_anomaly', 'order_gap_mismatch'],
    },
    {
      claim_id: 'CLM_90208',
      created_at: isoMinutesAgo(19),
      worker_name: 'Kiran S',
      city: 'Bengaluru',
      status: 'verified',
      resolution_path: 'FAST_TRACK',
      fraud_score: 18,
      dci_score: 0.86,
      payout: 540,
      flags: ['none'],
    },
    {
      claim_id: 'CLM_90199',
      created_at: isoMinutesAgo(33),
      worker_name: 'Rahul T',
      city: 'Hyderabad',
      status: 'under_review',
      resolution_path: 'ACTIVE_VERIFY',
      fraud_score: 74,
      dci_score: 0.82,
      payout: 0,
      flags: ['location_spoofing', 'device_cluster'],
    },
  ];
}

export async function fetchPolicyStats(): Promise<PolicyStats> {
  return getWithFallback('/admin/policies/stats', fallbackPolicyStats);
}

export async function fetchPolicyTiers(): Promise<PolicyTier[]> {
  return getWithFallback('/admin/policies/tiers', fallbackPolicyTiers);
}

export async function fetchPayoutTrends(): Promise<MonthlyTrend[]> {
  return getWithFallback('/admin/dashboard/payout-trends', fallbackPayoutTrends);
}

export async function fetchPayoutSummary(): Promise<PayoutSummary> {
  return getWithFallback('/admin/payouts/summary', fallbackPayoutSummary);
}

export async function fetchRecentPayouts(): Promise<PayoutItem[]> {
  return getWithFallback('/admin/payouts/recent', fallbackRecentPayouts);
}

export async function fetchKPIs(): Promise<AdminKPIs> {
  return getWithFallback('/admin/dashboard/kpis', fallbackKPIs);
}

export async function fetchLiveZones(): Promise<HexZone[]> {
  return getWithFallback('/admin/dashboard/zones', fallbackZones);
}

export async function fetchRiskForecast(): Promise<RiskForecast[]> {
  return getWithFallback('/admin/dashboard/risk-forecast', fallbackRiskForecast);
}

export interface FraudMetrics {
  avg_fraud_score: number;
  mock_locations_24h: number;
  velocity_violations: number;
  blacklisted_devices: number;
}

export interface FraudSignal {
  label: string;
  value: number;
}

export interface FraudWorker {
  id: string;
  violation: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  lastActive: string;
}

export async function fetchFraudMetrics(): Promise<FraudMetrics> {
  return getWithFallback('/admin/fraud/metrics', fallbackFraudMetrics);
}

export async function fetchFraudSignals(): Promise<FraudSignal[]> {
  return getWithFallback('/admin/fraud/signals', fallbackFraudSignals);
}

export async function fetchFraudWorkers(): Promise<FraudWorker[]> {
  return getWithFallback('/admin/fraud/workers', fallbackFraudWorkers);
}

export async function fetchFraudEvents(): Promise<string[]> {
  return getWithFallback('/admin/fraud/events', fallbackFraudEvents);
}
export async function fetchFraudQueue(): Promise<FraudQueueItem[]> {
  return getWithFallback('/admin/dashboard/fraud-queue', fallbackFraudQueue);
}