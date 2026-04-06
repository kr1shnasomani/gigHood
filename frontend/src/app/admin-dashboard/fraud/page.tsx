'use client';

import { useEffect, useState } from 'react';
import { Download, AlertTriangle, Shield, Zap } from 'lucide-react';
import {
  fetchFraudMetrics,
  fetchFraudSignals,
  fetchFraudWorkers,
  fetchFraudEvents,
  FraudMetrics,
  FraudSignal,
  FraudWorker,
} from '@/lib/admin/adminClient';
import FraudNetworkGraph, { NetworkGraph } from '@/components/admin/FraudNetworkGraph';

export default function FraudMonitor() {
  const [metrics, setMetrics] = useState<FraudMetrics | null>(null);
  const [signals, setSignals] = useState<FraudSignal[]>([]);
  const [workers, setWorkers] = useState<FraudWorker[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [networkGraph, setNetworkGraph] = useState<NetworkGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [metricsData, signalsData, workersData, eventsData] = await Promise.all([
          fetchFraudMetrics(),
          fetchFraudSignals(),
          fetchFraudWorkers(),
          fetchFraudEvents(),
        ]);
        setMetrics(metricsData);
        setSignals(signalsData);
        setWorkers(workersData);
        setEvents(eventsData);

        // Build deterministic graph nodes for stable rendering.
        const nodes = workersData.map((w) => ({
          id: w.id,
          label: w.id.slice(0, 8),
          riskLevel: w.risk as 'CRITICAL' | 'HIGH' | 'MEDIUM',
          fraudScore: deriveFraudScoreFromWorker(w),
        }));

        const edges = [];
        for (let i = 0; i < Math.min(workersData.length - 1, 4); i++) {
          const edgeLabel = signalsData[i % Math.max(signalsData.length, 1)]?.label || 'signal_overlap';
          edges.push({
            source: workersData[i].id,
            target: workersData[i + 1].id,
            label: edgeLabel,
            weight: deriveEdgeWeight(workersData[i], workersData[i + 1]),
          });
        }

        setNetworkGraph({ nodes, edges });
      } catch (err) {
        console.error('Failed to load fraud data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const exportReport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    let csvContent = `Fraud Monitor Report - ${timestamp}\n\n`;

    // Metrics section
    csvContent += 'METRICS\n';
    csvContent += 'Metric,Value\n';
    csvContent += `Average Fraud Score,${metrics?.avg_fraud_score ?? 0}\n`;
    csvContent += `Mock Locations (24h),${metrics?.mock_locations_24h ?? 0}\n`;
    csvContent += `Velocity Violations,${metrics?.velocity_violations ?? 0}\n`;
    csvContent += `Blacklisted Devices,${metrics?.blacklisted_devices ?? 0}\n\n`;

    // Signals section
    csvContent += 'FRAUD SIGNALS\n';
    csvContent += 'Signal,Density (%)\n';
    signals.forEach(signal => {
      csvContent += `${signal.label.replace(/_/g, ' ')},${signal.value}\n`;
    });
    csvContent += '\n';

    // Workers section
    csvContent += 'HIGH-RISK WORKERS\n';
    csvContent += 'Worker ID,Primary Violation,Risk Level,Last Active\n';
    workers.forEach(worker => {
      csvContent += `${worker.id},"${worker.violation}",${worker.risk},${worker.lastActive}\n`;
    });
    csvContent += '\n';

    // Events section
    csvContent += 'RECENT EVENTS\n';
    csvContent += 'Event\n';
    events.forEach(event => {
      csvContent += `"${event}"\n`;
    });

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `fraud-report-${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-8 bg-[#f5f6f8] min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fraud monitoring data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-[#f5f6f8] min-h-screen space-y-8">

      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Fraud Monitor
          </h1>
          <p className="text-gray-500 text-sm">
            Real-time risk assessment and parametric integrity analysis.
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              System Active
            </div>
            <span className="text-gray-300">•</span>
            <span className="text-xs text-gray-500">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={exportReport}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 transition-colors flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Trigger Manual Audit
          </button>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10"></div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">AVG FRAUD SCORE</div>
          <div className="text-3xl font-bold mt-2">{metrics?.avg_fraud_score ?? '—'}</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-yellow-400">
            <Zap className="w-3 h-3" />
            Real-time monitoring
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-red-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider">MOCK LOCATIONS (24H)</div>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-red-600">{metrics?.mock_locations_24h ?? 0}</div>
          <div className="text-red-500 text-xs mt-1 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            +8% increase
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-purple-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider">VELOCITY VIOLATIONS</div>
            <Zap className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-purple-600">{metrics?.velocity_violations ?? 0}</div>
          <div className="text-purple-500 text-xs mt-1">Stable baseline</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-500 uppercase tracking-wider">BLACKLISTED DEVICES</div>
            <Shield className="w-4 h-4 text-gray-500" />
          </div>
          <div className="text-2xl font-semibold mt-2 text-gray-700">{metrics?.blacklisted_devices ?? 0}</div>
          <div className="text-gray-400 text-xs mt-1">Auto-blocked</div>
        </div>
      </div>

      {/* MIDDLE SECTION */}
      <div className="grid grid-cols-3 gap-6">

        {/* SIGNAL BREAKDOWN */}
        <div className="col-span-2 bg-white p-6 rounded-xl shadow-sm space-y-5">
          <h2 className="text-sm font-semibold">Fraud Signal Breakdown</h2>

          {signals.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span>{item.label.replace(/_/g, ' ')}</span>
                <span>{item.value}% Density</span>
              </div>
              <div className="w-full bg-gray-200 h-2 rounded-full">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* LIVE STREAM */}
        <div className="bg-[#0f172a] text-white p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Live Fraud Stream</h2>
            <div className="flex items-center gap-1 text-xs text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              LIVE
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono max-h-64 overflow-y-auto">
            {events.map((e, i) => (
              <div
                key={i}
                className="bg-[#111827] p-3 rounded-md border-l-2 border-red-500 hover:bg-[#1a1f2e] transition-colors"
              >
                {e}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NETWORK GRAPH */}
      <div>
        <FraudNetworkGraph data={networkGraph} />
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="flex justify-between p-5 border-b">
          <h2 className="text-sm font-semibold">
            High-Risk Worker Watchlist
          </h2>
          <span className="text-purple-600 text-xs cursor-pointer">
            View All Suspicious Accounts
          </span>
        </div>

        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-5 py-3">Worker ID</th>
              <th className="text-left px-5 py-3">Primary Violation</th>
              <th className="text-left px-5 py-3">Risk Level</th>
              <th className="text-left px-5 py-3">Last Active</th>
              <th className="text-left px-5 py-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4 font-medium">{w.id}</td>
                <td className="px-5 py-4">{w.violation}</td>

                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs rounded ${getRiskStyle(w.risk)}`}>
                    {w.risk}
                  </span>
                </td>

                <td className="px-5 py-4 text-gray-500">
                  {w.lastActive}
                </td>

                <td className="px-5 py-4 flex gap-2">
                  <button className="text-red-500 text-xs hover:text-red-700 transition-colors">
                    Flag
                  </button>
                  <button className="bg-black text-white px-3 py-1 rounded text-xs hover:bg-gray-800 transition-colors">
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SUMMARY INSIGHTS */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Fraud Detection Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Active Monitoring:</span>
                <span className="ml-2 font-medium text-green-600">✓ Live</span>
              </div>
              <div>
                <span className="text-gray-600">Risk Threshold:</span>
                <span className="ml-2 font-medium text-purple-600">60+ Score</span>
              </div>
              <div>
                <span className="text-gray-600">Auto-blocks:</span>
                <span className="ml-2 font-medium text-gray-900">{metrics?.blacklisted_devices ?? 0} devices</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              System automatically flags suspicious activities and maintains real-time integrity monitoring across all worker interactions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function deriveFraudScoreFromWorker(worker: FraudWorker): number {
  const baseByRisk = {
    CRITICAL: 84,
    HIGH: 68,
    MEDIUM: 44,
  } as const;

  const base = baseByRisk[worker.risk] ?? 36;
  const variation = worker.id
    .split('')
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 12;

  return Math.min(99, Math.max(0, base + variation));
}

function deriveEdgeWeight(source: FraudWorker, target: FraudWorker): number {
  const distance = Math.abs(
    source.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) -
    target.id.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  );
  return Math.max(0.2, Math.min(1, 1 - (distance % 60) / 100));
}

function getRiskStyle(risk: string): string {
  switch (risk.toUpperCase()) {
    case 'CRITICAL':
      return 'bg-red-100 text-red-800';
    case 'HIGH':
      return 'bg-orange-100 text-orange-800';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}