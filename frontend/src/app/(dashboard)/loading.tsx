"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function WorkerDashboardLoading() {
  const messages = [
    "Analyzing weather disruptions...",
    "Checking traffic impact...",
    "Calculating protection coverage...",
    "Verifying zone risk signals...",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex(Math.floor(Math.random() * messages.length));
    }, 1500);

    return () => clearInterval(interval); // ✅ prevents memory leak
  }, [messages.length]);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "18px",
      }}
    >
      {/* 🔵 Pulse Ring */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            border: "2px solid rgba(99,102,241,0.3)",
            animation: "pulseRing 1.5s infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: "#6366F1",
            boxShadow: "0 0 15px #6366F1",
          }}
        />
      </div>

      {/* 🧠 Rotating Message */}
      <div style={{ textAlign: "center", minHeight: "40px" }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              fontSize: "15px",
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {messages[currentIndex]}
          </motion.p>
        </AnimatePresence>

        <p
          style={{
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginTop: "6px",
          }}
        >
          Preparing your dashboard
        </p>
      </div>
    </div>
  );
}
