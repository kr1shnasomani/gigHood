'use client'

import { useEffect, useState, useCallback } from 'react'
import DeckGL from '@deck.gl/react'
import { H3HexagonLayer } from '@deck.gl/geo-layers'
import { Map } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  fetchLiveZones,
  HexZone,
} from '@/lib/admin/adminClient'

const INITIAL_VIEW_STATE = {
  longitude: 77.5946,
  latitude: 12.9716,
  zoom: 11.5,
  pitch: 40,
  bearing: 0,
}

const TIMEFRAMES = ['Real-time', '1h', '4h'] as const

/* COLORS */
function dciColor(dci: number, alpha = 180): [number, number, number, number] {
  if (dci > 0.85) return [220, 38, 38, alpha]
  if (dci > 0.65) return [234, 179, 8, alpha]
  return [34, 197, 94, alpha]
}

function dciHex(dci: number) {
  if (dci > 0.85) return '#ef4444'
  if (dci > 0.65) return '#facc15'
  return '#22c55e'
}

/* BAR DATA */
function buildBarData(zones: HexZone[]) {
  const buckets = [0, 0, 0, 0, 0, 0, 0]
  zones.forEach(z => {
    const idx = Math.min(6, Math.floor((z.dci_score ?? 0) * 7))
    buckets[idx]++
  })
  const max = Math.max(1, ...buckets)
  return buckets.map(v => v / max)
}

export default function MapPage() {
  const [zones, setZones] = useState<HexZone[]>([])
  const [loading, setLoading] = useState(true)
  const [hoverInfo, setHoverInfo] = useState<any>(null)
  const [alertZone, setAlertZone] = useState<HexZone | null>(null)
  const [timeframe, setTimeframe] = useState('Real-time')
  const [hasMounted, setHasMounted] = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)

  const loadZones = useCallback(async () => {
    try {
      const data = await fetchLiveZones()
      setZones(data)

      const highest = [...data].sort(
        (a, b) => (b.dci_score ?? 0) - (a.dci_score ?? 0)
      )[0]

      if (highest) setAlertZone(highest)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setHasMounted(true)

    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')

    setWebglSupported(Boolean(gl))
    loadZones()
  }, [loadZones])

  const sortedZones = [...zones]
    .filter(z => z.dci_score != null)
    .sort((a, b) => (b.dci_score ?? 0) - (a.dci_score ?? 0))
    .slice(0, 3)

  const avgLoad = zones.length
    ? Math.round(zones.reduce((s, z) => s + (z.dci_score ?? 0), 0) / zones.length * 100)
    : 0

  const peakZone = sortedZones[0]
  const barData = buildBarData(zones)

  if (!hasMounted) {
    return (
      <div className="p-6 h-[650px] rounded-2xl bg-slate-950 text-slate-300 flex items-center justify-center">
        Initializing map...
      </div>
    )
  }

  if (!webglSupported) {
    return (
      <div className="p-6 h-[650px] rounded-2xl bg-slate-950 text-slate-300 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold mb-2">WebGL is not available</p>
        <p className="text-xs text-slate-400 max-w-xs">
          Your browser or device does not support WebGL, so the map cannot render. Please try a different browser or disable any browser extension that blocks WebGL.
        </p>
      </div>
    )
  }

  const layer = new H3HexagonLayer({
    id: 'h3-layer',
    data: zones.filter(z => z.h3_index),
    pickable: true,
    filled: true,
    extruded: true,
    elevationScale: 8,

    getHexagon: (d: HexZone) => d.h3_index,
    getFillColor: (d: HexZone) => dciColor(d.dci_score ?? 0),
    getElevation: (d: HexZone) => ((d.dci_score ?? 0) * 200) + 20,

    getLineColor: [255, 255, 255, 30],
    lineWidthMinPixels: 1,

    onHover: (info: any) => setHoverInfo(info.object ? info : null),
    onClick: (info: any) => info.object && setAlertZone(info.object),
  })

  return (
    <div className="p-6" style={{ fontFamily: "'Inter', sans-serif" }}>

      <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
           style={{ height: 650 }}>

        {/* MAP TINT */}
        <div className="absolute inset-0 bg-[#0b1a2b]/60 mix-blend-multiply z-[150]" />

        {/* LEFT TOP PANEL */}
        <div className="absolute top-4 left-4 z-[400] w-56 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Map Configuration</p>

          <div>
            <p className="text-[10px] text-slate-500">Resolution</p>
            <div className="bg-slate-800 px-3 py-1 rounded-lg text-xs mt-1">H3 Resolution 8</div>
          </div>

          <div>
            <p className="text-[10px] text-slate-500 mb-1">Timeframe</p>
            <div className="flex gap-1">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className="flex-1 py-1 rounded-md text-[10px]"
                  style={{
                    background: timeframe === tf ? '#7c3aed' : 'transparent',
                    color: timeframe === tf ? '#fff' : '#94a3b8'
                  }}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LEFT MID PANEL */}
        <div className="absolute top-[200px] left-4 z-[400] w-56 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Real-Time DCI Heatmap</p>

          <div className="text-xs text-slate-400 flex justify-between">
            <span>Avg. Load</span>
            <span className="text-emerald-400 font-bold">{avgLoad}%</span>
          </div>

          {peakZone && (
            <div className="text-xs text-slate-400 flex justify-between">
              <span>Peak</span>
              <span className="text-red-400 font-bold">
                {peakZone.city} ({peakZone.dci_score?.toFixed(2)})
              </span>
            </div>
          )}

          <div className="flex items-end gap-[3px] h-10">
            {barData.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded"
                style={{
                  height: `${Math.max(6, h * 40)}px`,
                  background: i >= 5 ? '#ef4444' : i >= 3 ? '#facc15' : '#1e293b'
                }}
              />
            ))}
          </div>
        </div>

        {/* RIGHT TOP PANEL */}
        <div className="absolute top-4 right-4 z-[400] w-60 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Disruption Forecast</p>

          <div className="bg-slate-800 p-3 rounded-lg border-l-2 border-red-400 text-xs">
            Indiranagar spike predicted (+14%)
          </div>

          <div className="bg-slate-800 p-3 rounded-lg border-l-2 border-green-400 text-xs">
            Stability recovery in Koramangala
          </div>
        </div>

        {/* RIGHT MID PANEL */}
        <div className="absolute top-[220px] right-4 z-[400] w-60 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Zone Performance</p>

          {sortedZones.map((z, i) => (
            <div key={i}>
              <div className="flex justify-between text-xs text-slate-300">
                <span>{z.city}</span>
                <span style={{ color: dciHex(z.dci_score ?? 0) }}>
                  {(z.dci_score ?? 0).toFixed(2)}
                </span>
              </div>

              <div className="h-1.5 bg-slate-700 rounded mt-1">
                <div
                  className="h-1.5 rounded"
                  style={{
                    width: `${(z.dci_score ?? 0) * 100}%`,
                    background: dciHex(z.dci_score ?? 0)
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* CENTER ALERT */}
        {alertZone && (
          <div className="absolute z-[450]"
               style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="bg-slate-900/90 p-5 rounded-2xl border border-red-400/40 backdrop-blur-xl">
              <p className="text-xs text-slate-400 uppercase">Critical Alert</p>
              <p className="text-sm text-white font-bold mt-1">{alertZone.city}</p>

              <p className="text-3xl font-black mt-2"
                 style={{ color: dciHex(alertZone.dci_score ?? 0) }}>
                {(alertZone.dci_score ?? 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* LEGEND */}
        <div className="absolute bottom-4 left-4 z-[400] flex gap-4 bg-slate-900/80 px-4 py-2 rounded-xl border border-white/10 text-xs">
          <span className="text-green-400">● Stable</span>
          <span className="text-yellow-400">● Moderate</span>
          <span className="text-red-400">● High</span>
        </div>

        {/* MAP */}
        <DeckGL initialViewState={INITIAL_VIEW_STATE} controller layers={[layer]}>
          <Map mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json" />
        </DeckGL>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}