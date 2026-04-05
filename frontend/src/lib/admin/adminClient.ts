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

export async function fetchPolicyStats(): Promise<PolicyStats> {
  const { data } = await api.get('/admin/policies/stats');
  return data;
}

export async function fetchPolicyTiers(): Promise<PolicyTier[]> {
  const { data } = await api.get('/admin/policies/tiers');
  return data;
}

export async function fetchPayoutTrends(): Promise<MonthlyTrend[]> {
  const { data } = await api.get<MonthlyTrend[]>('/admin/dashboard/payout-trends');
  return data;
}

export async function fetchPayoutSummary(): Promise<PayoutSummary> {
  const { data } = await api.get('/admin/payouts/summary');
  return data;
}

export async function fetchRecentPayouts(): Promise<PayoutItem[]> {
  const { data } = await api.get('/admin/payouts/recent');
  return data;
}

export async function fetchKPIs(): Promise<AdminKPIs> {
  const { data } = await api.get<AdminKPIs>('/admin/dashboard/kpis');
  return data;
}

export async function fetchLiveZones(): Promise<HexZone[]> {
  const { data } = await api.get<HexZone[]>('/admin/dashboard/zones');
  return data;
}

export async function fetchRiskForecast(): Promise<RiskForecast[]> {
  const { data } = await api.get<RiskForecast[]>('/admin/dashboard/risk-forecast');
  return data;
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
  const { data } = await api.get('/admin/fraud/metrics');
  return data;
}

export async function fetchFraudSignals(): Promise<FraudSignal[]> {
  const { data } = await api.get<FraudSignal[]>('/admin/fraud/signals');
  return data;
}

export async function fetchFraudWorkers(): Promise<FraudWorker[]> {
  const { data } = await api.get<FraudWorker[]>('/admin/fraud/workers');
  return data;
}

export async function fetchFraudEvents(): Promise<string[]> {
  const { data } = await api.get<string[]>('/admin/fraud/events');
  return data;
}
export async function fetchFraudQueue(): Promise<FraudQueueItem[]> {
  const { data } = await api.get('/admin/dashboard/fraud-queue');
  return data;
}