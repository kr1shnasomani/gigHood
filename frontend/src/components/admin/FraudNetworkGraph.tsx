'use client';

import { useMemo, useState } from 'react';

export interface FraudNode {
  id: string;
  label: string;
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  fraudScore: number;
}

export interface FraudEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

export interface NetworkGraph {
  nodes: FraudNode[];
  edges: FraudEdge[];
}

interface Position {
  x: number;
  y: number;
}

export default function FraudNetworkGraph({ data }: { data: NetworkGraph }) {
  const [filter, setFilter] = useState<'ALL' | FraudNode['riskLevel']>('ALL');

  const { visibleNodes, visibleEdges, positions, centerNodeId } = useMemo(() => {
    if (data.nodes.length === 0) {
      return {
        visibleNodes: [] as FraudNode[],
        visibleEdges: [] as FraudEdge[],
        positions: new Map<string, Position>(),
        centerNodeId: null as string | null,
      };
    }

    const degreeMap = new Map<string, number>();
    data.nodes.forEach((n) => degreeMap.set(n.id, 0));
    data.edges.forEach((e) => {
      degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
      degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
    });

    const centerNode = [...data.nodes].sort((a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0))[0];
    const filteredNodes = data.nodes.filter((n) => filter === 'ALL' || n.riskLevel === filter || n.id === centerNode.id);
    const nodeIdSet = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = data.edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target));

    const positionsMap = new Map<string, Position>();
    const viewCenter = { x: 490, y: 290 };

    positionsMap.set(centerNode.id, viewCenter);

    const ringNodes = filteredNodes.filter((n) => n.id !== centerNode.id);
    const radius = Math.max(160, Math.min(250, 120 + ringNodes.length * 8));
    ringNodes.forEach((node, idx) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI * idx) / Math.max(1, ringNodes.length);
      positionsMap.set(node.id, {
        x: viewCenter.x + radius * Math.cos(angle),
        y: viewCenter.y + radius * Math.sin(angle),
      });
    });

    return {
      visibleNodes: filteredNodes,
      visibleEdges: filteredEdges,
      positions: positionsMap,
      centerNodeId: centerNode.id,
    };
  }, [data.edges, data.nodes, filter]);

  const riskColor = (risk: FraudNode['riskLevel']) => {
    if (risk === 'CRITICAL') return '#CF4944';
    if (risk === 'HIGH') return '#E3A33D';
    if (risk === 'MEDIUM') return '#43A06F';
    return '#8A94A6';
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F2F4F8] shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[28px] leading-tight font-semibold text-[#1A2538]">Fraud Relationship Network Graph</h3>
          <p className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-amber-600 uppercase">
            Simulated Data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => {
            const active = filter === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setFilter(level)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#1F1A3B] text-white'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                {level === 'ALL' ? 'ALL' : level}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-3 pb-4">
        <svg viewBox="0 0 980 560" className="w-full h-[560px] block rounded-xl bg-[#F2F4F8]">
          {visibleEdges.map((edge, idx) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            return (
              <line
                key={`${edge.source}-${edge.target}-${idx}`}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke="#CCD5E2"
                strokeWidth={Math.max(1.2, edge.weight * 2.3)}
                strokeOpacity={0.8}
              />
            );
          })}

          {visibleNodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;

            const isCenter = node.id === centerNodeId;
            const radius = isCenter ? 42 : Math.max(15, Math.min(30, 13 + node.fraudScore / 5.5));
            const fill = isCenter ? '#E3A33D' : riskColor(node.riskLevel);

            return (
              <g key={node.id}>
                <circle cx={pos.x} cy={pos.y} r={radius} fill={fill} fillOpacity={0.95} />
                <circle cx={pos.x} cy={pos.y} r={radius} fill="none" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} />
                <title>{`${node.label} • ${node.riskLevel} • Fraud ${node.fraudScore}`}</title>

                <text
                  x={pos.x}
                  y={pos.y + radius + 20}
                  textAnchor="middle"
                  fontSize="14"
                  fill="#4A5567"
                  fontWeight="600"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
