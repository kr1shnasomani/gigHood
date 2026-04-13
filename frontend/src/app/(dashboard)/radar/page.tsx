'use client';

import dynamic from 'next/dynamic';
import useGeolocation from '@/hooks/useGeolocation';

// 🔥 VERY IMPORTANT (Leaflet fix)
const SafetyRadar = dynamic(() => import('@/components/SafetyRadar'), {
  ssr: false,
});

export default function RadarPage() {
  const { coords, error } = useGeolocation(true);

  return (
    <div className="page-content" style={{ padding: "20px" }}>

      {/* HEADER */}
      <div style={{ marginBottom: '16px' }}>
        <h2 className="gradient-text" style={{ fontSize: "24px", fontWeight: "bold" }}>🗺 Safety Radar</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Live zone risk & high earning areas near you
        </p>
      </div>

      {/* GPS STATUS */}
      {error && (
        <div className="glass-card" style={{ padding: '10px', marginBottom: '12px', color: "#EF4444" }}>
          📍 Enable location for accurate results
        </div>
      )}

      {/* MAP */}
      <div className="glass-card" style={{ padding: '10px' }}>
        <SafetyRadar compact={false} userCoords={coords} />
      </div>

    </div>
  );
}
