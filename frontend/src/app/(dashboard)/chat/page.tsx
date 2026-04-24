"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square, Send, Bot, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { workerApi, type Claim } from "../../../lib/worker";
import api from "../../../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  useLanguageStore,
  type AppLanguage,
} from "../../../store/languageStore";
import { t } from "../../../lib/i18n";
import { useVoiceCopilot } from "@/hooks/useVoiceCopilot";
import ReactMarkdown from "react-markdown";

// ── Types ──────────────────────────────────────────────────────────────────────
type Message = { role: "user" | "assistant"; content: string; ts?: string };

// ── Constants ─────────────────────────────────────────────────────────────────
const WELCOME_MESSAGES: Record<AppLanguage, string> = {
  en: "Namaste! I'm your Gig Copilot. I can explain your policy, your current zone risk, and your claim history. How can I help?",
  hi: "नमस्ते! मैं आपका Gig Copilot हूं। मैं आपकी पॉलिसी, आपके क्षेत्र का जोखिम और आपके क्लेम इतिहास को समझाने में मदद कर सकता हूं। मैं कैसे मदद करूं?",
  ta: "வணக்கம்! நான் உங்கள் Gig Copilot. உங்கள் பாலிசி, உங்கள் பகுதியில் உள்ள அபாயம், மற்றும் உங்கள் கிளைம் வரலாறு பற்றி விளக்க முடியும். எப்படி உதவலாம்?",
  te: "నమస్తే! నేను మీ Gig Copilot. మీ పాలసీ, మీ ప్రాంతపు రిస్క్, మరియు మీ క్లెయిమ్ చరిత్ర గురించి వివరించగలను. నేను ఎలా సహాయం చేయగలను?",
  kn: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ Gig Copilot. ನಿಮ್ಮ ಪಾಲಿಸಿ, ನಿಮ್ಮ ಪ್ರದೇಶದ ಅಪಾಯ, ಮತ್ತು ನಿಮ್ಮ ಕ್ಲೈಮ್ ಇತಿಹಾಸವನ್ನು ವಿವರಿಸಬಹುದು. ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
  mr: "नमस्कार! मी तुमचा Gig Copilot आहे. तुमची पॉलिसी, क्षेत्राचा धोका आणि क्लेम इतिहास समजावून सांगू शकतो. मी कशी मदत करू?",
  bn: "নমস্কার! আমি আপনার Gig Copilot। আপনার পলিসি, জোন ঝুঁকি এবং ক্লেম ইতিহাস ব্যাখ্যা করতে পারি। কীভাবে সাহায্য করতে পারি?",
  as: "নমস্কাৰ! মই আপোনাৰ Gig Copilot। আপোনাৰ পলিচি, জোন ঝুঁকি আৰু ক্লেইম ইতিহাস ব্যাখ্যা কৰিব পাৰো। কেনেকৈ সহায় কৰিম?",
};

const SUGGESTED_QUESTIONS_BY_LANG: Record<AppLanguage, Array<{ emoji: string; text: string }>> = {
  en: [
    { emoji: "💸", text: "How are my payouts calculated?" },
    { emoji: "🛡️", text: "What is my current zone risk?" },
    { emoji: "📅", text: "When does my policy renew?" },
    { emoji: "⚡", text: "What triggers automatic coverage?" },
    { emoji: "📊", text: "Explain my trust score" },
  ],
  hi: [
    { emoji: "💸", text: "मेरे भुगतान की गणना कैसे होती है?" },
    { emoji: "🛡️", text: "मेरा वर्तमान ज़ोन जोखिम क्या है?" },
    { emoji: "📅", text: "मेरी पॉलिसी कब नवीनीकृत होगी?" },
    { emoji: "⚡", text: "ऑटोमैटिक कवरेज कब ट्रिगर होती है?" },
    { emoji: "📊", text: "मेरा ट्रस्ट स्कोर समझाइए" },
  ],
  ta: [
    { emoji: "💸", text: "என் பேஅவுட் எப்படி கணக்கிடப்படுகிறது?" },
    { emoji: "🛡️", text: "என் தற்போதைய மண்டல ஆபத்து என்ன?" },
    { emoji: "📅", text: "என் பாலிசி எப்போது புதுப்பிக்கப்படுகிறது?" },
    { emoji: "⚡", text: "தானியங்கி கவரேஜ் எப்போது தொடங்கும்?" },
    { emoji: "📊", text: "என் நம்பிக்கை மதிப்பெண்ணை விளக்கவும்" },
  ],
  te: [
    { emoji: "💸", text: "నా పేఅవుట్లు ఎలా లెక్కిస్తారు?" },
    { emoji: "🛡️", text: "నా ప్రస్తుత జోన్ రిస్క్ ఏమిటి?" },
    { emoji: "📅", text: "నా పాలసీ ఎప్పుడు రీన్యూ అవుతుంది?" },
    { emoji: "⚡", text: "ఆటోమేటిక్ కవరేజ్ ఏమి ట్రిగర్ చేస్తుంది?" },
    { emoji: "📊", text: "నా ట్రస్ట్ స్కోర్‌ని వివరించండి" },
  ],
  kn: [
    { emoji: "💸", text: "ನನ್ನ ಪಾವತಿಗಳು ಹೇಗೆ ಲೆಕ್ಕಿಸಲಾಗುತ್ತದೆ?" },
    { emoji: "🛡️", text: "ನನ್ನ ಪ್ರಸ್ತುತ ಝೋನ್ ಅಪಾಯ ಏನು?" },
    { emoji: "📅", text: "ನನ್ನ ಪಾಲಿಸಿ ಯಾವಾಗ ನವೀಕರಿಸುತ್ತದೆ?" },
    { emoji: "⚡", text: "ಸ್ವಯಂ ಕವರೆಜ್ ಏನು ಟ್ರಿಗರ್ ಮಾಡುತ್ತದೆ?" },
    { emoji: "📊", text: "ನನ್ನ ಟ್ರಸ್ಟ್ ಸ್ಕೋರ್ ವಿವರಿಸಿ" },
  ],
  mr: [
    { emoji: "💸", text: "माझे पेआउट्स कसे मोजले जातात?" },
    { emoji: "🛡️", text: "माझा सध्याचा झोन धोका काय आहे?" },
    { emoji: "📅", text: "माझी पॉलिसी कधी नूतनीकरण होते?" },
    { emoji: "⚡", text: "ऑटोमॅटिक कव्हरेज कशामुळे ट्रिगर होते?" },
    { emoji: "📊", text: "माझा ट्रस्ट स्कोअर समजवा" },
  ],
  bn: [
    { emoji: "💸", text: "আমার পেআউট কীভাবে হিসাব হয়?" },
    { emoji: "🛡️", text: "আমার বর্তমান জোন ঝুঁকি কত?" },
    { emoji: "📅", text: "আমার পলিসি কবে রিনিউ হবে?" },
    { emoji: "⚡", text: "অটোমেটিক কভারেজ কী ট্রিগার করে?" },
    { emoji: "📊", text: "আমার ট্রাস্ট স্কোর ব্যাখ্যা করুন" },
  ],
  as: [
    { emoji: "💸", text: "মোৰ পেমেন্ট কেনেকৈ গণনা হয়?" },
    { emoji: "🛡️", text: "মোৰ বৰ্তমান জ'ন ঝুঁকি কিমান?" },
    { emoji: "📅", text: "মোৰ পলিচি কেতিয়া নবীকৰণ হয়?" },
    { emoji: "⚡", text: "স্বয়ংক্ৰিয় কভাৰেজ কিহে ট্ৰিগাৰ কৰে?" },
    { emoji: "📊", text: "মোৰ ট্রাষ্ট স্ক'ৰ বুজাই দিয়ক" },
  ],
};

function now(): string {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function isNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("status" in error) return (error as { status: number }).status === 0;
  return !("response" in error) && !("status" in error);
}

// ── Typing dots ───────────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
      {/* AI avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
        }}
      >
        <Bot size={17} color="white" />
      </div>
      <div
        style={{
          padding: "14px 18px",
          borderRadius: "4px 18px 18px 18px",
          background: "rgba(30,41,59,0.7)",
          border: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          gap: "5px",
          alignItems: "center",
        }}
      >
        {[0, 0.2, 0.4].map((d) => (
          <span
            key={d}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#6366F1,#A78BFA)",
              display: "inline-block",
              animation: "typingDot 1.4s ease-in-out infinite",
              animationDelay: `${d}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const language = useLanguageStore((s) => s.language);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGES.en, ts: now() },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chipsSent, setChipsSent] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("text");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: claims } = useQuery<Claim[]>({
    queryKey: ["claims"],
    queryFn: workerApi.getClaims,
    staleTime: 60000,
  });

  // Dynamic first suggestion based on last paid claim
  const lastPaidClaim = claims?.find(
    (c) => c.status === "paid" || c.status === "approved",
  );
  const lastPaidAmount =
    typeof lastPaidClaim?.payout_amount === "number"
      ? lastPaidClaim.payout_amount
      : null;
  const dynamicSuggestions = [
    {
      emoji: "💰",
      text:
        lastPaidAmount !== null
          ? `Why was my last payout ₹${lastPaidAmount.toLocaleString("en-IN")}?`
          : "How are my payouts calculated?",
    },
    ...(SUGGESTED_QUESTIONS_BY_LANG[language] ?? SUGGESTED_QUESTIONS_BY_LANG.en).slice(1),
  ];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!chipsSent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages([
        {
          role: "assistant",
          content: WELCOME_MESSAGES[language] ?? WELCOME_MESSAGES.en,
          ts: now(),
        },
      ]);
    }
  }, [language, chipsSent]);

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const sendMessage = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isLoading) return;

    setInput("");
    setChipsSent(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, ts: now() },
    ]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await api.post(
        "/chat",
        { message: userMsg, language },
        { signal: controller.signal },
      );
      const reply = res.data.reply ?? res.data.response ?? "";
      const replyLang = res.data.language || language;
      if (!reply) throw new Error("empty reply");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, ts: now() },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "CanceledError") return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errorMsg = isNetworkError(err)
        ? "Sorry, I'm having trouble connecting right now. Please try again in a moment."
        : "Sorry, something went wrong on my end. Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: errorMsg, ts: now() },
      ]);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const {
    isListening,
    isAudioLoading,
    isVoiceSupported,
    listenError,
    toggleListening,
  } = useVoiceCopilot((txt) => sendMessage(txt));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="chat-page relative min-h-screen pb-32 flex flex-col">
      {/* ── HEADER (frosted, sticky) ─────────────────────────────────── */}
      <header
        style={{
          background: "rgba(10,10,20,0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 16px 12px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Identity row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* AI avatar with glow ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 3px rgba(99,102,241,0.25), 0 6px 20px rgba(99,102,241,0.35)",
                transition: "box-shadow 0.3s ease",
                animation: "none",
              }}
            >
              <Bot size={20} color="white" />
            </div>
            {/* Online dot */}
            <span
              style={{
                position: "absolute",
                bottom: 1,
                right: 1,
                width: 11,
                height: 11,
                borderRadius: "50%",
                background: isAudioLoading
                  ? "#A78BFA"
                  : isListening
                    ? "#ef4444"
                    : "#22C55E",
                border: "2px solid rgba(10,10,20,0.9)",
                boxShadow: isAudioLoading
                  ? "0 0 6px #A78BFA"
                  : isListening
                    ? "0 0 6px #ef4444"
                    : "0 0 6px #22C55E",
                transition: "all 0.3s",
              }}
            />
          </div>

          {/* Name + status */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.3px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                Gig Copilot
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    background: "rgba(99,102,241,0.2)",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    color: "#a78bfa",
                  }}
                >
                  {language.toUpperCase()}
                </span>
              </h2>
              <Sparkles size={13} color="#A78BFA" />
            </div>
            <p
              style={{
                fontSize: "11px",
                color: isAudioLoading
                  ? "#A78BFA"
                  : isListening
                    ? "#ef4444"
                    : "#22C55E",
                fontWeight: 600,
                marginTop: "1px",
              }}
            >
              {isAudioLoading
                ? t(language, "chat.ai_thinking")
                : isListening
                  ? t(language, "chat.listening")
                  : isLoading
                    ? t(language, "chat.ai_typing")
                    : t(language, "chat.online_monitoring")}
            </p>
          </div>

          {/* Mode toggle pill */}
          <button
            onClick={() => {
              if (!isVoiceSupported && mode !== "voice") {
                return;
              }
              setMode(mode === "voice" ? "text" : "voice");
              if (isListening) toggleListening();
            }}
            disabled={!isVoiceSupported && mode !== "voice"}
            style={{
              padding: "6px 14px",
              borderRadius: "99px",
              fontSize: "11px",
              fontWeight: 700,
              cursor: !isVoiceSupported && mode !== "voice" ? "not-allowed" : "pointer",
              opacity: !isVoiceSupported && mode !== "voice" ? 0.55 : 1,
              background:
                mode === "voice"
                  ? "rgba(99,102,241,0.2)"
                  : "rgba(255,255,255,0.05)",
              border:
                mode === "voice"
                  ? "1px solid rgba(99,102,241,0.5)"
                  : "1px solid rgba(255,255,255,0.1)",
              color: mode === "voice" ? "#818CF8" : "var(--text-secondary)",
              transition: "all 0.2s",
            }}
          >
            {mode === "voice" ? "🗣 Voice" : "⌨️ Text"}
          </button>
        </div>
      </header>

      {/* ── MESSAGES ────────────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "16px 16px 8px",
          scrollBehavior: "smooth",
        }}
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isUser = msg.role === "user";
            const prev = index > 0 ? messages[index - 1] : null;
            const showAvatar = !prev || prev.role !== msg.role;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{
                  display: "flex",
                  gap: "10px",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                }}
              >
                {/* Avatar */}
                {showAvatar ? (
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isUser
                        ? "linear-gradient(135deg,#0ea5e9,#6366f1)"
                        : "linear-gradient(135deg,#4f46e5,#7c3aed)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isUser
                        ? "0 4px 12px rgba(14,165,233,0.3)"
                        : "0 4px 12px rgba(99,102,241,0.35)",
                      fontSize: "15px",
                    }}
                  >
                    {isUser ? "👤" : <Bot size={17} color="white" />}
                  </div>
                ) : (
                  <div style={{ width: 34, flexShrink: 0 }} />
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start",
                    maxWidth: "82%",
                  }}
                >
                  {/* Bubble */}
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: isUser
                        ? "18px 4px 18px 18px"
                        : "4px 18px 18px 18px",
                      background: isUser
                        ? "linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)"
                        : "rgba(30,41,59,0.75)",
                      border: isUser
                        ? "none"
                        : "1px solid rgba(255,255,255,0.07)",
                      backdropFilter: isUser ? undefined : "blur(12px)",
                      boxShadow: isUser
                        ? "0 4px 16px rgba(79,70,229,0.3)"
                        : "0 4px 16px rgba(0,0,0,0.2)",
                      color: "white",
                      fontSize: "14px",
                      lineHeight: 1.6,
                      wordBreak: "break-word",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {isUser ? (
                      msg.content
                    ) : (
                      <div className="markdown-message">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Timestamp + label */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      marginTop: "4px",
                      paddingLeft: isUser ? 0 : "4px",
                      paddingRight: isUser ? "4px" : 0,
                    }}
                  >
                    {!isUser && (
                      <span
                        style={{
                          fontSize: "9px",
                          color: "#A78BFA",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        AI
                      </span>
                    )}
                    <span
                      suppressHydrationWarning
                      style={{
                        fontSize: "10px",
                        color: "rgba(148,163,184,0.6)",
                      }}
                    >
                      {msg.ts}
                    </span>
                    {isUser && (
                      <span style={{ fontSize: "11px", color: "#60A5FA" }}>
                        ✓✓
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <TypingIndicator />
          </motion.div>
        )}

        {/* Suggestion chips */}
        {!chipsSent && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            style={{ marginTop: "4px" }}
          >
            <p
              style={{
                fontSize: "11px",
                color: "rgba(148,163,184,0.7)",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                marginBottom: "10px",
              }}
            >
              {t(language, "chat.quick_questions")}
            </p>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {dynamicSuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q.text)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    cursor: "pointer",
                    background: "rgba(99,102,241,0.07)",
                    border: "1px solid rgba(99,102,241,0.2)",
                    color: "#C7D2FE",
                    fontSize: "13px",
                    fontWeight: 500,
                    fontFamily: "inherit",
                    textAlign: "left",
                    lineHeight: 1.4,
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(99,102,241,0.14)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "rgba(99,102,241,0.07)";
                  }}
                >
                  <span style={{ fontSize: "18px", flexShrink: 0 }}>
                    {q.emoji}
                  </span>
                  <span>{q.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── COMPOSER ────────────────────────────────────────────────── */}
      <div
        style={{
          position: "fixed",
          bottom: "85px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "92%",
          maxWidth: "420px",
          zIndex: 50,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(12px)",
          borderRadius: "24px",
          border: "1px solid rgba(168, 85, 247, 0.3)",
          padding: "8px 12px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* VOICE MODE */}
        {mode === "voice" ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Voice wave + listen state */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 16px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Animated bars */}
              <div
                style={{
                  display: "flex",
                  gap: "3px",
                  alignItems: "center",
                  height: "22px",
                }}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <motion.div
                    key={i}
                    animate={
                      isListening ? { height: [4, 18, 4] } : { height: 4 }
                    }
                    transition={{
                      repeat: Infinity,
                      duration: 0.7,
                      delay: i * 0.12,
                      ease: "easeInOut",
                    }}
                    style={{
                      width: 3,
                      background: isListening
                        ? "#34D399"
                        : "rgba(255,255,255,0.18)",
                      borderRadius: 2,
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isListening ? "#34D399" : "var(--text-secondary)",
                }}
              >
                {isListening ? "Listening…" : "Tap mic to speak"}
              </span>
            </div>

            {/* Mic button */}
            <button
                onClick={() => {
                  navigator.vibrate?.(10);
                  toggleListening();
                }}
                disabled={!isVoiceSupported}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isListening
                    ? "rgba(52,211,153,0.18)"
                    : "rgba(99,102,241,0.12)",
                  border: isListening
                    ? "1px solid rgba(52,211,153,0.5)"
                    : "1px solid rgba(99,102,241,0.35)",
                  color: isListening ? "#34D399" : "#818CF8",
                  boxShadow: isListening
                    ? "0 0 20px rgba(52,211,153,0.35)"
                    : "none",
                  position: "relative",
                  cursor: isVoiceSupported ? "pointer" : "not-allowed",
                  opacity: isVoiceSupported ? 1 : 0.5,
                  transition: "all 0.2s",
                }}
              >
                {isListening ? <Mic size={22} /> : <MicOff size={22} />}
                {isListening && (
                  <span
                    style={{
                      position: "absolute",
                      inset: -5,
                      borderRadius: "50%",
                      border: "1.5px solid #34D399",
                      animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite",
                    }}
                  />
                )}
              </button>
          </div>
        ) : (
          /* TEXT MODE */
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: "10px", alignItems: "center" }}
          >
            <div style={{ flex: 1, position: "relative" }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  t(language, "ask_coverage") ||
                  "Ask anything about your policy…"
                }
                disabled={isLoading}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  boxSizing: "border-box",
                  borderRadius: "16px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "white",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99,102,241,0.5)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                }}
              />
            </div>

            {/* Stop / Send */}
            {isLoading ? (
              <button
                type="button"
                onClick={() => {
                  stopGeneration();
                  navigator.vibrate?.(30);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.4)",
                  color: "#F87171",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                title="Stop generating"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                onClick={() => navigator.vibrate?.(10)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: input.trim()
                    ? "linear-gradient(135deg,#4f46e5,#7c3aed)"
                    : "rgba(255,255,255,0.06)",
                  border: input.trim()
                    ? "none"
                    : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: input.trim()
                    ? "0 4px 16px rgba(79,70,229,0.4)"
                    : "none",
                  cursor: input.trim() ? "pointer" : "default",
                  transition: "all 0.2s ease",
                }}
              >
                <Send size={17} color="white" style={{ marginLeft: "2px" }} />
              </button>
            )}
          </form>
        )}

        {/* Disclaimer */}
        {mode === "voice" && !isVoiceSupported && (
          <p
            style={{
              fontSize: "10px",
              color: "#FCA5A5",
              textAlign: "center",
              marginTop: "10px",
            }}
          >
            Voice input is unavailable in this browser. Use Chrome/Safari with microphone permission.
          </p>
        )}
        {mode === "voice" && listenError && (
          <p
            style={{
              fontSize: "10px",
              color: "#FCA5A5",
              textAlign: "center",
              marginTop: "8px",
            }}
          >
            {listenError}
          </p>
        )}
        <p
          style={{
            fontSize: "10px",
            color: "rgba(148,163,184,0.4)",
            textAlign: "center",
            marginTop: "12px",
          }}
        >
          AI-generated responses · Verify policy details officially
        </p>
      </div>
    </div>
  );
}
