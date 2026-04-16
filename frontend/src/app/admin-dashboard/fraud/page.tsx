'use client';

import { useEffect, useState } from 'react';
import { Download, Shield, Zap, ChevronRight, Home } from 'lucide-react';
import {
  fetchFraudMetrics,
  fetchFraudSignals,
  fetchFraudWorkers,
  fetchFraudEvents,
  fetchFraudNetworkGraph,
  fetchLiveZones,
  FraudNetworkGraphResponse,
  FraudMetrics,
  FraudSignal,
  FraudWorker,
  HexZone,
} from '@/lib/admin/adminClient';
import FraudNetworkGraph, { NetworkGraph } from '@/components/admin/FraudNetworkGraph';

export default function FraudMonitor() {
  const [metrics, setMetrics] = useState<FraudMetrics | null>(null);
  const [signals, setSignals] = useState<FraudSignal[]>([]);
  const [workers, setWorkers] = useState<FraudWorker[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  const [networkGraph, setNetworkGraph] = useState<NetworkGraph>({ nodes: [], edges: [] });
  const [graphMeta, setGraphMeta] = useState<FraudNetworkGraphResponse['meta'] | null>(null);
  const [graphCityFilter, setGraphCityFilter] = useState('ALL');
  const [zones, setZones] = useState<HexZone[]>([]);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mapGraphForView = (graph: FraudNetworkGraphResponse): NetworkGraph => {
      const nodes = graph.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        subtitle: node.subtitle,
        type: node.type,
        details: node.details,
        riskLevel: node.risk_level ?? 'LOW',
        fraudScore: typeof node.fraud_score === 'number' ? node.fraud_score : 25,
      }));
      const edges = graph.links.map((edge) => ({
        source: edge.source,
        target: edge.target,
        label: edge.type,
        weight: edge.type === 'USES_DEVICE' ? 2.4 : 1.8,
      }));
      return { nodes, edges };
    };

    const loadData = async () => {
      try {
        const [metricsData, signalsData, workersData, eventsData, graphData, zonesData] = await Promise.all([
          fetchFraudMetrics(),
          fetchFraudSignals(),
          fetchFraudWorkers(),
          fetchFraudEvents(),
          fetchFraudNetworkGraph(graphCityFilter),
          fetchLiveZones(),
        ]);
        setMetrics(metricsData);
        setSignals(signalsData);
        setWorkers(workersData);
        setEvents(eventsData);
        setZones(zonesData);

        if (graphData.nodes.length > 0 && graphData.links.length > 0) {
          setNetworkGraph(mapGraphForView(graphData));
        } else {
          setNetworkGraph({ nodes: [], edges: [] });
        }
        setGraphMeta(graphData.meta);

        if (graphData.meta?.source !== 'live') {
          const reason = graphData.meta?.reason ? ` (${graphData.meta.reason})` : '';
          const msg = `Neo4j fraud graph degraded: live query unavailable${reason}`;
          console.warn(msg, graphData.meta);
          setGraphError(msg);
        } else {
          setGraphError(null);
        }
      } catch (err) {
        console.error('Failed to load fraud data:', err);
        setGraphError('Failed to load live fraud graph data from Neo4j.');
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
  }, [graphCityFilter]);

  const exportReport = () => { /* noop for UI retheme */ };

  if (loading) {
    return (
      <div className="p-7 flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto shadow-[0_0_16px_rgba(249,115,22,0.3)]" />
      </div>
    );
  }

  const cardStyle = {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid rgba(249,115,22,0.12)',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.05)',
  };

  return (
    <div className="p-7 space-y-7 relative max-w-[1400px] mx-auto">
      
      {/* HEADER */}
      <div>
        <nav className="flex items-center gap-1 text-[11px] text-stone-400 mb-3">
          <Home size={11} />
          <span className="mx-1">·</span>
          <span className="hover:text-orange-500 cursor-pointer transition-colors">Admin</span>
          <ChevronRight size={11} className="text-stone-300" />
          <span className="text-stone-700 font-semibold">Fraud Monitor</span>
        </nav>
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <Shield className="text-orange-500" size={24} />
              Platform Integrity & Risk
            </h1>
            <p className="text-sm text-stone-500 mt-1">
              Real-time anomaly detection and parametric fraud prevention.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button 
              onClick={exportReport}
              className="px-4 py-2 border border-stone-200 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-50 transition-colors flex items-center gap-2"
            >
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-[#1c1917] to-[#292524] text-white p-5 rounded-2xl relative overflow-hidden"
             style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 60%)' }} />
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em]">System Fraud Score</div>
          <div className="text-4xl font-black mt-2 font-mono text-orange-400">{metrics?.avg_fraud_score ?? '—'}</div>
          <div className="flex items-center gap-1.5 mt-3 text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Monitor
          </div>
        </div>

        <div style={cardStyle} className="p-5">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-2">Mock Locations (24H)</div>
          <div className="text-3xl font-black text-red-600 font-mono">{metrics?.mock_locations_24h ?? 0}</div>
          <div className="text-[11px] font-semibold text-red-500 mt-2 bg-red-50 w-fit px-2 py-0.5 rounded border border-red-100">Live signal feed</div>
        </div>

        <div style={cardStyle} className="p-5">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-2">Velocity Violations</div>
          <div className="text-3xl font-black text-amber-600 font-mono">{metrics?.velocity_violations ?? 0}</div>
          <div className="text-[11px] font-semibold text-stone-500 mt-2 bg-stone-50 w-fit px-2 py-0.5 rounded border border-stone-100">Live anomaly counter</div>
        </div>

        <div style={cardStyle} className="p-5">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.15em] mb-2">Auto-Blocked Devices</div>
          <div className="text-3xl font-black text-stone-900 font-mono">{metrics?.blacklisted_devices ?? 0}</div>
          <div className="text-[11px] font-semibold text-emerald-600 mt-2 bg-emerald-50 w-fit px-2 py-0.5 rounded border border-emerald-100">Active protection</div>
        </div>
      </div>

      {/* MID SECTION: SIGNALS + STREAM */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* SIGNAL BREAKDOWN */}
        <div className="xl:col-span-2 p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[14px] font-bold text-stone-900 tracking-tight">Fraud Signal Distribution</h2>
            <div className="w-6 h-6 rounded bg-orange-50 flex items-center justify-center text-orange-500 border border-orange-100">
              <Zap size={12} />
            </div>
          </div>
          <div className="space-y-4">
            {signals.map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-[11px] font-semibold text-stone-600 mb-1.5 uppercase tracking-wider">
                  <span>{item.label.replace(/_/g, ' ')}</span>
                  <span className="text-orange-600 font-mono">{item.value}% matches</span>
                </div>
                <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-700"
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LIVE STREAM */}
        <div className="p-6 bg-[#181615] rounded-2xl border border-[#2e2a28] flex flex-col"
             style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center justify-between mb-4 border-b border-[#2e2a28] pb-3">
            <h2 className="text-[13px] font-bold text-white tracking-tight">Audit Log</h2>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping" />
              RECORDING
            </div>
          </div>
          <div className="space-y-2 text-[11px] font-mono max-h-56 overflow-y-auto pr-1">
            {events.map((e, i) => (
              <div key={i} className="bg-[#211E1D] p-2.5 rounded-lg border-l-2 border-orange-500 text-stone-300">
                {e}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NETWORK GRAPH */}
      <div className="p-1 pb-2" style={cardStyle}>
        {graphError && (
          <div className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {graphError}
          </div>
        )}
        <div className="mx-3 mt-3 mb-2 flex flex-wrap items-center gap-3">
          <label htmlFor="graph-city-filter" className="text-[10px] font-black uppercase tracking-[0.15em] text-stone-400">
            Node Filter
          </label>
          <select
            id="graph-city-filter"
            value={graphCityFilter}
            onChange={(e) => setGraphCityFilter(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold bg-stone-50 text-stone-700 focus:outline-none focus:border-orange-300"
          >
            <option value="ALL">All Networks</option>
            {[...new Set(zones.map((z) => z.city).filter(Boolean))].map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
        <div className="rounded-xl overflow-hidden border border-stone-100 mx-3 mb-2 min-h-[620px]">
          <FraudNetworkGraph data={networkGraph} meta={graphMeta ?? undefined} />
        </div>
      </div>

      {/* TABLE */}
      <div style={cardStyle} className="overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-stone-100">
           <h2 className="text-[14px] font-bold text-stone-900 tracking-tight">High-Risk Worker Watchlist</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#FAFAF8' }}>
                {['ID', 'Identifier', 'Primary Violation', 'Fraud Score', 'Risk', 'Last Active'].map((h) =>(
                  <th key={h} className="text-left px-5 py-3 text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.slice(0, 10).map((w) => {
                const score = typeof w.fraud_score === 'number' ? w.fraud_score : 0;
                const isCrit = score > 80;
                return (
                  <tr key={w.id} className="border-t border-stone-100 hover:bg-orange-50/30 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-stone-500">{w.display_id ?? w.id.slice(0, 8)}</td>
                    <td className="px-5 py-4">
                      <div className="text-[13px] font-bold text-stone-900">{w.name ?? 'Unknown Worker'}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">{w.city ?? 'Unknown City'}</div>
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-stone-700">{w.violation}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[13px] font-black font-mono ${isCrit ? 'text-red-500' : 'text-stone-700'}`}>
                        {score.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1.5 rounded-md ${
                        w.risk === 'CRITICAL' ? 'bg-red-50 text-red-600 border border-red-100' :
                        w.risk === 'HIGH' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                        'bg-stone-100 text-stone-600'
                      }`}>
                        {w.risk}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-stone-400">{w.lastActive}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}