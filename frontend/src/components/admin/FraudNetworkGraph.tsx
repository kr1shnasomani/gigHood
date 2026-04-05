'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const positions = useMemo(() => {
    const newPositions = new Map<string, Position>();
    const radius = 150;

    // Initialize positions in a circle
    data.nodes.forEach((node, idx) => {
      const angle = (idx / data.nodes.length) * 2 * Math.PI;
      newPositions.set(node.id, {
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    });

    return newPositions;
  }, [data.nodes]);

  // Render canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || positions.size === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    // Draw edges
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 2;
    data.edges.forEach((edge) => {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      if (!sourcePos || !targetPos) return;

      ctx.beginPath();
      ctx.moveTo(centerX + sourcePos.x, centerY + sourcePos.y);
      ctx.lineTo(centerX + targetPos.x, centerY + targetPos.y);
      ctx.stroke();

      // Draw edge label at midpoint
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(edge.label, centerX + midX, centerY + midY);
    });

    // Draw nodes
    data.nodes.forEach((node) => {
      const pos = positions.get(node.id);
      if (!pos) return;

      const x = centerX + pos.x;
      const y = centerY + pos.y;
      const radius = 30;
      const isHovered = hoveredNode === node.id;

      // Node background
      const nodeColor = {
        CRITICAL: '#ef4444',
        HIGH: '#f97316',
        MEDIUM: '#eab308',
        LOW: '#22c55e',
      }[node.riskLevel];

      ctx.fillStyle = isHovered ? nodeColor : `${nodeColor}80`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fill();

      // Node border
      ctx.strokeStyle = nodeColor;
      ctx.lineWidth = isHovered ? 4 : 2;
      ctx.stroke();

      // Node label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, x, y - 8);

      // Fraud score
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`${node.fraudScore}`, x, y + 10);
    });

    // Draw legend
    const legendX = 20;
    const legendY = 20;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(legendX - 5, legendY - 5, 200, 140);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX - 5, legendY - 5, 200, 140);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Fraud Network', legendX, legendY + 15);

    const riskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
    riskLevels.forEach((level, idx) => {
      const colors = {
        CRITICAL: '#ef4444',
        HIGH: '#f97316',
        MEDIUM: '#eab308',
        LOW: '#22c55e',
      };

      ctx.fillStyle = colors[level];
      ctx.fillRect(legendX, legendY + 35 + idx * 20, 12, 12);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(level, legendX + 20, legendY + 43 + idx * 20);
    });
  }, [data, positions, hoveredNode]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;

    let hoveredNodeId: string | null = null;
    for (const node of data.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (dist < 30) {
        hoveredNodeId = node.id;
        break;
      }
    }

    setHoveredNode(hoveredNodeId);
    canvas.style.cursor = hoveredNodeId ? 'pointer' : 'default';
  };

  return (
    <div className="bg-[#0f172a] rounded-xl shadow-sm border border-slate-800 overflow-hidden">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50">
        <h3 className="text-sm font-semibold text-slate-200">Fraud Network Graph (Neo4j Placeholder)</h3>
        <p className="text-xs text-slate-500 mt-1">Worker relationships and fraud connections</p>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={500}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        className="w-full block"
      />
    </div>
  );
}
