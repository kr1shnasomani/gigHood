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
  // AI Decision Engine fields
  decision?: 'APPROVE' | 'REVIEW' | 'DENY';
  decision_reason?: string;
  decision_confidence?: 'HIGH' | 'MEDIUM' | 'MANUAL_OVERRIDE';
  // XAI fields (populated after first fraud evaluation)
  fraud_breakdown?: Record<string, number> | null;
  fraud_top_reason?: string | null;
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
const FALLBACK_STORAGE_KEY = 'gighood_admin_fallback_events';

function recordFallbackEvent(url: string): void {
  const msg = `[adminClient] Falling back to preview data for ${url}`;
  console.warn(msg);

  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Array<{ url: string; at: string }>) : [];
    parsed.unshift({ url, at: new Date().toISOString() });
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(parsed.slice(0, 20)));
  } catch {
    // Ignore localStorage failures; console warning still provides visibility.
  }
}

export function getAdminFallbackEvents(): Array<{ url: string; at: string }> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Array<{ url: string; at: string }>) : [];
  } catch {
    return [];
  }
}

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
      recordFallbackEvent(url);
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
      decision: 'REVIEW',
      decision_reason: 'Score 56/100 exceeds REVIEW threshold. Suspicious behavioral deviations detected.',
      decision_confidence: 'MEDIUM',
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
      decision: 'APPROVE',
      decision_reason: 'Score 18/100 within acceptable bounds. Behavior consistent with legitimate patterns.',
      decision_confidence: 'HIGH',
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
      decision: 'REVIEW',
      decision_reason: 'Score 74/100 exceeds REVIEW threshold. Location spoofing and device cluster signals.',
      decision_confidence: 'MEDIUM',
    },
    {
      claim_id: 'CLM_90185',
      created_at: isoMinutesAgo(51),
      worker_name: 'Siya Patel',
      city: 'Mumbai',
      status: 'denied',
      resolution_path: 'DENY',
      fraud_score: 88,
      dci_score: 0.94,
      payout: 0,
      flags: ['STATIC_DEVICE_FLAG', 'GATE2_NONE', 'MOCK_LOCATION_FLAG'],
      decision: 'DENY',
      decision_reason: 'Score 88/100 exceeds DENY threshold. Strong anomaly signals: zone spoofing and network ring membership confirmed.',
      decision_confidence: 'HIGH',
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
  display_id?: string;
  name?: string;
  city?: string;
  fraud_score?: number;
  violation: string;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  lastActive: string;
}

export interface FraudGraphNode {
  id: string;
  entity_id: string;
  type: 'Worker' | 'Device' | 'Hex_Zone';
  label: string;
  subtitle?: string;
  details?: Record<string, string | number | boolean | null>;
  fraud_score?: number;
  risk_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface FraudGraphLink {
  source: string;
  target: string;
  type: 'USES_DEVICE' | 'CLAIMED_IN';
}

export interface FraudNetworkGraphResponse {
  nodes: FraudGraphNode[];
  links: FraudGraphLink[];
  meta: {
    syndicate_devices: number;
    node_count: number;
    link_count: number;
    workers_in_graph?: number;
    zones_in_graph?: number;
    devices_in_graph?: number;
    reason?: string;
    source?: 'live' | 'fallback';
    city_filter?: string;
  };
}

function fallbackFraudNetworkGraph(): FraudNetworkGraphResponse {
  return {
    nodes: [],
    links: [],
    meta: {
      syndicate_devices: 0,
      node_count: 0,
      link_count: 0,
      reason: 'preview_mock_fallback',
      source: 'fallback',
    },
  };
}

export interface SandboxSignalOverrideRequest {
  hex_id: string;
  rainfall_mm_per_hr: number;
  aqi: number;
  traffic_congestion_percent: number;
}

export interface SandboxSignalOverrideResponse {
  hex_id: string;
  input: SandboxSignalOverrideRequest;
  normalized: {
    W: number;
    A: number;
    T: number;
    P: number;
    S: number;
  };
  dci: number | null;
  dci_status: string;
  triggered: boolean;
  open_event_id: string | null;
}

export interface SandboxBatchOverrideResponse {
  zones_targeted: number;
  zones_triggered: number;
  results: SandboxSignalOverrideResponse[];
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

export async function fetchFraudNetworkGraph(city?: string): Promise<FraudNetworkGraphResponse> {
  const params = new URLSearchParams();
  if (city && city !== 'ALL') params.set('city', city);
  const path = params.toString() ? `/admin/fraud/network-graph?${params.toString()}` : '/admin/fraud/network-graph';
  return getWithFallback(path, fallbackFraudNetworkGraph);
}

export async function overrideSandboxSignals(
  payload: SandboxSignalOverrideRequest
): Promise<SandboxSignalOverrideResponse> {
  const { data } = await api.post<SandboxSignalOverrideResponse>('/admin/sandbox/override-signals', payload);
  return data;
}

export async function overrideSandboxSignalsBatch(
  payload: Omit<SandboxSignalOverrideRequest, 'hex_id'>
): Promise<SandboxBatchOverrideResponse> {
  const { data } = await api.post<SandboxBatchOverrideResponse>('/admin/sandbox/override-signals/batch', payload);
  return data;
}

export async function fetchFraudQueue(): Promise<FraudQueueItem[]> {
  return getWithFallback('/admin/dashboard/fraud-queue', fallbackFraudQueue);
}

/**
 * Admin override: set a claim decision to APPROVE or DENY.
 * On success returns { status: 'updated', claim_id, decision }.
 */
export async function overrideClaimDecision(
  claimId: string,
  action: 'APPROVE' | 'DENY',
): Promise<{ status: string; claim_id: string; decision: string; was_correction?: boolean }> {
  const { data } = await api.post(`/admin/claims/${claimId}/override`, { action });
  return data;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: 'AUTO_DECISION' | 'OVERRIDE' | 'CREATE' | 'STATUS_CHANGE' | string;
  performed_by: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function fallbackAuditLogs(): AuditLog[] {
  return [
    {
      id: 'al-0001', entity_type: 'claim', entity_id: 'CLM_90211',
      action: 'AUTO_DECISION', performed_by: 'AI', created_at: isoMinutesAgo(2),
      metadata: {
        fraud_score: 56, decision: 'REVIEW', confidence: 'MEDIUM',
        top_reason: 'partner_activity', top_reason_label: 'Partner Order Activity (Gate-2)',
        breakdown: { location_anomaly: 12, telemetry_quality: 8, partner_activity: 30, gps_accuracy: 4, velocity: 0, mock_location: 0, network_behavior: 2 },
        flags: ['GATE2_WEAK', 'SPARSE_TELEMETRY'], gate2_result: 'WEAK',
      },
    },
    {
      id: 'al-0002', entity_type: 'claim', entity_id: 'CLM_90185',
      action: 'AUTO_DECISION', performed_by: 'AI', created_at: isoMinutesAgo(8),
      metadata: {
        fraud_score: 88, decision: 'DENY', confidence: 'HIGH',
        top_reason: 'mock_location', top_reason_label: 'Mock Location Flag',
        breakdown: { location_anomaly: 20, telemetry_quality: 5, partner_activity: 35, gps_accuracy: 8, velocity: 10, mock_location: 40, network_behavior: 15 },
        flags: ['MOCK_LOCATION_FLAG', 'GATE2_NONE', 'STATIC_DEVICE_FLAG'], gate2_result: 'NONE',
      },
    },
    {
      id: 'al-0003', entity_type: 'claim', entity_id: 'CLM_90199',
      action: 'OVERRIDE', performed_by: 'admin', created_at: isoMinutesAgo(15),
      metadata: {
        ai_decision: 'DENY', new_decision: 'REVIEW',
        fraud_score: 74, was_correction: true,
      },
    },
    {
      id: 'al-0004', entity_type: 'claim', entity_id: 'CLM_90208',
      action: 'AUTO_DECISION', performed_by: 'AI', created_at: isoMinutesAgo(22),
      metadata: {
        fraud_score: 18, decision: 'APPROVE', confidence: 'HIGH',
        top_reason: 'none', top_reason_label: 'none',
        breakdown: { location_anomaly: 0, telemetry_quality: 0, partner_activity: 5, gps_accuracy: 2, velocity: 0, mock_location: 0, network_behavior: 0 },
        flags: [], gate2_result: 'STRONG',
      },
    },
  ];
}

export async function fetchAuditLogs(
  limit = 100,
  entityType?: string,
  action?: string,
): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType) params.append('entity_type', entityType);
  if (action) params.append('action', action);
  return getWithFallback(
    `/admin/audit/logs?${params.toString()}`,
    fallbackAuditLogs,
  );
}