"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  LogOut, ShieldCheck, Download, Bell, TrendingUp,
  ChevronRight, X, Check, AlertCircle, MapPin,
  Smartphone, CreditCard, UserCheck, Star, BadgeCheck,
} from "lucide-react";
import { deleteToken } from "@/lib/auth";
import { workerApi } from "@/lib/worker";
import api from "@/lib/api";
import { useLanguageStore } from "@/store/languageStore";
import { t } from "@/lib/i18n";

// ── Helpers ────────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function tierColor(tier: string) {
  const map: Record<string, string> = { A: "#A78BFA", B: "#60A5FA", C: "#FBBF24" };
  return map[tier] ?? "#60A5FA";
}

function tierGradient(tier: string) {
  const map: Record<string, string> = {
    A: "linear-gradient(135deg, #4C1D95 0%, #1E3A8A 100%)",
    B: "linear-gradient(135deg, #1E40AF 0%, #065F46 100%)",
    C: "linear-gradient(135deg, #92400E 0%, #7F1D1D 100%)",
  };
  return map[tier] ?? "linear-gradient(135deg, #1E40AF 0%, #065F46 100%)";
}

function trustColor(score: number) {
  if (score >= 85) return "#34D399";
  if (score >= 65) return "#60A5FA";
  return "#F59E0B";
}

function trustLabel(score: number) {
  if (score >= 85) return "Excellent · Fast payouts enabled";
  if (score >= 65) return "Good · Standard processing";
  return "Fair · Higher verification applied";
}

function fmtDate(s?: string) {
  return s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

function normalizeRisk(label?: string): "High" | "Moderate" | "Low" {
  const v = (label ?? "").toLowerCase();
  if (v.includes("high")) return "High";
  if (v.includes("mod")) return "Moderate";
  return "Low";
}

const CERT_BASE = "https://ifddoiwbxvfxsidksydf.supabase.co/storage/v1/object/public/policy_certificates";
const CERTS: Record<string, string> = {
  A: `${CERT_BASE}/gighood_policy_tier_A.pdf`,
  B: `${CERT_BASE}/gighood_policy_tier_B.pdf`,
  C: `${CERT_BASE}/gighood_policy_tier_C.pdf`,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{
      position: "fixed", bottom: "100px", left: "50%", transform: "translateX(-50%)",
      zIndex: 2000, background: "rgba(15,23,42,0.98)", backdropFilter: "blur(20px)",
      border: "1px solid rgba(52,211,153,0.3)", borderRadius: "16px",
      padding: "12px 20px", color: "#E2E8F0", fontSize: "13px", fontWeight: 600,
      boxShadow: "0 12px 32px rgba(0,0,0,0.6)", display: "flex", alignItems: "center",
      gap: "8px", animation: "slideUpFade 0.3s ease both", whiteSpace: "nowrap",
    }}>
      <Check size={15} color="#34D399" />
      {msg}
    </div>
  );
}

// ── Cell (Swiggy-row style) ───────────────────────────────────────────────────
function Cell({
  iconBg, icon, label, sub, right, redLabel, onClick,
}: {
  iconBg: string; icon: React.ReactNode; label: string;
  sub?: string; right?: React.ReactNode; redLabel?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "14px",
        padding: "14px 16px", background: "transparent", border: "none",
        fontFamily: "inherit", cursor: onClick ? "pointer" : "default", textAlign: "left",
      }}
    >
      <div style={{
        width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0,
        background: iconBg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: redLabel ? "#F87171" : "var(--text-primary)" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{sub}</div>}
      </div>
      {right ?? (onClick && <ChevronRight size={16} color="rgba(148,163,184,0.5)" />)}
    </button>
  );
}

// ── Section card (white rounded group like Swiggy) ────────────────────────────
function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)", borderRadius: "20px",
      border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
      ...style,
    }}>
      {React.Children.map(children, (child, i) => (
        <>
          {i > 0 && <div style={{ height: "1px", background: "rgba(255,255,255,0.05)", margin: "0 16px" }} />}
          {child}
        </>
      ))}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProfileSkeleton() {
  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div className="skeleton" style={{ height: "220px", borderRadius: "24px" }} />
      <div className="skeleton" style={{ height: "120px", borderRadius: "20px" }} />
      <div className="skeleton" style={{ height: "180px", borderRadius: "20px" }} />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const language = useLanguageStore(s => s.language);

  const [toast, setToast] = useState<string | null>(null);
  const [showEarnings, setShowEarnings] = useState(false);
  const [earningsInput, setEarningsInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "update-earnings") {
      setShowEarnings(true);
    }
  }, []);

  const { data: worker, isLoading: wL } = useQuery({ queryKey: ["me"],     queryFn: workerApi.getMe,       staleTime: 60000 });
  const { data: policy, isLoading: pL } = useQuery({ queryKey: ["policy"], queryFn: workerApi.getMyPolicy,  staleTime: 60000 });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const handleLogout = () => {
    deleteToken();
    if (typeof window !== "undefined") localStorage.removeItem("gighood-auth-store");
    queryClient.clear();
    router.replace("/");
  };

  const handleSaveEarnings = async () => {
    const val = parseFloat(earningsInput);
    if (!val || val <= 0) return;
    setSaving(true);
    try {
      await api.patch("/workers/me", { avg_daily_earnings: val });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setShowEarnings(false);
      setEarningsInput("");
      showToast("Earnings updated successfully");
    } catch {
      showToast("Update failed. Please try again.");
    } finally { setSaving(false); }
  };

  if (wL || pL) return <ProfileSkeleton />;

  // ── Derived values ──────────────────────────────────────────────────────────
  const name        = worker?.name ?? "Worker";
  const firstName   = name.split(" ")[0];
  const tier        = policy?.tier ?? "B";
  const tc          = tierColor(tier);
  const ts          = worker?.trust_score ?? 0;
  const tColor      = trustColor(ts);
  const rawPhone    = worker?.phone ?? "";
  const displayPh   = rawPhone.startsWith("+91") ? rawPhone : `+91 ${rawPhone}`;
  const zoneRisk    = normalizeRisk(policy?.tier_explanation?.avg_dci_band);
  const claimRisk   = normalizeRisk(policy?.tier_explanation?.claim_frequency_band);
  const policyStart = policy?.week_start || policy?.start_date;
  const policyEnd   = policy?.week_end   || policy?.end_date;
  const policyWeek  = `${fmtDate(policyStart)} – ${fmtDate(policyEnd)}`;
  const tierKey     = (policy?.tier ?? "").toUpperCase();
  const certUrl     = CERTS[tierKey];
  const certFile    = certUrl ? (certUrl.split("/").pop() ?? "policy.pdf") : "—";
  const circum      = 2 * Math.PI * 38; // r=38

  // trust formula rows
  const formulaRows: Array<{ label: string; value: string; tone: "pos" | "neg" | "neutral" }> = [];
  const fs = worker?.trust_breakdown?.formula_string;
  if (fs) {
    for (const chunk of fs.split("|")) {
      const [lRaw, vRaw] = chunk.split(":").map(s => (s ?? "").trim());
      if (!lRaw || !vRaw) continue;
      const tone = vRaw.includes("+") ? "pos" : vRaw.includes("-") ? "neg" : "neutral";
      formulaRows.push({ label: lRaw, value: vRaw, tone });
    }
  }

  const riskChip = (risk: "High" | "Moderate" | "Low") => {
    const map = {
      High:     { bg: "rgba(245,158,11,0.15)", color: "#FCD34D" },
      Moderate: { bg: "rgba(96,165,250,0.15)",  color: "#93C5FD" },
      Low:      { bg: "rgba(52,211,153,0.15)",  color: "#6EE7B7" },
    };
    const c = map[risk];
    return (
      <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 700, background: c.bg, color: c.color }}>
        {risk}
      </span>
    );
  };

  return (
    <>
      {toast && <Toast msg={toast} />}

      {/* ── Earnings bottom sheet ───────────────────────────────────────── */}
      {showEarnings && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowEarnings(false)}
        >
          <div
            style={{ width: "100%", maxWidth: "440px", background: "linear-gradient(180deg,rgba(20,28,48,0.99) 0%,rgba(9,14,26,1) 100%)", borderRadius: "28px 28px 0 0", padding: "28px 24px calc(28px + env(safe-area-inset-bottom))", border: "1px solid rgba(255,255,255,0.08)", animation: "slideUpFade 0.3s ease both" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 20px" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: 700 }}>Update Earnings</h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Current: ₹{worker?.avg_daily_earnings ?? "—"}/day</p>
              </div>
              <button onClick={() => setShowEarnings(false)} style={{ width: 34, height: 34, borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <X size={16} color="var(--text-secondary)" />
              </button>
            </div>

            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.9px", color: "var(--text-secondary)", marginBottom: "10px" }}>
              New Daily Earnings (₹)
            </label>
            <input
              type="number" inputMode="numeric"
              value={earningsInput} onChange={e => setEarningsInput(e.target.value)}
              placeholder={`e.g. ${worker?.avg_daily_earnings ?? 600}`}
              style={{ width: "100%", padding: "16px", borderRadius: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-primary)", fontSize: "20px", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              autoFocus
            />
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "10px", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: "6px" }}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Affects your policy premium at next renewal.
            </p>

            <button
              onClick={handleSaveEarnings}
              disabled={saving || !earningsInput || parseFloat(earningsInput) <= 0}
              style={{ width: "100%", marginTop: "20px", padding: "16px", borderRadius: "16px", background: "linear-gradient(90deg,#6366F1,#22C55E)", color: "white", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", border: "none", cursor: "pointer", opacity: saving ? 0.7 : 1, transition: "opacity 0.2s" }}
            >
              {saving ? "Saving…" : "Save Declaration"}
            </button>
          </div>
        </div>
      )}

      {/* ── PAGE ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>

        {/* ── HERO CARD ────────────────────────────────────────────────────
            Full-bleed like Swiggy's profile top — avatar + name + tier badge
        ──────────────────────────────────────────────────────────────────── */}
        <div style={{ position: "relative", background: tierGradient(tier), overflow: "hidden", paddingBottom: "24px" }}>
          {/* Noise texture overlay */}
          <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\") repeat", opacity: 0.04, pointerEvents: "none" }} />

          {/* Top bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>My Profile</span>
            <button
              onClick={handleLogout}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 13px", borderRadius: "99px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" }}
            >
              <LogOut size={13} color="rgba(255,255,255,0.8)" />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>Sign out</span>
            </button>
          </div>

          {/* Avatar + name */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "28px", gap: "14px", position: "relative", zIndex: 1 }}>

            {/* Avatar circle */}
            <div style={{ position: "relative" }}>
              <div style={{
                width: "88px", height: "88px", borderRadius: "50%",
                background: "rgba(255,255,255,0.18)", backdropFilter: "blur(12px)",
                border: "3px solid rgba(255,255,255,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "30px", fontWeight: 800, color: "white", letterSpacing: "-1px",
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 6px ${tc}25`,
              }}>
                {initials(name)}
              </div>
              {/* Active dot */}
              <div style={{
                position: "absolute", bottom: "4px", right: "4px",
                width: "18px", height: "18px", borderRadius: "50%",
                background: "#22C55E", border: "3px solid rgba(0,0,0,0.5)",
                boxShadow: "0 0 10px #22C55E",
              }} />
            </div>

            {/* Name + phone */}
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>{name}</h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>{displayPh}</p>
            </div>

            {/* Tier + verified badges row */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{
                padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: 700,
                background: `${tc}30`, color: tc, border: `1px solid ${tc}55`,
                backdropFilter: "blur(8px)",
              }}>
                ⭐ Tier {tier} Member
              </span>
              {worker?.is_platform_verified && (
                <span style={{
                  padding: "6px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 700,
                  background: "rgba(52,211,153,0.2)", color: "#34D399", border: "1px solid rgba(52,211,153,0.35)",
                  display: "flex", alignItems: "center", gap: "5px",
                }}>
                  <BadgeCheck size={13} />
                  Verified
                </span>
              )}
            </div>

            {/* Quick stats strip */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: "1px", width: "100%", marginTop: "8px",
              background: "rgba(255,255,255,0.08)", borderTop: "1px solid rgba(255,255,255,0.1)",
            }}>
              {[
                { label: "Daily Earnings", value: `₹${worker?.avg_daily_earnings ?? "—"}` },
                { label: "Trust Score",    value: `${Math.round(ts)}` },
                { label: "Coverage",       value: policy ? `₹${policy.coverage_cap_daily}/day` : "—" },
              ].map((stat, i) => (
                <div key={stat.label} style={{
                  padding: "14px 0", display: "flex", flexDirection: "column", alignItems: "center",
                  background: i === 1 ? "rgba(255,255,255,0.06)" : "transparent",
                }}>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "white" }}>{stat.value}</span>
                  <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PADDING WRAPPER ──────────────────────────────────────────────── */}
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "20px" }}>

          {/* ── PROTECTION PLAN ─────────────────────────────────────────── */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "10px", paddingLeft: "4px" }}>
              Protection Plan
            </p>
            <SectionCard>
              {/* Status row */}
              <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "12px", background: "rgba(52,211,153,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ShieldCheck size={20} color="#34D399" />
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Active Protection</div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>Policy Week: {policyWeek}</div>
                  </div>
                </div>
                <span style={{
                  padding: "5px 11px", borderRadius: "99px", fontSize: "11px", fontWeight: 700,
                  background: policy?.status === "active" ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.12)",
                  color: policy?.status === "active" ? "#34D399" : "#94A3B8",
                  border: `1px solid ${policy?.status === "active" ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.3)"}`,
                }}>
                  {(policy?.status ?? "Pending").toUpperCase()}
                </span>
              </div>

              {/* Plan metrics */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", gap: "8px" }}>
                {[
                  { label: "Tier",     value: policy ? `Tier ${tier}` : "—", color: tc },
                  { label: "Premium",  value: policy ? `₹${policy.weekly_premium ?? policy.premium_amount ?? "—"}/wk` : "—", color: "var(--text-primary)" },
                  { label: "Coverage", value: policy ? `₹${policy.coverage_cap_daily}/day` : "—", color: "#34D399" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "3px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* How it works pill */}
              <div style={{ margin: "0 16px 14px", padding: "10px 14px", borderRadius: "12px", background: "rgba(103,232,249,0.06)", border: "1px solid rgba(103,232,249,0.15)" }}>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                  <span style={{ color: "#67E8F9", fontWeight: 700 }}>How it works: </span>
                  Payouts are fully automatic — no claim needed. If DCI in your zone crosses 0.85, coverage triggers instantly.
                </p>
                <p style={{ fontSize: "12px", color: "#34D399", fontWeight: 600, marginTop: "6px" }}>✔ Zero-click payouts · Sent to {worker?.upi_id ?? "your UPI"}</p>
              </div>

              {/* Zone / Claim risk row */}
              {policy?.tier_explanation && (
                <div style={{ display: "flex", gap: "10px", padding: "0 16px 14px" }}>
                  <div style={{ flex: 1, padding: "10px 12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Zone Risk</div>
                    {riskChip(zoneRisk)}
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>DCI avg: {policy.tier_explanation.avg_dci_4w}</div>
                  </div>
                  <div style={{ flex: 1, padding: "10px 12px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>Claim History</div>
                    {riskChip(claimRisk)}
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "4px" }}>Last 28 days</div>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── TRUST SCORE ─────────────────────────────────────────────── */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "10px", paddingLeft: "4px" }}>
              Trust Score
            </p>
            <SectionCard>
              <div style={{ padding: "20px 16px", display: "flex", gap: "20px", alignItems: "center" }}>

                {/* Ring */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <svg width="88" height="88" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="44" cy="44" r="38" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
                    <circle cx="44" cy="44" r="38" stroke={tColor} strokeWidth="8" fill="none"
                      strokeDasharray={circum} strokeDashoffset={circum - (circum * ts) / 100}
                      strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "20px", fontWeight: 900, color: tColor, lineHeight: 1 }}>{Math.round(ts)}</span>
                    <span style={{ fontSize: "9px", color: "var(--text-secondary)", marginTop: "2px" }}>/ 100</span>
                  </div>
                </div>

                {/* Label */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>
                    {ts >= 85 ? "Excellent" : ts >= 65 ? "Good Standing" : "Fair"}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px", lineHeight: 1.5 }}>
                    {trustLabel(ts)}
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                    {worker?.trust_breakdown?.factors && (
                      <>
                        <span style={{ padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, background: "rgba(52,211,153,0.12)", color: "#6EE7B7", border: "1px solid rgba(52,211,153,0.25)" }}>
                          ✓ {worker.trust_breakdown.factors.paid_claims} paid
                        </span>
                        <span style={{ padding: "3px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, background: "rgba(248,113,113,0.1)", color: "#FCA5A5", border: "1px solid rgba(248,113,113,0.25)" }}>
                          ✕ {worker.trust_breakdown.factors.denied_claims} denied
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Formula breakdown */}
              {formulaRows.length > 0 && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {formulaRows.map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{row.label}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: row.tone === "pos" ? "#22C55E" : row.tone === "neg" ? "#EF4444" : "#E2E8F0" }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Total Score</span>
                    <span style={{ fontSize: "18px", fontWeight: 900, color: tColor }}>{ts.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── ACCOUNT INFO ─────────────────────────────────────────────── */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "10px", paddingLeft: "4px" }}>
              Account Details
            </p>
            <SectionCard>
              <Cell iconBg="rgba(96,165,250,0.12)"  icon={<MapPin size={18} color="#60A5FA" />}    label={worker?.dark_store_zone ?? "—"} sub={worker?.city ?? "—"} />
              <Cell iconBg="rgba(167,139,250,0.12)" icon={<Smartphone size={18} color="#A78BFA" />} label="Device" sub={worker?.device_model ?? "Unknown device"} />
              <Cell iconBg="rgba(251,191,36,0.12)"  icon={<CreditCard size={18} color="#FBBF24" />} label="UPI ID" sub={worker?.upi_id ?? "Not set"} />
              <Cell iconBg="rgba(52,211,153,0.12)"  icon={<UserCheck size={18} color="#34D399" />}  label={worker?.platform_affiliation ?? "Platform"}
                right={
                  <span style={{
                    padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700,
                    background: worker?.is_platform_verified ? "rgba(52,211,153,0.12)" : "rgba(148,163,184,0.12)",
                    color: worker?.is_platform_verified ? "#34D399" : "#94A3B8",
                    border: `1px solid ${worker?.is_platform_verified ? "rgba(52,211,153,0.3)" : "rgba(148,163,184,0.3)"}`,
                  }}>
                    {worker?.is_platform_verified ? "Verified" : "Not verified"}
                  </span>
                }
              />
            </SectionCard>
          </div>

          {/* ── DOCUMENTS ───────────────────────────────────────────────── */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "10px", paddingLeft: "4px" }}>
              {t(language, "documents")}
            </p>
            <SectionCard>
              <Cell
                iconBg="rgba(59,130,246,0.12)" icon={<Download size={18} color="#60A5FA" />}
                label={t(language, "download_tier_policy")} sub={certFile}
                onClick={() => {
                  if (!certUrl) { showToast("Certificate not yet assigned."); return; }
                  window.open(certUrl, "_blank", "noopener,noreferrer");
                }}
              />
            </SectionCard>
          </div>

          {/* ── SETTINGS ────────────────────────────────────────────────── */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "10px", paddingLeft: "4px" }}>
              {t(language, "account_settings")}
            </p>
            <SectionCard>
              <Cell
                iconBg="rgba(52,211,153,0.12)" icon={<TrendingUp size={18} color="#34D399" />}
                label={t(language, "update_earnings_declaration")}
                sub={`Currently ₹${worker?.avg_daily_earnings ?? "—"}/day`}
                onClick={() => { setEarningsInput(""); setShowEarnings(true); }}
              />
              <Cell
                iconBg="rgba(96,165,250,0.12)" icon={<Bell size={18} color="#60A5FA" />}
                label={t(language, "notification_preferences")}
                onClick={() => showToast("Notification preferences coming soon")}
              />
              <Cell
                iconBg="rgba(168,85,247,0.12)" icon={<Star size={18} color="#A855F7" />}
                label="Rate GigHood"
                onClick={() => showToast("Thanks! Rating coming soon 🌟")}
              />
              <Cell
                iconBg="rgba(239,68,68,0.1)" icon={<LogOut size={18} color="#F87171" />}
                label={t(language, "sign_out")}
                redLabel onClick={handleLogout}
              />
            </SectionCard>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.7, opacity: 0.6, paddingBottom: "8px" }}>
            GigHood v1.0 · Secured by AI risk monitoring<br />
            Member since {fmtDate(policy?.created_at)}
          </p>

        </div>
      </div>
    </>
  );
}
