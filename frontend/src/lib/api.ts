import axios from "axios";

const DEFAULT_LOCAL_API_URL = "http://localhost:8001";
const DEFAULT_PROD_API_URL = "https://gighood-backend-live.onrender.com";
const DEFAULT_PREVIEW_API_URL = "https://gighood-backend-admin.onrender.com";

function resolveApiBaseUrl(): string {
  const configuredProd = process.env.NEXT_PUBLIC_API_URL;
  const configuredPreview = process.env.NEXT_PUBLIC_API_URL_PREVIEW;
  const configuredAdmin = process.env.NEXT_PUBLIC_API_URL_ADMIN;
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const pathname = window.location.pathname || "";
    const isAdminRoute = pathname.startsWith("/admin-dashboard");

    if (isAdminRoute && configuredAdmin) {
      return configuredAdmin;
    }

    if (host === "localhost" || host === "127.0.0.1") {
      return DEFAULT_LOCAL_API_URL;
    }

    // Most reliable path on Vercel when system env vars are exposed.
    if (vercelEnv === "preview") {
      return configuredPreview || configuredProd || DEFAULT_PREVIEW_API_URL;
    }

    if (vercelEnv === "production") {
      return configuredProd || DEFAULT_PROD_API_URL;
    }

    // Fallback for environments where NEXT_PUBLIC_VERCEL_ENV is not exposed.
    const isVercelPreview =
      host.endsWith(".vercel.app") && !host.includes("gighood.vercel.app");

    if (isVercelPreview) {
      return configuredPreview || configuredProd || DEFAULT_PREVIEW_API_URL;
    }
  }

  if (configuredProd) return configuredProd;

  if (configuredPreview) return configuredPreview;

  return DEFAULT_PROD_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

type ApiError = Error & { status?: number };

function withStatus(error: Error, status: number): ApiError {
  const next = error as ApiError;
  next.status = status;
  return next;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: process.env.NODE_ENV === "development" ? 12000 : 30000,
  headers: { "Content-Type": "application/json" },
});

function clearAuthClientState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("gighood_jwt");
  localStorage.removeItem("gighood-auth-store");
  localStorage.removeItem("auth-storage");
}

// Attach JWT from localStorage
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("gighood_jwt");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise errors to a single message string, but preserve status code
api.interceptors.response.use(
  (r) => r,
  (error: unknown) => {
    // Let axios cancellations and AbortController signals pass through unchanged
    // so callers can distinguish user-initiated cancellations from real errors.
    if (axios.isCancel(error)) return Promise.reject(error);
    if (error instanceof DOMException && error.name === "AbortError") return Promise.reject(error);

    const maybeError = error as {
      response?: { data?: { detail?: string }; status?: number };
      message?: string;
    };

    if (!maybeError?.response) {
      const networkErr = new Error(
        `Network error: cannot reach API (${API_BASE_URL}). Check NEXT_PUBLIC_API_URL and backend availability.`,
      );
      return Promise.reject(withStatus(networkErr, 0));
    }

    const msg =
      maybeError.response?.data?.detail || maybeError.message || "Unknown error";

    if (msg.toLowerCase().includes('nodename nor servname provided') || msg.toLowerCase().includes('[errno 8]')) {
      const hostErr = new Error(
        'Backend dependency hostname resolution failed. Check backend host env vars (for example Neo4j/Supabase URLs).'
      );
      return Promise.reject(withStatus(hostErr, maybeError.response?.status ?? 500));
    }

    if (
      maybeError.response?.status === 401 ||
      msg.toLowerCase().includes("token expired") ||
      msg.toLowerCase().includes("could not validate credentials")
    ) {
      if (typeof window !== "undefined") {
        clearAuthClientState();
        window.location.href = "/worker-app/login";
      }
    }

    const err = new Error(msg);
    return Promise.reject(withStatus(err, maybeError.response?.status ?? 0));
  },
);

export default api;
