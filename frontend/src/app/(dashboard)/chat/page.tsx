"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, Square, Send, Bot, User } from "lucide-react";
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

type Message = { role: "user" | "assistant"; content: string };

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

function isNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  // Our api.ts interceptor strips .response but adds .status
  // Status 0 indicates a pure network failure.
  if ("status" in error) {
    return (error as any).status === 0;
  }
  return !("response" in error) && !("status" in error);
}

function TypingIndicator() {
  return (
    <div className="chat-row">
      <div
        className="chat-avatar"
        style={{
          background: "rgba(20, 184, 166, 0.2)",
          border: "1px solid rgba(20, 184, 166, 0.3)",
        }}
      >
        <Bot size={18} color="#5EEAD4" />
      </div>
      <div
        className="chat-bubble assistant"
        style={{
          padding: "14px 20px",
          display: "flex",
          gap: "5px",
          alignItems: "center",
        }}
      >
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366F1, #A78BFA)",
              animation: "typingDot 1.4s ease-in-out infinite",
              animationDelay: `${delay}s`,
              display: "inline-block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const language = useLanguageStore((s) => s.language);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: WELCOME_MESSAGES.en },
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

  const lastPaidClaim = claims?.find(
    (c) => c.status === "paid" || c.status === "approved",
  );
  const lastPaidAmount =
    typeof lastPaidClaim?.payout_amount === "number"
      ? lastPaidClaim.payout_amount
      : null;
  const dynamicSuggestions = [
    lastPaidAmount !== null
      ? `Why was my last payout ₹${lastPaidAmount.toLocaleString("en-IN")}?`
      : "How are my payouts calculated?",
    "What is my current zone risk?",
    "When does my policy renew?",
  ];

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
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
      setMessages([
        {
          role: "assistant",
          content: WELCOME_MESSAGES[language] ?? WELCOME_MESSAGES.en,
        },
      ]);
    }
  }, [language, chipsSent]);

  const stopGeneration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const sendMessage = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isLoading) return;

    setInput("");
    setChipsSent(true);
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await api.post("/chat", { message: userMsg, language }, { signal: controller.signal });
      const reply = res.data.reply ?? res.data.response ?? "";
      if (!reply) throw new Error("empty reply");
      
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      
      // If voice mode is active, stream/speak response
      if (mode === "voice") {
        speak(reply);
      }
    } catch (err: unknown) {
      // Ignore abort errors — user intentionally cancelled
      if (err instanceof Error && err.name === "CanceledError") return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      const isNetworkErr = isNetworkError(err);
      const errorMsg = isNetworkErr
        ? "Sorry, I'm having trouble connecting right now. Please try again in a moment."
        : "Sorry, something went wrong on my end. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg }]);
      if (mode === "voice") speak(errorMsg);
    } finally {
      abortRef.current = null;
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const { isListening, isSpeaking, toggleListening, speak, interruptSpeech } = useVoiceCopilot((txt) => {
    sendMessage(txt);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="chat-page">
      <header className="stagger-1 chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            Gig Copilot
          </h2>
          <p
            style={{
              fontSize: "12px",
              color: "var(--trust-emerald)",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              marginTop: "3px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: isSpeaking ? "#F59E0B" : "var(--trust-emerald)",
                boxShadow: isSpeaking ? "0 0 8px #F59E0B" : "0 0 8px var(--trust-emerald)",
                flexShrink: 0,
                animation: isSpeaking ? "pulseGlow 1s infinite" : "pulseGlow 2s infinite",
              }}
            />
            {isSpeaking ? "AI is speaking..." : "AI Copilot · Monitoring your zone"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            onClick={() => {
              setMode(mode === "voice" ? "text" : "voice");
              if (isListening) toggleListening();
            }}
            style={{
              background: mode === "voice" ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
              border: mode === "voice" ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: 600,
              color: mode === "voice" ? "#818CF8" : "var(--text-secondary)",
              transition: "all 0.2s"
            }}
          >
            {mode === "voice" ? "🗣 Voice Mode" : "⌨️ Text Mode"}
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="stagger-2 chat-messages">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const prev = index > 0 ? messages[index - 1] : null;
          const showAvatar = !prev || prev.role !== msg.role;

          return (
            <motion.div
              key={index}
              className={`chat-row ${isUser ? "user" : ""}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              {showAvatar ? (
                <div
                  className="chat-avatar"
                  style={{
                    background: isUser
                      ? "rgba(14, 165, 233, 0.2)"
                      : "rgba(20, 184, 166, 0.18)",
                    border: `1px solid ${isUser ? "rgba(14,165,233,0.3)" : "rgba(20,184,166,0.3)"}`,
                  }}
                >
                  {isUser ? (
                    <User size={16} color="#7DD3FC" />
                  ) : (
                    <Bot size={16} color="#5EEAD4" />
                  )}
                </div>
              ) : (
                <div style={{ width: "28px", flexShrink: 0 }} />
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                }}
              >
                <div className={`chat-bubble ${isUser ? "user" : "assistant"} ${!isUser ? "markdown-message" : ""}`}>
                  {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                </div>
                {!isUser && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: "var(--text-secondary)",
                      marginTop: "4px",
                      paddingLeft: "4px",
                    }}
                  >
                    AI-generated response
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}

        {isLoading && <TypingIndicator />}

        {!chipsSent && !isLoading && (
          <div style={{ marginTop: "8px" }}>
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "1px",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              Quick questions
            </p>
            <div className="suggestions">
              {dynamicSuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="suggestion-chip hover-glow"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-composer">
        {mode === "voice" ? (
          <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(2, 6, 23, 0.6)', padding: '12px 20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            
            {isSpeaking ? (
               <button 
                onClick={interruptSpeech}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#EF4444", padding: "10px 16px", borderRadius: "20px", fontSize: "14px", fontWeight: 600 }}
               >
                 <Square size={16} fill="currentColor" /> Stop
               </button>
            ) : (
               <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                 {/* Voice Wave Animation */}
                 <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '20px' }}>
                    {[1,2,3,4].map(i => (
                      <motion.div 
                        key={i}
                        animate={isListening ? { height: [4, 16, 4] } : { height: 4 }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        style={{ width: '4px', background: isListening ? '#34D399' : 'rgba(255,255,255,0.2)', borderRadius: '2px' }}
                      />
                    ))}
                 </div>
                 <span style={{ fontSize: "13px", color: isListening ? "#34D399" : "var(--text-secondary)", fontWeight: 500 }}>
                   {isListening ? "Listening..." : "Tap mic to speak"}
                 </span>
               </div>
            )}

            {!isSpeaking && (
              <button 
                onClick={toggleListening}
                style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isListening ? 'rgba(52, 211, 153, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                  border: isListening ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid rgba(99, 102, 241, 0.3)',
                  color: isListening ? '#34D399' : '#818CF8',
                  position: 'relative',
                  transition: 'all 0.2s',
                  boxShadow: isListening ? '0 0 15px rgba(52, 211, 153, 0.4)' : 'none'
                }}
              >
                {isListening ? <Mic size={22} /> : <MicOff size={22} />}
                {isListening && (
                  <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1px solid #34D399', animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' }} />
                )}
              </button>
            )}
            
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="chat-composer-form">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t(language, "ask_coverage")}
              className="chat-input"
              disabled={isLoading}
              style={{
                fontSize: "15px",
                padding: "14px 16px",
                borderRadius: "16px",
              }}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={() => { stopGeneration(); interruptSpeech(); navigator.vibrate?.(30); }}
                style={{
                  width: "44px", height: "44px", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.5)",
                  color: "#EF4444",
                  flexShrink: 0,
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
                className={`chat-send ${input.trim() ? "enabled" : ""}`}
                onClick={() => navigator.vibrate?.(10)}
              >
                <Send size={17} color="white" style={{ marginLeft: "1px" }} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
