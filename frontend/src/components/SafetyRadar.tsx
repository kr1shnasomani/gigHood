"use client";

import React, { useEffect, useRef, useState } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import { useTranslation } from "react-i18next";
import type { LayerProps } from "react-map-gl/maplibre";
import type { FeatureCollection, Polygon } from "geojson";

import "maplibre-gl/dist/maplibre-gl.css";
import { Navigation } from "lucide-react";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Chennai Fallback
const defaultLat = 13.0827;
const defaultLng = 80.2707;

// Simulated Backend Zones (Chennai)
const ZONES = [
  { id: 1, name: "Velachery", lat: 12.9815, lng: 80.2180, risk: "high", color: "#EF4444" },
  { id: 2, name: "T Nagar", lat: 13.0418, lng: 80.2341, risk: "moderate", color: "#EAB308" },
  { id: 3, name: "Adyar", lat: 13.0012, lng: 80.2565, risk: "safe", color: "#22C55E" },
  { id: 4, name: "OMR IT Corridor", lat: 12.9675, lng: 80.2595, risk: "demand", color: "#3B82F6" },
];

function generateHexagon(lat: number, lng: number, size: number = 0.01) {
  const coords = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    coords.push([
      lng + size * Math.cos(angle),
      lat + size * Math.sin(angle)
    ]);
  }
  coords.push(coords[0]); // close the polygon
  return [coords];
}

const mockZoneGeojson: FeatureCollection<Polygon, { risk: string; color: string }> = {
  type: "FeatureCollection",
  features: ZONES.map((zone) => ({
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: generateHexagon(zone.lat, zone.lng, 0.015),
    },
    properties: { risk: zone.risk, color: zone.color },
  }))
};

const zoneLayer: LayerProps = {
  id: "zone-data",
  type: "fill",
  paint: {
    "fill-color": ["get", "color"] as ["get", string],
    "fill-opacity": 0.3,
  },
};

export default function SafetyRadar({
  compact = false,
  userCoords,
}: {
  compact?: boolean;
  userCoords?: { latitude: number; longitude: number } | null;
}) {
  const { t } = useTranslation();
  const mapRef = useRef<MapRef>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mapEnabled, setMapEnabled] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const message = event?.message || "";
      if (message.includes("container") && message.includes("String or HTMLElement")) {
        setMapEnabled(false);
      }
    };

    window.addEventListener("error", onWindowError);
    return () => window.removeEventListener("error", onWindowError);
  }, []);

  // Dynamically fly to the user's location when coords update
  useEffect(() => {
    if (userCoords && mapRef.current) {
      mapRef.current.flyTo({
        center: [userCoords.longitude, userCoords.latitude],
        zoom: 13,
        duration: 1500,
        essential: true
      });
    }
  }, [userCoords]);

  // Find nearest zone for auto-zoom if no user coords are provided yet
  const effectiveLat = userCoords?.latitude || defaultLat;
  const effectiveLng = userCoords?.longitude || defaultLng;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: compact ? "280px" : "100vh",
        maxHeight: compact ? "280px" : "100%",
        borderRadius: compact ? "16px" : "0px",
        overflow: "hidden",
        border: compact ? "1px solid rgba(255,255,255,0.08)" : "none",
        background: "#020617",
      }}
    >
      {isMounted && mapEnabled ? (
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: effectiveLng,
            latitude: effectiveLat,
            zoom: 12,
          }}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
          interactive={!compact}
          attributionControl={false}
        >
          <Source type="geojson" data={mockZoneGeojson}>
            <Layer {...zoneLayer} />
          </Source>

          <Marker longitude={effectiveLng} latitude={effectiveLat} anchor="center">
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "40px",
                  height: "40px",
                  background: "rgba(99, 102, 241, 0.3)",
                  borderRadius: "50%",
                  animation: "pulse 2s infinite",
                }}
              />
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  background: "#6366F1",
                  border: "2px solid white",
                  borderRadius: "50%",
                  boxShadow: "0 0 10px rgba(99, 102, 241, 0.8)",
                  zIndex: 2,
                }}
              />
            </div>
          </Marker>
        </Map>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#94A3B8",
            fontSize: "12px",
            background: "radial-gradient(circle at 50% 40%, rgba(99,102,241,0.18), rgba(2,6,23,0.95) 65%)",
          }}
        >
          Live map is initializing...
        </div>
      )}

      {/* GRADIENT OVERLAY FOR STYLING & GLOW */}
      {compact && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            boxShadow: "inset 0 0 20px 10px #020617",
            borderRadius: "16px",
          }}
        />
      )}

      {/* COMPACT OVERLAY UI */}
      {compact && (
        <div
          style={{
            position: "absolute",
            bottom: "0px",
            width: "100%",
            padding: "16px",
            background: "linear-gradient(to top, rgba(2,6,23,0.95), transparent)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <span style={{ fontSize: "10px", padding: "2px 8px", background: "rgba(34,197,94,0.2)", color: "#22C55E", borderRadius: "99px", fontWeight: 600 }}>{t("home.status_safe")}</span>
            <span style={{ fontSize: "10px", padding: "2px 8px", background: "rgba(239,68,68,0.2)", color: "#EF4444", borderRadius: "99px", fontWeight: 600 }}>{t("home.status_warning")}</span>
            <span style={{ fontSize: "10px", padding: "2px 8px", background: "rgba(59,130,246,0.2)", color: "#3B82F6", borderRadius: "99px", fontWeight: 600 }}>{t("home.radar_demand")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", padding: "8px 12px", borderRadius: "10px", width: "max-content" }}>
            <Navigation size={14} color="#818CF8" />
            <span style={{ fontSize: "12px", color: "#818CF8", fontWeight: 600 }}>{t("home.live_zone_overlay")}</span>
          </div>
        </div>
      )}
    </div>
  );
}
