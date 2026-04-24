"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { workerApi, simulateDisruption, processClaim } from "@/lib/worker";
import { useAuthStore } from "@/store/authStore";
import { LANGUAGE_OPTIONS, useLanguageStore } from "@/store/languageStore";
import { useTranslation } from "react-i18next";
import "@/i18n";
import {
  checkLocationPermission,
  requestLocationPermission,
  submitLocationPing,
} from "@/lib/location";
import dynamic from 'next/dynamic';
import useGeolocation from '@/hooks/useGeolocation';

// Lazy load map (important for performance)
const SafetyRadar = dynamic(() => import('@/components/SafetyRadar'), {
  ssr: false,
});

interface ClaimReceipt {
  claim_id: string;
  fraud_score: number;
  resolution_path: string;
  payout_amount: number | null;
  status: string;
  razorpay_payment_id: string;
  payout_transaction_id?: string;
  payout_channel?: string;
  pop_validated: boolean;
  gate2_result: string;
  fraud_flags: string[];
  decision_explanation?: {
    code: string;
    title: string;
    message: string;
    worker_tip: string;
  };
}

function SmsToast({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "14px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1200,
        background: "rgba(2, 6, 23, 0.96)",
        border: "1px solid rgba(56, 189, 248, 0.4)",
        color: "var(--text-primary)",
        borderRadius: "12px",
        padding: "12px 14px",
        fontSize: "13px",
        fontWeight: 600,
        boxShadow: "0 12px 28px rgba(0, 0, 0, 0.45)",
        maxWidth: "min(92vw, 720px)",
        animation: "slideUpFade 0.25s ease both",
      }}
    >
      {message}
    </div>
  );
}

// ─── Skeleton Loading UI ────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div
      style={{
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton-block {
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%);
          background-size: 800px 100%;
          animation: shimmer 1.6s infinite linear;
          border-radius: 12px;
        }
      `}</style>

      {/* Header skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div
          className="skeleton-block"
          style={{ height: "28px", width: "180px" }}
        />
        <div
          className="skeleton-block"
          style={{ height: "16px", width: "120px" }}
        />
      </div>

      {/* Language selector skeleton */}
      <div
        className="skeleton-block"
        style={{ height: "56px", borderRadius: "14px" }}
      />

      {/* Status card skeleton */}
      <div
        className="skeleton-block"
        style={{ height: "72px", borderRadius: "16px" }}
      />

      {/* DCI gauge skeleton */}
      <div
        className="skeleton-block"
        style={{ height: "220px", borderRadius: "20px" }}
      />

      {/* Protected today skeleton */}
      <div
        className="skeleton-block"
        style={{ height: "72px", borderRadius: "16px" }}
      />

      {/* Earnings grid skeleton */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div
          className="skeleton-block"
          style={{ height: "80px", borderRadius: "14px" }}
        />
        <div
          className="skeleton-block"
          style={{ height: "80px", borderRadius: "14px" }}
        />
      </div>

      {/* Action button skeleton */}
      <div
        className="skeleton-block"
        style={{ height: "52px", borderRadius: "12px" }}
      />

      {/* Summary grid skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "10px",
        }}
      >
        <div
          className="skeleton-block"
          style={{ height: "68px", borderRadius: "12px" }}
        />
        <div
          className="skeleton-block"
          style={{ height: "68px", borderRadius: "12px" }}
        />
        <div
          className="skeleton-block"
          style={{ height: "68px", borderRadius: "12px" }}
        />
      </div>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    const msg = String((error as { message: string }).message).trim();
    if (msg.length > 0) {
      return msg;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getResolutionPathColor(path: string): string {
  const normalized = (path || "").toLowerCase();
  if (normalized.includes("fast_track")) return "#10B981";
  if (normalized.includes("soft_queue")) return "#F59E0B";
  if (normalized.includes("active_verify")) return "#3B82F6";
  if (normalized.includes("denied")) return "#EF4444";
  return "#94A3B8";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { coords } = useGeolocation(true);
  const queryClient = useQueryClient();
  const router = useRouter();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const isLanguageHydrated = useLanguageStore((s) => s.isHydrated);
  const inferLanguageFromCity = useLanguageStore(
    (s) => s.inferLanguageFromCity,
  );

  // Load worker profile
  const {
    data: worker,
    refetch: refetchWorker,
    isPending: isWorkerPending,
    error: workerError,
  } = useQuery({
    queryKey: ["worker"],
    queryFn: workerApi.getMe,
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Load policy independently
  const {
    data: activePolicy,
    refetch: refetchPolicy,
    isPending: isPolicyPending,
    error: policyError,
  } = useQuery({
    queryKey: ["policy"],
    queryFn: workerApi.getMyPolicy,
    staleTime: 5 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Load DCI independently (refresh more often)
  const { data: dciData, refetch: refetchDci, isPending: isDciPending } = useQuery({
    queryKey: ["dci"],
    queryFn: workerApi.getDci,
    staleTime: 60 * 1000,
    refetchInterval: accessToken ? 45 * 1000 : false,
    retry: 2,
    retryDelay: (attempt) => Math.min(1200 * 2 ** attempt, 5000),
    enabled: !!accessToken,
  });

  // Load claims independently
  const { data: claims = [], refetch: refetchClaims } = useQuery({
    queryKey: ["claims"],
    queryFn: workerApi.getClaims,
    staleTime: 3 * 60 * 1000,
    enabled: !!accessToken,
  });

  // Composite dashboard for backward compatibility
  const dashboard = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    return worker && activePolicy
      ? {
          worker: {
            ...worker,
            dynamic_coverage_index: dciData?.current_dci ?? null,
          },
          active_policy: activePolicy,
          alerts: [],
          weekly_summary: {
            premium_paid:
              activePolicy?.weekly_premium || activePolicy?.premium_amount || 0,
            disruptions: claims.filter(
              (c) =>
                new Date(c.created_at) >=
                new Date(now - 7 * 24 * 60 * 60 * 1000),
            ).length,
            total_paid_out: claims
              .filter((c) => c.status === "paid")
              .reduce((sum, c) => sum + (c.payout_amount ?? 0), 0),
          },
          dci_forecast: null,
        }
      : null;
  }, [worker, activePolicy, dciData?.current_dci, claims]);

  const isLoading =
    isWorkerPending || isPolicyPending || !worker || !activePolicy;
  const error: unknown = workerError || policyError || null;
  const refetch = useCallback(async () => {
    await Promise.allSettled([
      refetchWorker(),
      refetchPolicy(),
      refetchDci(),
      refetchClaims(),
    ]);
  }, [refetchWorker, refetchPolicy, refetchDci, refetchClaims]);

  // Phase 2 & 3 State
  const [isSimulating, setIsSimulating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [claimReceipt, setClaimReceipt] = useState<ClaimReceipt | null>(null);
  const [dciScore, setDciScore] = useState<number | null>(null);
  const [dciStatus, setDciStatus] = useState<
    "normal" | "elevated" | "disrupted" | "degraded"
  >("degraded");
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [smsToast, setSmsToast] = useState<string | null>(null);
  const coverageCarouselRef = useRef<HTMLDivElement | null>(null);

  // Initialize DCI/status from live DCI query payload.
  useEffect(() => {
    const rawDci = dciData?.current_dci;
    const nextDci =
      typeof rawDci === "number" && Number.isFinite(rawDci) ? rawDci : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDciScore(nextDci);

    if (nextDci === null) {
      setDciStatus("degraded");
      return;
    }

    if (dciData?.dci_status) {
      setDciStatus(dciData.dci_status);
      return;
    }

    if (nextDci > 0.85) {
      setDciStatus("disrupted");
    } else if (nextDci >= 0.5) {
      setDciStatus("elevated");
    } else {
      setDciStatus("normal");
    }
  }, [dciData?.current_dci, dciData?.dci_status]);

  useEffect(() => {
    if (!isLanguageHydrated) {
      return;
    }
    if (!dashboard?.worker?.city) {
      return;
    }
    inferLanguageFromCity(dashboard.worker.city);
  }, [dashboard?.worker?.city, inferLanguageFromCity, isLanguageHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!accessToken) {
      router.replace("/");
    }
  }, [hasHydrated, accessToken, router]);

  // Phase 2: Simulate Disruption
  const handleSimulateDisruption = useCallback(async () => {
    setIsSimulating(true);
    setSimulationError(null);

    try {
      const jitter = (base: number, spread: number) => {
        const next = base + (Math.random() * 2 - 1) * spread;
        return Math.max(0, Number(next.toFixed(3)));
      };

      const result = await simulateDisruption({
        w: jitter(2.9, 0.35),
        t: jitter(1.45, 0.25),
        p: jitter(1.95, 0.3),
        s: jitter(1.1, 0.2),
      });

      if (result) {
        setDciScore(result.current_dci);
        setDciStatus(result.dci_status);
        queryClient.setQueryData(["dci"], {
          ...(dciData ?? {}),
          current_dci: result.current_dci,
          dci_status: result.dci_status,
        });
      }

      if (result && result.dci_status !== "disrupted") {
        setSimulationError(
          `Simulation completed (DCI: ${result.current_dci.toFixed(3)}, Status: ${result.dci_status}). Raise signals to cross disruption threshold.`,
        );
      }

      await Promise.allSettled([
        refetchWorker(),
        refetchPolicy(),
        refetchClaims(),
      ]);
    } catch (err: unknown) {
      console.error("Simulation error:", err);
      setSimulationError(
        getErrorMessage(err, "Simulation failed. Please try again."),
      );
    } finally {
      setIsSimulating(false);
    }
  }, [queryClient, dciData, refetchWorker, refetchPolicy, refetchClaims]);

  // Phase 3: Process Claim
  const handleProcessClaim = useCallback(async () => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const currentPermission = await checkLocationPermission();
      let hasLocationPermission = currentPermission === "granted";

      if (!hasLocationPermission) {
        hasLocationPermission = await requestLocationPermission();
      }

      if (!hasLocationPermission) {
        setProcessingError(
          "Location permission is required for claim eligibility.",
        );
        setIsProcessing(false);
        return;
      }

      let successfulPings = 0;
      let lastPingError: unknown = null;
      for (let i = 0; i < 3; i += 1) {
        try {
          await submitLocationPing();
          successfulPings += 1;
        } catch (pingError: unknown) {
          lastPingError = pingError;
        }

        if (i < 2) {
          await wait(1200);
        }
      }

      if (successfulPings === 0) {
        const pingHint = getErrorMessage(
          lastPingError,
          "Could not capture your latest location. Continuing with recent location history.",
        );
        setSmsToast(pingHint);
        setTimeout(() => setSmsToast(null), 4000);
      }

      const receipt = await processClaim();
      setClaimReceipt(receipt as ClaimReceipt);

      const channel = (
        (receipt as ClaimReceipt).payout_channel || "UPI"
      ).toUpperCase();
      const phone = dashboard?.worker?.phone || "";
      const normalizedPhone = phone.startsWith("+91") ? phone : `+91 ${phone}`;
      const payoutAmountRaw = (receipt as ClaimReceipt).payout_amount;
      const payoutAmount: number =
        typeof payoutAmountRaw === "number" && Number.isFinite(payoutAmountRaw)
          ? payoutAmountRaw
          : 0;
      if ((receipt as ClaimReceipt).status === "paid") {
        setSmsToast(
          `SMS sent to ${normalizedPhone}: ₹${payoutAmount.toLocaleString("en-IN")} credited via ${channel}.`,
        );
      } else {
        setSmsToast(
          `Claim updated for ${normalizedPhone}: status is ${(receipt as ClaimReceipt).status.toUpperCase()}.`,
        );
      }
      setTimeout(() => setSmsToast(null), 5000);
    } catch (err: unknown) {
      console.error("Claim processing error:", err);
      setProcessingError(
        getErrorMessage(err, "Claim processing failed. Please try again."),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [dashboard]);

  if (!hasHydrated) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          minHeight: "calc(100dvh - 84px)",
          width: "100%",
        }}
      >
        <div
          className="spinner"
          style={{ width: "40px", height: "40px", borderWidth: "3px" }}
        />
        <p className="text-muted" style={{ fontWeight: 500 }}>
          {t("home.initializing")}
        </p>
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          minHeight: "calc(100dvh - 84px)",
          width: "100%",
        }}
      >
        <div
          className="spinner"
          style={{ width: "40px", height: "40px", borderWidth: "3px" }}
        />
        <p className="text-muted" style={{ fontWeight: 500 }}>
          {t("home.redirecting_login")}
        </p>
      </div>
    );
  }

  // ─── Skeleton Loading (replaces spinner) ──────────────────────────────────
  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !dashboard) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "24px",
        }}
      >
        <AlertCircle size={48} color="#EF4444" />
        <p
          className="text-muted"
          style={{ fontWeight: 500, textAlign: "center" }}
        >
          {t("home.failed_load")}
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-secondary)",
            textAlign: "center",
            marginBottom: "16px",
          }}
        >
          {getErrorMessage(error, "Please check your connection and try again")}
        </p>
        <button
          onClick={() => refetch()}
          style={{
            padding: "10px 20px",
            background: "var(--accent-primary)",
            color: "var(--text-primary)",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {t("home.retry")}
        </button>
      </div>
    );
  }

  const firstName = (worker?.name || "").split(" ")[0] || "Worker";

  // DCI status derivation
  const hasDci = typeof dciScore === "number" && Number.isFinite(dciScore);
  const normalizedDci = hasDci ? dciScore : 0;
  const isNormal = hasDci ? normalizedDci <= 0.65 : dciStatus === "normal";
  const isElevated = hasDci
    ? normalizedDci > 0.65 && normalizedDci <= 0.85
    : dciStatus === "elevated";
  const isDisrupted = hasDci
    ? normalizedDci > 0.85
    : dciStatus === "disrupted";

  const statusColor = !hasDci
    ? "#94A3B8"
    : isNormal
      ? "var(--dci-normal)"
      : isElevated
        ? "var(--dci-elevated)"
        : "var(--dci-disrupted)";
  const statusBg = !hasDci
    ? "rgba(148, 163, 184, 0.12)"
    : isNormal
      ? "var(--dci-normal-bg)"
      : isElevated
        ? "var(--dci-elevated-bg)"
        : "var(--dci-disrupted-bg)";
  const statusLabel = !hasDci
    ? isDciPending
      ? t("home.status_syncing")
      : t("home.status_degraded")
    : isNormal
      ? t("home.status_safe")
      : isElevated
        ? t("home.status_warning")
        : t("home.status_disrupted");

  // ─── Emotionally resonant DCI text ────────────────────────────────────────
  const dciText = !hasDci
    ? isDciPending
      ? t("home.dci_desc_syncing")
      : t("home.dci_desc_degraded")
    : isNormal
      ? t("home.dci_desc_safe")
      : isElevated
        ? t("home.dci_desc_warning")
        : t("home.dci_desc_disrupted");

  const lastUpdated = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const radius = 60;
  const strokeWidth = 12;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - circumference * normalizedDci;

  // Format dates
  const startStr =
    dashboard?.active_policy?.week_start ||
    dashboard?.active_policy?.start_date;
  const endStr =
    dashboard?.active_policy?.week_end || dashboard?.active_policy?.end_date;
  const start = startStr ? new Date(startStr) : null;
  const end = endStr ? new Date(endStr) : null;
  const dateOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const policyWeek =
    start && end
      ? `${start.toLocaleDateString("en-US", dateOptions)} - ${end.toLocaleDateString("en-US", dateOptions)}`
      : "—";

  const coverageBadges = [
    { id: "heavy_rainfall", label: t("home.coverage_heavy_rainfall"), icon: "🌧️" },
    { id: "hazardous_aqi", label: t("home.coverage_hazardous_aqi"), icon: "🌫️" },
    { id: "traffic_gridlock", label: t("home.coverage_traffic_gridlock"), icon: "🚧" },
    { id: "platform_outage", label: t("home.coverage_platform_outage"), icon: "📉" },
  ];

  const shiftCoverage = (direction: "left" | "right") => {
    const node = coverageCarouselRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction === "left" ? -160 : 160,
      behavior: "smooth",
    });
  };

  // ===== RECEIPT VIEW =====
  if (claimReceipt) {
    const payoutSuccess = claimReceipt.status === "paid";
    const receiptTitle = payoutSuccess
      ? t("home.receipt_success")
      : claimReceipt.status === "denied"
        ? t("home.receipt_denied")
        : t("home.receipt_review");
    const receiptSubtitle = payoutSuccess
      ? t("home.receipt_success_desc")
      : claimReceipt.status === "denied"
        ? t("home.receipt_denied_desc")
        : t("home.receipt_review_desc");
    const receiptAccent = payoutSuccess
      ? "#10B981"
      : claimReceipt.status === "denied"
        ? "#EF4444"
        : "#F59E0B";

    return (
      <div
        style={{
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "28px",
          minHeight: "100vh",
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: "32px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "400px" }} className="stagger-1">
          <div
            className="glass-card"
            style={{
              padding: "32px 24px",
              textAlign: "center",
              background: payoutSuccess
                ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)"
                : claimReceipt.status === "denied"
                  ? "linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(127, 29, 29, 0.06) 100%)"
                  : "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(120, 53, 15, 0.06) 100%)",
              border: `1px solid ${receiptAccent}55`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  animation: "pulse 2s infinite",
                }}
              >
                <CheckCircle size={48} color={receiptAccent} />
              </div>
            </div>

            <h1
              style={{
                fontSize: "28px",
                fontWeight: 700,
                color: receiptAccent,
                marginBottom: "8px",
              }}
            >
              {receiptTitle}
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "var(--text-secondary)",
                marginBottom: "32px",
              }}
            >
              {receiptSubtitle}
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.claim_id")}
                </p>
                <p
                  style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                    color: "var(--text-primary)",
                    wordBreak: "break-all",
                  }}
                >
                  {claimReceipt.claim_id}
                </p>
              </div>

              <div
                style={{
                  padding: "20px",
                  background:
                    "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)",
                  borderRadius: "12px",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.payout_amount")}
                </p>
                <p
                  style={{
                    fontSize: "32px",
                    fontWeight: 800,
                    color: "#10B981",
                  }}
                >
                  {typeof claimReceipt.payout_amount === "number" &&
                  Number.isFinite(claimReceipt.payout_amount)
                    ? `₹${claimReceipt.payout_amount.toLocaleString("en-IN")}`
                    : "TBD"}
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.fraud_score")}
                </p>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color:
                      claimReceipt.fraud_score === 0 ? "#10B981" : "#F59E0B",
                  }}
                >
                  {claimReceipt.fraud_score.toFixed(0)}/100{" "}
                  {claimReceipt.fraud_score === 0 ? t("home.clean") : t("home.review")}
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.processing_track")}
                </p>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: getResolutionPathColor(claimReceipt.resolution_path),
                    textTransform: "capitalize",
                  }}
                >
                  {t(`payouts.resolution_${claimReceipt.resolution_path.replace("_queue", "soft").replace("_track", "fast").replace("_verify", "verify")}`, claimReceipt.resolution_path.replace("_", " "))}
                </p>
              </div>

              {claimReceipt.decision_explanation && (
                <div
                  style={{
                    padding: "16px",
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "12px",
                  }}
                >
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--text-secondary)",
                      marginBottom: "4px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {t("home.why_happened")}
                  </p>
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      marginBottom: "6px",
                    }}
                  >
                    {claimReceipt.decision_explanation.title}
                  </p>
                  <p
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {claimReceipt.decision_explanation.message}
                  </p>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#93C5FD",
                      lineHeight: 1.5,
                      marginTop: "6px",
                    }}
                  >
                    {t("home.tip", { tip: claimReceipt.decision_explanation.worker_tip })}
                  </p>
                </div>
              )}

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.payment_id")}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: "#94A3B8",
                    wordBreak: "break-all",
                  }}
                >
                  {claimReceipt.razorpay_payment_id}
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "12px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "4px",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  {t("home.proof_of_presence")}
                </p>
                <p
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: claimReceipt.pop_validated ? "#10B981" : "#EF4444",
                  }}
                >
                  {claimReceipt.pop_validated ? t("home.validated") : t("home.failed")}
                </p>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: "12px", flexDirection: "column" }}
            >
              <button
                onClick={() => {
                  setClaimReceipt(null);
                  router.push("/worker-app/home");
                }}
                className="btn-premium"
                style={{
                  width: "100%",
                  padding: "14px",
                  background:
                    "linear-gradient(90deg, #10B981 0%, #059669 100%)",
                  fontSize: "16px",
                  transition: "all 0.2s ease",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {t("home.back_dashboard")}
              </button>
              <button
                onClick={() => router.push("/worker-app/payouts")}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "rgba(16, 185, 129, 0.1)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: "8px",
                  color: "#10B981",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s ease",
                }}
                onMouseDown={(e) =>
                  (e.currentTarget.style.transform = "scale(0.97)")
                }
                onMouseUp={(e) =>
                  (e.currentTarget.style.transform = "scale(1)")
                }
              >
                {t("home.view_all_payouts")}
              </button>
            </div>

            <p
              style={{
                fontSize: "12px",
                color: "var(--text-secondary)",
                marginTop: "20px",
              }}
            >
              {t("home.receipt_generated", {
                date: new Date().toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN", {
                  weekday: "short",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              })}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== MAIN DASHBOARD VIEW =====
  return (
    <>
      {smsToast && <SmsToast message={smsToast} />}

      {/* Processing overlay */}
      {isProcessing && (
        <div style={{ position: "fixed", top: "50%", left: "50%", width: "100vw", height: "100vh", transform: "translate(-50%, -50%)", zIndex: 5000, background: "rgba(2,6,23,0.85)", backdropFilter: "blur(6px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", pointerEvents: "all" }}>
          <div className="spinner" style={{ width: "44px", height: "44px", borderWidth: "3px" }} />
          <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{t("home.running_fraud_engine")}</p>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{t("home.evaluating_claim")}</p>
        </div>
      )}

      <div className="dashboard-page animate-fadeIn">

      {/* STICKY TOP HEADER */}
      <header style={{ background: "linear-gradient(180deg,rgba(15,23,42,1) 0%,rgba(15,23,42,0) 100%)", padding: "20px 20px 24px", position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>
              {t("home.hey", { name: firstName })}
            </h2>
            <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "5px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "99px", padding: "4px 12px 4px 8px", width: "fit-content" }}>
              <span style={{ fontSize: "13px" }}>📍</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>{worker.dark_store_zone}</span>
              <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>· {worker.city}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              value={language}
              onChange={e => setLanguage(e.target.value as (typeof LANGUAGE_OPTIONS)[number]["code"])}
              style={{ padding: "6px 10px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", fontSize: "12px", fontWeight: 600, outline: "none" }}
            >
              {LANGUAGE_OPTIONS.map(o => (
                <option key={o.code} value={o.code} style={{ background: "#0f172a" }}>{o.label}</option>
              ))}
            </select>
            <div style={{ width: "38px", height: "38px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={18} color="var(--text-secondary)" />
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "99px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "12px", fontWeight: 600, color: "#34D399" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E", animation: "pulseGlow 2s infinite", display: "inline-block" }} />
            {t("home.active_coverage")}
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {dashboard?.active_policy ? `Tier ${dashboard.active_policy.tier} · ${policyWeek}` : t("home.policy_pending")}
          </span>
        </div>
      </header>

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>

        {/* DCI HERO CARD */}
        <motion.section
          className="stagger-1"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          style={{ position: "relative", borderRadius: "24px", overflow: "hidden", background: `linear-gradient(135deg,rgba(15,23,42,0.9) 0%,${statusColor}18 100%)`, border: `1px solid ${statusColor}30`, boxShadow: `0 20px 60px ${statusColor}20` }}
        >
          <div style={{ position: "absolute", top: "-40px", left: "50%", transform: "translateX(-50%)", width: "220px", height: "220px", background: `${statusColor}25`, filter: "blur(60px)", borderRadius: "50%", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1, padding: "24px 20px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.2px", color: "var(--text-secondary)", marginBottom: "4px" }}>{t("home.zone_risk_index")}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="pulse-dot" style={{ background: statusColor, boxShadow: `0 0 10px ${statusColor}`, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>{t("home.live_time", { time: lastUpdated })}</span>
                </div>
              </div>
              <span className="badge-pill" style={{ background: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, textTransform: "uppercase", letterSpacing: "1px", fontSize: "11px", fontWeight: 700 }}>
                {statusLabel}
              </span>
            </div>

            <motion.div className="risk-gauge-wrap" initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.1 }}>
              <svg className="gauge-svg" width="220" height="90" viewBox="0 0 140 75" style={{ overflow: "visible" }}>
                <defs>
                  <filter id="glow-h" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>
                <path d="M 10 72 A 60 60 0 0 1 130 72" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} strokeLinecap="round" />
                <path d="M 10 72 A 60 60 0 0 1 130 72" fill="none" stroke={statusColor} strokeWidth={strokeWidth}
                  strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round" filter="url(#glow-h)"
                  style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16,1,0.3,1)", transformOrigin: "70px 72px" }}
                />
              </svg>
              <div className="risk-score">
                <div style={{ fontSize: "48px", fontWeight: 900, lineHeight: 1, letterSpacing: "-2px", textShadow: `0 6px 24px ${statusColor}70` }} className="tabular-nums">
                  {hasDci ? normalizedDci.toFixed(2) : "--"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "5px", letterSpacing: "0.5px" }}>{t("home.dci_score")}</div>
              </div>
            </motion.div>

            <p className="risk-caption" style={{ textAlign: "center", marginTop: "12px", fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{dciText}</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1px", marginTop: "20px", background: "rgba(255,255,255,0.06)", borderRadius: "16px", overflow: "hidden" }}>
              {[
                { label: t("premium"),  value: dashboard?.active_policy ? `₹${dashboard.active_policy.weekly_premium ?? dashboard.active_policy.premium_amount ?? "—"}` : "—", sub: t("home.per_week") },
                { label: t("coverage_label"), value: dashboard?.active_policy ? `₹${dashboard.active_policy.coverage_cap_daily}` : "—",  sub: t("home.per_day_cap") },
                { label: t("paid_out"), value: `₹${(dashboard?.weekly_summary.total_paid_out || 0).toLocaleString("en-IN")}`, sub: t("home.this_week_short"), color: "#34D399" },
              ].map((s) => (
                <div key={s.label} style={{ padding: "12px 8px", textAlign: "center" }}>
                  <div className="tabular-nums" style={{ fontSize: "15px", fontWeight: 800, color: s.color ?? "var(--text-primary)" }}>{s.value}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-secondary)", marginTop: "2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* QUICK ACTIONS */}
        <section className="stagger-2">
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "14px" }}>{t("home.quick_actions")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
            {[
              { icon: "⚡", label: isSimulating ? "…" : t("home.trigger_simulation"),  bg: "rgba(14,165,233,0.1)",  border: "rgba(14,165,233,0.2)",  color: "#38BDF8", onClick: !isDisrupted ? handleSimulateDisruption : undefined, disabled: isSimulating || isDisrupted },
              { icon: "💸", label: isProcessing ? "…" : t("home.process_claim"),     bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.2)",  color: "#34D399", onClick: isDisrupted ? handleProcessClaim : undefined,       disabled: !isDisrupted || isProcessing },
              { icon: "🤖", label: t("home.copilot_action"),     bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.2)", color: "#A78BFA", onClick: () => { window.location.href = "/worker-app/chat"; },  disabled: false },
              { icon: "🗺️", label: t("home.radar_action"),       bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)", color: "#FBBF24", onClick: () => { window.location.href = "/worker-app/radar"; }, disabled: false },
            ].map(a => (
              <button key={a.label} onClick={a.onClick} disabled={a.disabled}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "16px 8px", borderRadius: "18px", background: a.bg, border: `1px solid ${a.border}`, cursor: a.onClick ? "pointer" : "not-allowed", opacity: a.disabled ? 0.4 : 1, transition: "all 0.2s", fontFamily: "inherit" }}
              >
                <span style={{ fontSize: "24px" }}>{a.icon}</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: a.color, textAlign: "center" }}>{a.label}</span>
              </button>
            ))}
          </div>
          {simulationError && <div style={{ marginTop: "12px", padding: "12px 14px", background: "rgba(245,158,11,0.08)", borderRadius: "12px", border: "1px solid rgba(245,158,11,0.2)", color: "#FCD34D", fontSize: "13px" }}>{t("home.simulation_error")}</div>}
          {processingError && <div style={{ marginTop: "12px", padding: "12px 14px", background: "rgba(239,68,68,0.08)", borderRadius: "12px", border: "1px solid rgba(239,68,68,0.2)", color: "#FCA5A5", fontSize: "13px" }}>{t("home.claim_error")}</div>}
        </section>

        {/* SAFETY RADAR */}
        <section className="stagger-3">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)" }}>🧠 {t("home.safety_radar")}</p>
            <span style={{ fontSize: "11px", color: "#22C55E", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", animation: "pulse 2s infinite", display: "inline-block" }} />{t("home.live")}
            </span>
          </div>
          <div className="glass-panel" style={{ padding: "16px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>{t("home.live_map_desc")}</p>
            <SafetyRadar compact={true} userCoords={coords} />
            <div style={{ marginTop: "14px", textAlign: "center" }}>
              <Link href="/worker-app/radar" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "10px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#818CF8", fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>
                {t("home.view_full_map")} <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </section>

        {/* WHAT'S COVERED */}
        <section className="stagger-4">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)" }}>{t("what_is_covered")}</p>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" aria-label="Scroll left" onClick={() => shiftCoverage("left")} style={{ width: "26px", height: "26px", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronLeft size={14} color="var(--text-secondary)" />
              </button>
              <button type="button" aria-label="Scroll right" onClick={() => shiftCoverage("right")} style={{ width: "26px", height: "26px", borderRadius: "8px", border: "1px solid var(--border-glass)", background: "rgba(15,23,42,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronRight size={14} color="var(--text-secondary)" />
              </button>
            </div>
          </div>
          <div ref={coverageCarouselRef} style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
            {coverageBadges.map(item => (
              <div key={item.id} style={{ flexShrink: 0, scrollSnapAlign: "start", padding: "14px 16px", borderRadius: "16px", background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)", minWidth: "140px" }}>
                <div style={{ fontSize: "22px", marginBottom: "6px" }}>
                  {item.icon}
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#BAE6FD" }}>{item.label}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "3px" }}>{t("home.covered_tick")}</div>
              </div>
            ))}
          </div>
        </section>

        {/* WEEKLY SUMMARY */}
        <section className="stagger-4">
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "12px" }}>{t("home.this_week_title")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
            {[
              { icon: "💰", label: t("home.premium_paid"),  value: `₹${dashboard?.weekly_summary.premium_paid ?? 0}`,                                                    color: "#60A5FA" },
              { icon: "⚡", label: t("home.disruptions"),   value: String(dashboard?.weekly_summary.disruptions ?? 0),                                                    color: "#FBBF24" },
              { icon: "✅", label: t("paid_out"),      value: `₹${(dashboard?.weekly_summary.total_paid_out ?? 0).toLocaleString("en-IN")}`,                        color: "#34D399" },
            ].map(s => (
              <div key={s.label} className="glass-panel" style={{ padding: "14px 12px", display: "flex", flexDirection: "column", gap: "6px", borderRadius: "18px" }}>
                <span style={{ fontSize: "20px" }}>{s.icon}</span>
                <span className="tabular-nums" style={{ fontSize: "18px", fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* EXPLORE */}
        <section className="stagger-5">
          <p style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", color: "var(--text-secondary)", marginBottom: "12px" }}>{t("home.explore_title")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "💸", label: t("payouts_title"),     sub: t("home.explore_payouts_sub"),  href: "/worker-app/payouts", color: "#34D399", bg: "rgba(52,211,153,0.08)" },
              { icon: "🤖", label: t("nav_copilot"),  sub: t("home.explore_copilot_sub"),    href: "/worker-app/chat",    color: "#A78BFA", bg: "rgba(167,139,250,0.08)" },
              { icon: "🏛️", label: t("govt.title"), sub: t("home.explore_govt_sub"),     href: "/worker-app/govt",    color: "#FBBF24", bg: "rgba(251,191,36,0.08)" },
            ].map(item => (
              <Link key={item.label} href={item.href} style={{ textDecoration: "none" }}>
                <div className="glass-panel interactive-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "14px", borderRadius: "16px" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: item.bg, border: `1px solid ${item.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</p>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>{item.sub}</p>
                  </div>
                  <ChevronRight size={16} color="rgba(148,163,184,0.4)" />
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
      </div>
    </>
  );
}
