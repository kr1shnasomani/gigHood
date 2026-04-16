'use client'

import { useEffect, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { cellToLatLng, isValidCell } from 'h3-js'
import 'maplibre-gl/dist/maplibre-gl.css'

import {
  fetchLiveZones,
  HexZone,
} from '@/lib/admin/adminClient'
import { Home, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react'

import { Map as MapLibre } from 'react-map-gl/maplibre'

const DeckGL = dynamic(() => import('@deck.gl/react').then((m) => m.default), {
  ssr: false,
})

type H3HexagonLayerCtor = typeof import('@deck.gl/geo-layers').H3HexagonLayer
type PickingInfo = import('@deck.gl/core').PickingInfo<HexZone>
type MapViewState = {
  longitude: number
  latitude: number
  zoom: number
  pitch: number
  bearing: number
  transitionDuration?: number
}

const INITIAL_VIEW_STATE = {
  longitude: 77.5946,
  latitude:  12.9716,
  zoom:      11.5,
  pitch:     40,
  bearing:   0,
}

/* ── DCI helpers ── */
function dciColor(dci: number, alpha = 200): [number, number, number, number] {
  if (dci > 0.85) return [239, 68,  68,  alpha]
  if (dci > 0.65) return [249, 115, 22, alpha]   // orange accent
  return [34, 197, 94, alpha]
}

function dciHex(dci: number) {
  if (dci > 0.85) return '#ef4444'
  if (dci > 0.65) return '#f97316'
  return '#22c55e'
}

function dciLabel(dci: number) {
  if (dci > 0.85) return 'CRITICAL'
  if (dci > 0.65) return 'ELEVATED'
  return 'STABLE'
}

function buildBarData(zones: HexZone[]) {
  const buckets = [0, 0, 0, 0, 0, 0, 0]
  zones.forEach(z => {
    const idx = Math.min(6, Math.floor((z.dci_score ?? 0) * 7))
    buckets[idx]++
  })
  const max = Math.max(1, ...buckets)
  return buckets.map(v => v / max)
}

/* ── Glass card style (for map overlays) ── */
const glassCard: React.CSSProperties = {
  background: 'rgba(15, 10, 5, 0.75)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(249,115,22,0.15)',
  borderRadius: 16,
}

/* ── Orange-tinted stat card (for below-map panels) ── */
const statCard: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: 16,
  border: '1px solid rgba(249,115,22,0.12)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.05), 0 8px 24px rgba(249,115,22,0.05)',
}

export default function MapPage() {
  const [selectedCity,   setSelectedCity]   = useState('Bengaluru')
  const [alertZone,      setAlertZone]      = useState<HexZone | null>(null)
  const [hasMounted,     setHasMounted]     = useState(false)
  const [webglSupported, setWebglSupported] = useState(true)
  const [deckReady,      setDeckReady]      = useState(false)
  const [deckError,      setDeckError]      = useState<string | null>(null)
  const [h3Ctor,         setH3Ctor]         = useState<H3HexagonLayerCtor | null>(null)
  const [viewState,      setViewState]      = useState<MapViewState>(INITIAL_VIEW_STATE)

  const {
    data: zones = [],
    isLoading: zonesLoading,
    isError: zonesError,
    error: zonesErrorDetail,
  } = useQuery<HexZone[]>({
    queryKey: ['admin', 'zones'],
    queryFn: fetchLiveZones,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchInterval: 45_000,
  })

  useEffect(() => {
    if (!zonesError) return
    console.error('H3 zones live fetch failed:', zonesErrorDetail)
  }, [zonesError, zonesErrorDetail])

  const cityOptions = useMemo(() => {
    const set = new Set<string>()
    zones.forEach((z) => {
      const city = (z.city || '').trim()
      if (city) set.add(city)
    })
    return Array.from(set).sort()
  }, [zones])

  const validZones = useMemo(() => {
    return zones.filter((z) => Boolean(z.h3_index) && isValidCell(String(z.h3_index)))
  }, [zones])

  useEffect(() => {
    if (zones.length === 0) return
    const cityZones = zones.filter((z) => (z.city || '').trim() === selectedCity && Boolean(z.h3_index) && isValidCell(String(z.h3_index)))
    if (cityZones.length === 0) return
    const sample = cityZones.slice(0, 300)
    const coords = sample.map((z) => cellToLatLng(String(z.h3_index)))
    if (coords.length === 0) return

    const lat = coords.reduce((sum, pair) => sum + pair[0], 0) / coords.length
    const lng = coords.reduce((sum, pair) => sum + pair[1], 0) / coords.length

    setViewState((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      zoom: 11.2,
      transitionDuration: 1500,
    }))
  }, [selectedCity, zones])

  useEffect(() => {
    setHasMounted(true)
    const canvas = document.createElement('canvas')
    setWebglSupported(Boolean(canvas.getContext('webgl2')))
  }, [])

  useEffect(() => {
    let cancelled = false
    const initDeck = async () => {
      if (!hasMounted || !webglSupported) return
      try {
        const geoLayers = await import('@deck.gl/geo-layers')
        if (cancelled) return
        setH3Ctor(() => geoLayers.H3HexagonLayer)
        window.setTimeout(() => { if (!cancelled) setDeckReady(true) }, 0)
      } catch (err) {
        console.error('Failed to initialize map runtime:', err)
        if (!cancelled) setDeckError('3D map engine failed to initialize.')
      }
    }
    initDeck()
    return () => { cancelled = true }
  }, [hasMounted, webglSupported])

  const zoneStats = useMemo(() => {
    const ws     = validZones.filter(z => z.dci_score != null)
    const sorted = [...ws].sort((a, b) => (b.dci_score ?? 0) - (a.dci_score ?? 0))
    const avg    = ws.length
      ? Math.round(ws.reduce((s, z) => s + (z.dci_score ?? 0), 0) / ws.length * 100)
      : 0
    return {
      sortedTop3:  sorted.slice(0, 3),
      sortedTop6:  sorted.slice(0, 6),
      avgLoad:     avg,
      peakZone:    sorted[0],
      highRisk:    ws.filter(z => (z.dci_score ?? 0) > 0.85).length,
      moderateRisk:ws.filter(z => (z.dci_score ?? 0) > 0.65 && (z.dci_score ?? 0) <= 0.85).length,
      stable:      ws.filter(z => (z.dci_score ?? 0) <= 0.65).length,
      total:       ws.length,
      barData:     buildBarData(ws),
    }
  }, [validZones])

  const layer = useMemo(() => {
    if (!h3Ctor) return null
    return new h3Ctor({
      id: 'h3-layer',
      data: validZones,
      pickable: true,
      filled: true,
      extruded: false,
      getHexagon:   (d: HexZone) => d.h3_index,
      getFillColor: (d: HexZone) => dciColor(d.dci_score ?? 0, 170),
      getLineColor: [255, 255, 255, 28],
      lineWidthMinPixels: 0.8,
      updateTriggers: { getFillColor: validZones },
      onClick: (info: PickingInfo) => { if (info.object) setAlertZone(info.object) },
    })
  }, [h3Ctor, validZones])

  /* ── Fallbacks for non-WebGL / errors ── */
  if (!hasMounted) {
    return (
      <div className="p-7 h-[600px] rounded-2xl bg-stone-900 text-stone-400 flex items-center justify-center text-sm">
        Initializing map…
      </div>
    )
  }

  if (!webglSupported) {
    return (
      <div className="p-7 h-[600px] rounded-2xl bg-stone-900 text-stone-400 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-white mb-2">WebGL2 Unavailable</p>
        <p className="text-xs max-w-xs">Please try a different browser or disable GPU-blocking extensions.</p>
      </div>
    )
  }

  if (deckError) {
    return (
      <div className="p-7 h-[600px] rounded-2xl bg-stone-900 text-stone-400 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-white mb-2">Map Engine Error</p>
        <p className="text-xs max-w-sm">{deckError}</p>
      </div>
    )
  }

  return (
    <div className="p-7 space-y-6">

      {/* ── Page header ── */}
      <div>
        <nav className="flex items-center gap-1 text-[11px] text-stone-400 mb-3">
          <Home size={11} />
          <span className="mx-1">·</span>
          <span className="hover:text-orange-500 cursor-pointer transition-colors">Admin</span>
          <ChevronRight size={11} className="text-stone-300" />
          <span className="text-stone-700 font-semibold">H3 Hex Map</span>
        </nav>
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-[0.2em] mb-1">Live Monitoring</p>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Real-Time DCI Heatmap</h1>
            <p className="text-sm text-stone-500 mt-1">
              H3 hexagonal disruption coverage index · Resolution 8
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.15em]">City</span>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold bg-white text-stone-700"
              >
                {cityOptions.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              <span className="text-[11px] text-stone-500">
                Rendering {validZones.length.toLocaleString()} valid H3 cells
              </span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden lg:flex items-center gap-6 shrink-0">
            {[
              { label: 'Critical Zones', value: zoneStats.highRisk,    color: 'text-red-600' },
              { label: 'Elevated Zones', value: zoneStats.moderateRisk, color: 'text-orange-600' },
              { label: 'Stable Zones',   value: zoneStats.stable,       color: 'text-emerald-600' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {zonesError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          Failed to load live H3 zones from Supabase. Check backend `/admin/dashboard/zones` and DB connectivity.
        </div>
      )}

      {!zonesError && zones.length > 0 && validZones.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          Live zones loaded but none had valid H3 indexes.
        </div>
      )}

      {/* ── Map canvas ── */}
      <div className="relative rounded-2xl overflow-hidden bg-stone-900" style={{ height: 560, boxShadow: '0 4px 40px rgba(0,0,0,0.25)' }}>

        {/* ── TOP-LEFT: Map config ── */}
        <div className="absolute top-4 left-4 z-[400] w-52" style={glassCard}>
          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em]">Map Configuration</p>
          </div>
          <div className="px-4 pb-3 space-y-2.5">
            <div>
              <p className="text-[10px] text-stone-500 mb-1">Resolution</p>
              <div className="bg-white/10 px-3 py-1.5 rounded-lg text-xs text-stone-300">H3 Resolution 8</div>
            </div>
          </div>
        </div>

        {/* ── LEFT-MID: DCI stats ── */}
        <div className="absolute top-[110px] left-4 z-[400] w-52" style={glassCard}>
          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em]">DCI Heatmap</p>
          </div>
          <div className="px-4 pb-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-stone-500">Avg. Load</span>
              <span className="text-emerald-400 font-bold">{zoneStats.avgLoad}%</span>
            </div>
            {zoneStats.peakZone && (
              <div className="flex justify-between text-xs">
                <span className="text-stone-500">Peak</span>
                <span className="text-red-400 font-bold">
                  {zoneStats.peakZone.city} ({zoneStats.peakZone.dci_score?.toFixed(2)})
                </span>
              </div>
            )}
            {/* Mini bar chart */}
            <div className="flex items-end gap-[2px] h-8 pt-1">
              {zoneStats.barData.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${Math.max(4, h * 32)}px`,
                    background: i >= 5 ? '#ef4444' : i >= 3 ? '#f97316' : 'rgba(255,255,255,0.15)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── TOP-RIGHT: Zone performance ── */}
        <div className="absolute top-4 right-4 z-[400] w-56" style={glassCard}>
          <div className="px-4 pt-3 pb-1">
            <p className="text-[9px] font-black text-orange-400 uppercase tracking-[0.2em]">Zone Performance</p>
          </div>
          <div className="px-4 pb-4 space-y-2.5">
            {zoneStats.sortedTop3.map((z, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-300 font-medium">{z.city}</span>
                  <span className="font-bold font-mono" style={{ color: dciHex(z.dci_score ?? 0) }}>
                    {(z.dci_score ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width:      `${(z.dci_score ?? 0) * 100}%`,
                      background: dciHex(z.dci_score ?? 0),
                      boxShadow:  `0 0 6px ${dciHex(z.dci_score ?? 0)}80`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Critical alert popover ── */}
        {alertZone && (
          <div
            className="absolute z-[450] cursor-pointer bottom-4 right-4"
            onClick={() => setAlertZone(null)}
            title="Click to dismiss"
          >
            <div style={{ ...glassCard, padding: '20px 24px', borderColor: 'rgba(239,68,68,0.4)' }}>
              <p className="text-[9px] font-black text-stone-400 uppercase tracking-widest">Critical Alert</p>
              <p className="text-base text-white font-bold mt-1">{alertZone.city}</p>
              <p
                className="text-4xl font-black mt-1 font-mono"
                style={{ color: dciHex(alertZone.dci_score ?? 0), textShadow: `0 0 20px ${dciHex(alertZone.dci_score ?? 0)}60` }}
              >
                {(alertZone.dci_score ?? 0).toFixed(2)}
              </p>
              <p
                className="text-[10px] font-black mt-1 uppercase tracking-wider"
                style={{ color: dciHex(alertZone.dci_score ?? 0) }}
              >
                {dciLabel(alertZone.dci_score ?? 0)}
              </p>
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="absolute bottom-4 left-4 z-[400]" style={{ ...glassCard, padding: '8px 16px' }}>
          <div className="flex gap-4 text-xs">
            <span className="text-emerald-400 font-semibold">● Stable</span>
            <span className="font-semibold" style={{ color: '#f97316' }}>● Elevated</span>
            <span className="text-red-400 font-semibold">● Critical</span>
          </div>
        </div>

        {/* ── Map render ── */}
        {deckReady && layer ? (
          <div className="absolute inset-0 z-0 bg-stone-900">
            <DeckGL
              style={{ width: '100%', height: '100%' }}
              viewState={viewState}
              onViewStateChange={(params: { viewState: MapViewState }) => setViewState(params.viewState)}
              controller={{
                scrollZoom: true, dragPan: true, dragRotate: true,
                doubleClickZoom: true, touchZoom: true, touchRotate: true,
              }}
              layers={[layer]}
              onError={(error: unknown) => {
                console.error('DeckGL runtime error:', error)
                setDeckError('Map rendering failed while initializing GPU resources.')
              }}
            >
              <MapLibre
                mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
              />
            </DeckGL>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="space-y-3 text-center">
              <div
                className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"
                style={{ boxShadow: '0 0 16px rgba(249,115,22,0.3)' }}
              />
              <p className="text-[11px] text-stone-500">Initializing 3D engine…</p>
            </div>
          </div>
        )}

        {zonesLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-[500]">
            <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"
                 style={{ boxShadow: '0 0 16px rgba(249,115,22,0.3)' }} />
          </div>
        )}
      </div>

      {/* ── Below-map panels — rethemed to orange-light ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Zone Health Split */}
        <div style={statCard}>
          <div className="px-5 pt-4 pb-3 border-b border-stone-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                <AlertTriangle size={12} className="text-orange-400" />
              </div>
              <p className="text-[11px] font-black text-stone-500 uppercase tracking-[0.14em]">Zone Health Split</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            {[
              { label: 'High Risk (> 0.85)',    value: zoneStats.highRisk,     color: 'text-red-600',     bar: 'from-red-400 to-red-500' },
              { label: 'Moderate (0.66–0.85)',  value: zoneStats.moderateRisk, color: 'text-orange-600',  bar: 'from-amber-400 to-orange-400' },
              { label: 'Stable (≤ 0.65)',       value: zoneStats.stable,       color: 'text-emerald-600', bar: 'from-emerald-400 to-emerald-500' },
            ].map(row => {
              const pct = zoneStats.total > 0 ? Math.round((row.value / zoneStats.total) * 100) : 0
              return (
                <div key={row.label}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[12px] text-stone-600">{row.label}</span>
                    <span className={`text-[13px] font-black ${row.color}`}>{row.value}</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${row.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between border-t border-stone-50 pt-2.5 mt-1">
              <span className="text-[12px] text-stone-500 font-semibold">Total Zones</span>
              <span className="text-[13px] font-black text-stone-900">{zoneStats.total.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Top Risk Zones */}
        <div className="lg:col-span-2" style={statCard}>
          <div className="px-5 pt-4 pb-3 border-b border-stone-50">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center">
                <TrendingUp size={12} className="text-orange-400" />
              </div>
              <p className="text-[11px] font-black text-stone-500 uppercase tracking-[0.14em]">Top Risk Zones</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAF8' }}>
                  <th className="px-5 py-3 text-left text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">Zone</th>
                  <th className="px-5 py-3 text-left text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">H3 Index</th>
                  <th className="px-5 py-3 text-left text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-5 py-3 text-left text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">DCI</th>
                </tr>
              </thead>
              <tbody>
                {zoneStats.sortedTop6.map((zone) => {
                  const hex = dciHex(zone.dci_score ?? 0)
                  const lbl = dciLabel(zone.dci_score ?? 0)
                  return (
                    <tr key={zone.h3_index} className="border-t border-stone-50 hover:bg-orange-50/40 transition-colors">
                      <td className="px-5 py-3 text-stone-800 font-bold text-[13px]">{zone.city}</td>
                      <td className="px-5 py-3 text-stone-400 font-mono text-[11px]">{zone.h3_index}</td>
                      <td className="px-5 py-3">
                        <span
                          className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: `${hex}18`, color: hex }}
                        >
                          {lbl}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-black font-mono text-[14px]" style={{ color: hex }}>
                        {(zone.dci_score ?? 0).toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}