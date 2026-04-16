'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d').then((m) => m.default), {
  ssr: false,
});

export interface FraudNode {
  id: string;
  label: string;
  subtitle?: string;
  type?: 'Worker' | 'Device' | 'Hex_Zone';
  details?: Record<string, string | number | boolean | null>;
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

export interface FraudNetworkMeta {
  syndicate_devices: number;
  node_count: number;
  link_count: number;
  workers_in_graph?: number;
  zones_in_graph?: number;
  devices_in_graph?: number;
  reason?: string;
  source?: 'live' | 'degraded';
}

export default function FraudNetworkGraph({ data, meta }: { data: NetworkGraph; meta?: FraudNetworkMeta }) {
  const [filter, setFilter] = useState<'ALL' | FraudNode['riskLevel']>('ALL');
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<FraudNode | null>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);

  const [dimensions, setDimensions] = useState({ width: 800, height: 560 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const zoomToFitGraph = (ms = 650) => {
    graphRef.current?.zoomToFit(ms, 220);
  };

  const zoomIn = () => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.zoom(graph.zoom() * 1.2, 250);
  };

  const zoomOut = () => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.zoom(graph.zoom() / 1.2, 250);
  };

  const recenterAndReheat = () => {
    graphRef.current?.centerAt(0, 0, 350);
    graphRef.current?.d3ReheatSimulation();
    zoomToFitGraph(550);
  };

  const { visibleNodes, visibleEdges, centerNodeId } = useMemo(() => {
    if (data.nodes.length === 0) {
      return {
        visibleNodes: [] as FraudNode[],
        visibleEdges: [] as FraudEdge[],
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

    return {
      visibleNodes: filteredNodes,
      visibleEdges: filteredEdges,
      centerNodeId: centerNode.id,
    };
  }, [data.edges, data.nodes, filter]);

  const nodeLookup = useMemo(() => {
    const map = new Map<string, FraudNode>();
    visibleNodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [visibleNodes]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return visibleEdges
      .filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)
      .map((edge, idx) => {
        const neighborId = edge.source === selectedNode.id ? edge.target : edge.source;
        const neighbor = nodeLookup.get(neighborId);
        return {
          key: `${edge.source}-${edge.target}-${idx}`,
          relation: edge.label,
          neighbor,
        };
      });
  }, [selectedNode, visibleEdges, nodeLookup]);

  useEffect(() => {
    if (!graphRef.current || visibleNodes.length === 0) return;

    const linkForce = graphRef.current.d3Force('link') as { distance?: (d: unknown) => number } | undefined;
    if (linkForce?.distance) {
      linkForce.distance(() => 125);
    }

    const chargeForce = graphRef.current.d3Force('charge') as { strength?: (s: number) => void } | undefined;
    if (chargeForce?.strength) {
      chargeForce.strength(-320);
    }

    const t = setTimeout(() => {
      zoomToFitGraph(700);
    }, 250);
    return () => clearTimeout(t);
  }, [visibleNodes.length, visibleEdges.length]);

  const riskColor = (risk: FraudNode['riskLevel']) => {
    if (risk === 'CRITICAL') return '#CF4944';
    if (risk === 'HIGH') return '#E3A33D';
    if (risk === 'MEDIUM') return '#43A06F';
    return '#8A94A6';
  };

  const nodeTypeColor = (type?: FraudNode['type']) => {
    if (type === 'Worker') return '#3B82F6';
    if (type === 'Device') return '#F97316';
    if (type === 'Hex_Zone') return '#A855F7';
    return '#64748B';
  };

  const cleanLabel = (label: string) => {
    if (label.length <= 18) return label;
    return `${label.slice(0, 16)}...`;
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-[#F2F4F8] shadow-sm overflow-hidden">
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="text-[28px] leading-tight font-semibold text-[#1A2538]">Fraud Relationship Network Graph</h3>
          <p className="mt-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-amber-600 uppercase">
            Neo4j Network Data
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
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
        {visibleNodes.length === 0 ? (
          <div className="w-full h-[560px] rounded-xl bg-[#F2F4F8] grid place-items-center text-center">
            <div>
              <p className="text-[20px] font-bold text-[#445268]">No Fraud Syndicate Graph Yet</p>
              <p className="text-[14px] text-[#6B7689] mt-2">
                Process claims that share devices across multiple workers and zones to populate this view.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            <div ref={containerRef} className="relative w-full h-[560px] rounded-xl bg-[#F2F4F8] overflow-hidden border border-slate-200">
              <div className="absolute top-3 left-3 z-10 rounded-lg bg-white/90 border border-slate-200 px-3 py-2 text-[11px] text-slate-600 shadow-sm space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#3B82F6]" />
                  Worker
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F97316] ml-2" />
                  Device
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#A855F7] ml-2" />
                  Zone
                </div>
                <div className="text-[10px] text-slate-500">Click node to inspect relationships and metadata.</div>
              </div>

              <ForceGraph2D
                ref={graphRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={{
                  nodes: visibleNodes,
                  links: visibleEdges.map((e) => ({ ...e, source: e.source, target: e.target })),
                }}
                cooldownTicks={160}
                linkDirectionalParticles={0}
                linkWidth={(link) => Math.max(1, ((link as { weight?: number }).weight ?? 1) * 1.2)}
                linkColor={() => 'rgba(107, 114, 128, 0.55)'}
                nodeRelSize={9}
                onBackgroundClick={() => setSelectedNode(null)}
                onNodeHover={(node) => setHoverNodeId((node as FraudNode | null)?.id ?? null)}
                onNodeClick={(node) => setSelectedNode(node as FraudNode)}
                nodeCanvasObject={(nodeObj, ctx, globalScale) => {
                  const node = nodeObj as unknown as FraudNode;
                  const isCenter = node.id === centerNodeId;
                  const isHovered = hoverNodeId === node.id;
                  const isSelected = selectedNode?.id === node.id;
                  const radius = isCenter ? 11 : Math.max(5.5, Math.min(10.5, 4 + node.fraudScore / 18));
                  const fill = nodeTypeColor(node.type);

                  ctx.beginPath();
                  ctx.arc(nodeObj.x ?? 0, nodeObj.y ?? 0, radius + (isSelected ? 3 : 0), 0, 2 * Math.PI, false);
                  ctx.fillStyle = isSelected ? 'rgba(59,130,246,0.2)' : 'transparent';
                  ctx.fill();

                  ctx.beginPath();
                  ctx.arc(nodeObj.x ?? 0, nodeObj.y ?? 0, radius, 0, 2 * Math.PI, false);
                  ctx.fillStyle = fill;
                  ctx.fill();
                  ctx.lineWidth = isHovered || isSelected ? 2.2 : 1.2;
                  ctx.strokeStyle = isHovered || isSelected ? riskColor(node.riskLevel) : 'rgba(255,255,255,0.65)';
                  ctx.stroke();

                  const showLabel = isSelected || isCenter || isHovered || globalScale > 1.25;
                  if (showLabel) {
                    const label = cleanLabel(node.label);
                    const fontSize = Math.max(8, 11 / globalScale);
                    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); 

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    ctx.fillRect(
                      (nodeObj.x ?? 0) - bckgDimensions[0] / 2,
                      (nodeObj.y ?? 0) + radius + 5 - bckgDimensions[1] / 2,
                      bckgDimensions[0],
                      bckgDimensions[1]
                    );

                    ctx.fillStyle = '#1F2937';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, nodeObj.x ?? 0, (nodeObj.y ?? 0) + radius + 5);
                  }
                }}
                nodePointerAreaPaint={(nodeObj, color, ctx) => {
                  const node = nodeObj as unknown as FraudNode;
                  const isCenter = node.id === centerNodeId;
                  const radius = isCenter ? 19 : Math.max(14, Math.min(18, 12 + node.fraudScore / 18));
                  ctx.fillStyle = color;
                  ctx.beginPath();
                  ctx.arc(nodeObj.x ?? 0, nodeObj.y ?? 0, radius, 0, 2 * Math.PI, false);
                  ctx.fill();
                }}
                nodeLabel={(n) => {
                  const node = n as unknown as FraudNode;
                  return `${node.label} • ${node.type ?? 'Unknown'} • ${node.riskLevel} • Fraud ${node.fraudScore}`;
                }}
                d3VelocityDecay={0.35}
                d3AlphaDecay={0.035}
                minZoom={0.3}
                maxZoom={4.5}
              />

              <div className="absolute bottom-4 right-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={zoomIn}
                className="w-9 h-9 rounded-full bg-white/95 border border-slate-300 text-slate-700 text-lg leading-none font-bold hover:bg-white shadow-sm"
                aria-label="Zoom in"
              >
                +
              </button>
              <button
                type="button"
                onClick={zoomOut}
                className="w-9 h-9 rounded-full bg-white/95 border border-slate-300 text-slate-700 text-lg leading-none font-bold hover:bg-white shadow-sm"
                aria-label="Zoom out"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => zoomToFitGraph(500)}
                className="w-9 h-9 rounded-full bg-white/95 border border-slate-300 text-slate-700 text-xs font-bold hover:bg-white shadow-sm"
                aria-label="Fit graph"
              >
                []
              </button>
              <button
                type="button"
                onClick={recenterAndReheat}
                className="w-9 h-9 rounded-full bg-white/95 border border-slate-300 text-slate-700 text-xs font-bold hover:bg-white shadow-sm"
                aria-label="Recenter graph"
              >
                o
              </button>
            </div>

            </div>

            <aside className="rounded-xl border border-slate-200 bg-white p-4 h-[560px] overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-900">Entity Intelligence</h4>

              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                  Nodes
                  <div className="font-semibold text-slate-900">{meta?.node_count ?? visibleNodes.length}</div>
                </div>
                <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                  Links
                  <div className="font-semibold text-slate-900">{meta?.link_count ?? visibleEdges.length}</div>
                </div>
                <div className="rounded-lg bg-slate-100 px-2 py-1.5 text-slate-700">
                  Devices
                  <div className="font-semibold text-slate-900">{meta?.syndicate_devices ?? 0}</div>
                </div>
              </div>

              {(meta?.reason || meta?.source === 'degraded') && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  Data mode: Live degraded
                  {meta?.reason ? ` (${meta.reason})` : ''}
                </div>
              )}

              {selectedNode ? (
                <div className="mt-4 space-y-3 text-xs">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Selected Node</p>
                    <h5 className="text-sm font-semibold text-slate-900 mt-1">{selectedNode.label}</h5>
                    {selectedNode.subtitle && <p className="text-slate-500 mt-0.5">{selectedNode.subtitle}</p>}
                  </div>

                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>Type</span>
                      <span className="font-medium text-slate-900">{selectedNode.type ?? 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Risk Level</span>
                      <span className="font-medium text-slate-900">{selectedNode.riskLevel}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Fraud Score</span>
                      <span className="font-medium text-slate-900">{selectedNode.fraudScore}</span>
                    </div>
                  </div>

                  {selectedNode.details && Object.keys(selectedNode.details).length > 0 && (
                    <div className="rounded-lg border border-slate-200 p-2.5 space-y-1.5">
                      {Object.entries(selectedNode.details).map(([key, value]) => (
                        <div key={key} className="flex justify-between gap-2 text-slate-600">
                          <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-slate-900 text-right">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500 mb-2">Connections</p>
                    <div className="space-y-1.5">
                      {selectedConnections.length === 0 && (
                        <p className="text-slate-500">No visible connections for this node under current filter.</p>
                      )}
                      {selectedConnections.map((conn) => (
                        <div key={conn.key} className="rounded-md border border-slate-200 px-2 py-1.5">
                          <p className="text-slate-800 font-medium">{conn.neighbor?.label ?? 'Unknown Node'}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Relation: {conn.relation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-600 space-y-2">
                  <p>Click any node to inspect its metadata and relationships.</p>
                  <p>
                    Node color indicates entity type, while outline color follows risk level.
                  </p>
                  <p>
                    Use zoom controls to isolate micro-clusters before selecting nodes.
                  </p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
