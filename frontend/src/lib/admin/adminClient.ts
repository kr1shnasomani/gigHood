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

async function getAdmin<T>(url: string): Promise<T> {
  const { data } = await api.get<T>(url);
  return data;
}

export async function fetchPolicyStats(): Promise<PolicyStats> {
  return getAdmin('/admin/policies/stats');
}

export async function fetchPolicyTiers(): Promise<PolicyTier[]> {
  return getAdmin('/admin/policies/tiers');
}

export async function fetchPayoutTrends(): Promise<MonthlyTrend[]> {
  return getAdmin('/admin/dashboard/payout-trends');
}

export async function fetchPayoutSummary(): Promise<PayoutSummary> {
  return getAdmin('/admin/payouts/summary');
}

export async function fetchRecentPayouts(): Promise<PayoutItem[]> {
  return getAdmin('/admin/payouts/recent');
}

export async function fetchKPIs(): Promise<AdminKPIs> {
  return getAdmin('/admin/dashboard/kpis');
}

export async function fetchLiveZones(): Promise<HexZone[]> {
  return getAdmin('/admin/dashboard/zones');
}

export async function fetchRiskForecast(): Promise<RiskForecast[]> {
  return getAdmin('/admin/dashboard/risk-forecast');
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
    source?: 'live' | 'degraded';
    city_filter?: string;
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
  return getAdmin('/admin/fraud/metrics');
}

export async function fetchFraudSignals(): Promise<FraudSignal[]> {
  return getAdmin('/admin/fraud/signals');
}

export async function fetchFraudWorkers(): Promise<FraudWorker[]> {
  return getAdmin('/admin/fraud/workers');
}

export async function fetchFraudEvents(): Promise<string[]> {
  return getAdmin('/admin/fraud/events');
}

export async function fetchFraudNetworkGraph(city?: string): Promise<FraudNetworkGraphResponse> {
  const params = new URLSearchParams();
  if (city && city !== 'ALL') params.set('city', city);
  const path = params.toString() ? `/admin/fraud/network-graph?${params.toString()}` : '/admin/fraud/network-graph';
  return getAdmin(path);
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
  return getAdmin('/admin/dashboard/fraud-queue');
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

export async function fetchAuditLogs(
  limit = 100,
  entityType?: string,
  action?: string,
): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (entityType) params.append('entity_type', entityType);
  if (action) params.append('action', action);
  return getAdmin(`/admin/audit/logs?${params.toString()}`);
}