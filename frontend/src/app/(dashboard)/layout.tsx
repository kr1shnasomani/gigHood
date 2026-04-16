"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, Home, MessageSquare, User, Landmark } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { useLanguageStore } from "@/store/languageStore";
import { t } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const language = useLanguageStore((s) => s.language);

  const normalizedPath = pathname.startsWith("/worker-app")
    ? pathname.slice("/worker-app".length) || "/"
    : pathname;

  const isChatRoute = normalizedPath === "/chat";

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/worker-app/login");
    }
  }, [pathname, router]);

  const navItems = [
    {
      href: "/worker-app/home",
      matchPath: "/home",
      label: t(language, "nav_home"),
      icon: Home,
    },
    {
      href: "/worker-app/payouts",
      matchPath: "/payouts",
      label: t(language, "nav_payouts"),
      icon: Wallet,
    },
    {
      href: "/worker-app/chat",
      matchPath: "/chat",
      label: t(language, "nav_copilot"),
      icon: MessageSquare,
    },
    {
      href: "/worker-app/govt",
      matchPath: "/govt",
      label: "Govt",
      icon: Landmark,
    },
    {
      href: "/worker-app/profile",
      matchPath: "/profile",
      label: t(language, "nav_profile"),
      icon: User,
    },
  ];

  useEffect(() => {
    router.prefetch("/worker-app/home");
    router.prefetch("/worker-app/payouts");
    router.prefetch("/worker-app/chat");
    router.prefetch("/worker-app/profile");
    router.prefetch("/worker-app/govt");
  }, [router]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "#020617",
      }}
    >
      {/* MAIN CONTENT */}
      <main
        className={`page-content ${isChatRoute ? "page-content-chat" : ""}`}
        style={{
          flex: 1,
          paddingBottom: "90px", // space for floating nav
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 🔥 FLOATING NAVBAR */}
      <nav
        style={{
          position: "fixed",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "92%",
          maxWidth: "420px",
          padding: "10px 6px",
          borderRadius: "20px",
          background: "rgba(15, 23, 42, 0.9)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 100,
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {navItems.map((item) => {
          const isActive = normalizedPath === item.matchPath;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                flex: 1,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 6px",
                  borderRadius: "12px",
                  transition: "all 0.25s ease",
                  background: isActive ? "rgba(59,130,246,0.12)" : "transparent",
                }}
              >
                {/* ICON */}
                <motion.div
                  style={{ position: "relative" }}
                  animate={{ scale: isActive ? 1.2 : 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    color={isActive ? "#3B82F6" : "#94A3B8"}
                  />

                  {/* 🔥 GLOW EFFECT */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "#3B82F6",
                        filter: "blur(12px)",
                        opacity: 0.4,
                        borderRadius: "50%",
                        zIndex: -1,
                      }}
                    />
                  )}
                </motion.div>

                {/* LABEL */}
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#3B82F6" : "#94A3B8",
                    transition: "all 0.2s ease",
                  }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
