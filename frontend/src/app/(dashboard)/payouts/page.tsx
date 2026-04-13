"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CloudLightning,
  Car,
  Smartphone,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Umbrella,
  ArrowRight,
  ShieldAlert,
  Wallet,
  Clock,
  CheckCircle2,
  Receipt,
  Download,
  Info
} from "lucide-react";
import { workerApi, type Claim } from "@/lib/worker";
import { useLanguageStore } from "@/store/languageStore";
import { t } from "@/lib/i18n";
import { motion } from "framer-motion";

// ── Helpers ────────────────────────────────────────────────

function resolutionLabel(path: string): string {
  switch (path) {
    case "fast_track": return "Fast Track";
    case "soft_queue": return "Soft Queue";
    case "active_verify": return "Active Verify";
    case "denied": return "Denied";
    default: return path;
  }
}

function resolutionColor(path: string): string {
  switch (path) {
    case "fast_track": return "#10B981"; // Emerald
    case "soft_queue": return "#3B82F6"; // Blue
    case "active_verify": return "#F59E0B"; // Amber
    case "denied": return "#EF4444"; // Red
    default: return "#94A3B8";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "paid": return "#10B981";
    case "processing": return "#F59E0B";
    case "approved": return "#10B981";
    case "denied": return "#EF4444";
    default: return "#94A3B8";
  }
}

function disruptionIcon(claim: Claim) {
  if (claim.resolution_path === "denied") return <XCircle size={20} color="#EF4444" />;
  if (claim.disrupted_hours > 3) return <CloudLightning size={20} color="#3B82F6" />;
  if (claim.disrupted_hours > 1.5) return <Car size={20} color="#F59E0B" />;
  return <Smartphone size={20} color="#8B5CF6" />;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Component ──────────────────────────────────────────────

export default function PayoutsPage() {
  const language = useLanguageStore((s) => s.language);
  const { data: claims, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["claims"],
    queryFn: workerApi.getClaims,
    staleTime: 30000,
  });

  // ── Summary stats ──
  const paidClaims = claims?.filter((c) => c.status === "paid" || c.status === "approved") ?? [];
  const totalPaidOut = paidClaims.reduce((s, c) => s + (c.payout_amount ?? 0), 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const thisWeek = paidClaims
    .filter((c) => new Date(c.created_at) >= weekStart)
    .reduce((s, c) => s + (c.payout_amount ?? 0), 0);

  const pendingClaims = claims?.filter((c) => c.status === "pending") ?? [];
  const totalPending = pendingClaims.reduce((s, c) => s + (c.payout_amount ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", paddingBottom: "100px" }}>
      
      {/* ── STICKY HEADER ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(2, 6, 23, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "white", letterSpacing: "-0.5px" }}>
            {t(language, "payouts_title")}
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500, marginTop: "2px" }}>
            {t(language, "claim_settlements")}
          </p>
        </div>
        <button
          onClick={() => { navigator.vibrate?.(10); refetch(); }}
          disabled={isFetching}
          style={{
            width: "38px", height: "38px", borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: isFetching ? 0.6 : 1, transition: "all 0.2s"
          }}
        >
          <RefreshCw size={16} color="white" style={{ animation: isFetching ? "spin 1s linear infinite" : "none" }} />
        </button>
      </header>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* ── HERO STATS CARD ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: "24px",
            padding: "24px",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Ambient Glows */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 120, height: 120, background: "#10B981", filter: "blur(60px)", opacity: 0.15, borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 100, height: 100, background: "#3B82F6", filter: "blur(50px)", opacity: 0.1, borderRadius: "50%" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <div style={{ width: 28, height: 28, borderRadius: "8px", background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Wallet size={16} color="#10B981" />
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.5px", textTransform: "uppercase" }}>Total Earnings Settled</span>
            </div>
            
            <div style={{ fontSize: "42px", fontWeight: 800, color: "white", letterSpacing: "-1px", lineHeight: 1 }}>
              ₹{totalPaidOut.toLocaleString("en-IN")}
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={14} color="#10B981" /> Directly credited to your UPI via Razorpay
            </p>

            <div style={{ padding: "16px", background: "rgba(0,0,0,0.2)", borderRadius: "16px", marginTop: "24px", display: "flex", justifyContent: "space-between", border: "1px solid rgba(255,255,255,0.03)" }}>
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "4px" }}>THIS WEEK</p>
                <p style={{ fontSize: "18px", fontWeight: 700, color: "white" }}>₹{thisWeek.toLocaleString("en-IN")}</p>
              </div>
              <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }} />
              <div>
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500, marginBottom: "4px" }}>PENDING</p>
                <p style={{ fontSize: "18px", fontWeight: 700, color: "#F59E0B" }}>₹{totalPending.toLocaleString("en-IN")}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── TRANSACTION HISTORY ── */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>
              Recent Settlements
            </h3>
            <button style={{ fontSize: "12px", color: "#60A5FA", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <Receipt size={14} /> Download Statement
            </button>
          </div>

          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ padding: "16px", borderRadius: "20px", background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="skeleton" style={{ height: "14px", width: "40%", marginBottom: "12px", borderRadius: "10px" }} />
                  <div className="skeleton" style={{ height: "24px", width: "60%", marginBottom: "8px", borderRadius: "10px" }} />
                  <div className="skeleton" style={{ height: "12px", width: "30%", borderRadius: "10px" }} />
                </div>
              ))}
            </div>
          ) : !claims || claims.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                padding: "40px 24px", borderRadius: "24px", background: "rgba(30, 41, 59, 0.4)",
                border: "1px solid rgba(255,255,255,0.05)", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center"
              }}
            >
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(59, 130, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <Umbrella size={28} color="#60A5FA" />
              </div>
              <h4 style={{ fontSize: "17px", fontWeight: 700, color: "white", marginBottom: "6px" }}>You&apos;re fully protected</h4>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5, maxWidth: "240px" }}>No disruptions detected yet. Fast-track payouts will appear here automatically.</p>
            </motion.div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {claims.map((claim, index) => {
                const disruptedHours = Number.isFinite(claim.disrupted_hours as number) ? Number(claim.disrupted_hours) : 0;
                const payoutAmount = Number.isFinite(claim.payout_amount as number) ? Number(claim.payout_amount) : 0;
                const hasResolvedAmount = typeof claim.payout_amount === "number" && Number.isFinite(claim.payout_amount);
                const amtColor = statusColor(claim.status);
                const isDenied = claim.status === "denied";

                return (
                  <motion.div
                    key={claim.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      background: "rgba(30, 41, 59, 0.5)",
                      backdropFilter: "blur(12px)",
                      borderRadius: "20px",
                      border: "1px solid rgba(255,255,255,0.06)",
                      overflow: "hidden",
                    }}
                  >
                    {/* Main Content */}
                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <div style={{ 
                            width: "44px", height: "44px", borderRadius: "14px", 
                            background: isDenied ? "rgba(239, 68, 68, 0.1)" : "rgba(255,255,255,0.05)", 
                            border: isDenied ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(255,255,255,0.08)",
                            display: "flex", alignItems: "center", justifyContent: "center" 
                          }}>
                            {disruptionIcon(claim)}
                          </div>
                          <div>
                            <p style={{ fontSize: "15px", fontWeight: 700, color: "white", marginBottom: "2px" }}>
                              {claim.disrupted_hours > 0 ? `${disruptedHours.toFixed(1)}h Disruption` : "Weather Delay"}
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "6px" }}>
                              {formatDate(claim.created_at)} • {formatTime(claim.created_at)}
                            </p>
                          </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "18px", fontWeight: 800, color: isDenied ? "var(--text-secondary)" : "white", letterSpacing: "-0.5px", textDecoration: isDenied ? "line-through" : "none" }}>
                            {claim.status === "pending" && !hasResolvedAmount ? "TBD" : `₹${payoutAmount.toLocaleString("en-IN")}`}
                          </div>
                          <span style={{ 
                            display: "inline-block", padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, marginTop: "4px",
                            background: `${amtColor}15`, color: amtColor, border: `1px solid ${amtColor}30`, textTransform: "uppercase", letterSpacing: "0.5px"
                          }}>
                            {claim.status}
                          </span>
                        </div>
                      </div>

                      {/* AI Decision & Status Indicators */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ 
                          padding: "6px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
                          background: `${resolutionColor(claim.resolution_path)}15`, 
                          color: resolutionColor(claim.resolution_path), 
                          border: `1px solid ${resolutionColor(claim.resolution_path)}30`
                        }}>
                          {claim.resolution_path === "fast_track" ? <CloudLightning size={12} /> : <ShieldAlert size={12} />}
                          {resolutionLabel(claim.resolution_path)}
                        </span>

                        {claim.fraud_score > 0 && (
                          <span style={{ 
                            padding: "6px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
                            background: "rgba(245, 158, 11, 0.1)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.25)"
                          }}>
                            <AlertTriangle size={12} /> Score {Math.min(100, Math.max(0, claim.fraud_score)).toFixed(0)}/100
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expandable Meta Section (Razorpay / Explainability) */}
                    {(claim.decision_explanation || claim.razorpay_payment_id) && (
                      <div style={{ background: "rgba(0,0,0,0.2)", padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        {claim.decision_explanation && (
                          <div style={{ marginBottom: claim.razorpay_payment_id ? "12px" : "0" }}>
                            <p style={{ fontSize: "12px", color: "white", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                              <Info size={14} color="#60A5FA" /> AI Decision context
                            </p>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5, paddingLeft: "20px" }}>
                              {claim.decision_explanation.message}
                            </p>
                            {claim.decision_explanation.worker_tip && (
                              <p style={{ fontSize: "11px", color: "#93C5FD", marginTop: "6px", paddingLeft: "20px" }}>
                                💡 Tip: {claim.decision_explanation.worker_tip}
                              </p>
                            )}
                          </div>
                        )}

                        {claim.razorpay_payment_id && (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "20px" }}>
                            <p style={{ fontSize: "11px", color: "var(--text-secondary)", fontFamily: "monospace" }}>
                              Ref: {claim.razorpay_payment_id}
                            </p>
                            {claim.status === "paid" && (
                              <p style={{ fontSize: "11px", color: "#10B981", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                                <CheckCircle2 size={12} /> Credited
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
