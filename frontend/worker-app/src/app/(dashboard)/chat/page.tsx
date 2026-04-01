'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { workerApi } from '@/lib/worker';
import api from '@/lib/api';

// ── Types ──────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant'; content: string };

function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return !('response' in error);
}

const LANGUAGES = [
  { code: 'en', label: 'ENG' },
  { code: 'hi', label: 'HIN' },
  { code: 'ta', label: 'TAM' },
  { code: 'te', label: 'TEL' },
  { code: 'kn', label: 'KAN' },
];

// ── Typing indicator ───────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="chat-row">
      <div className="chat-avatar" style={{ background: 'rgba(20, 184, 166, 0.2)', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
        <Bot size={18} color="#5EEAD4" />
      </div>
      <div className="chat-bubble assistant" style={{ padding: '14px 20px', display: 'flex', gap: '5px', alignItems: 'center' }}>
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: '#A78BFA',
              animation: 'typingDot 1.4s ease-in-out infinite',
              animationDelay: `${delay}s`,
              display: 'inline-block',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Namaste! I\'m your Gig Copilot. I can explain your policy, your current zone risk, and your claim history. How can I help?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState('en');
  const [chipsSent, setChipsSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Fetch last payout for dynamic suggestion ───────────────
  const { data: claims } = useQuery({
    queryKey: ['claims'],
    queryFn: workerApi.getClaims,
    staleTime: 60000,
  });
  const lastPaidClaim = claims?.find(c => c.status === 'paid' || c.status === 'approved');
  const dynamicSuggestions = [
    lastPaidClaim
      ? `Why was my last payout ₹${lastPaidClaim.payout_amount.toLocaleString('en-IN')}?`
      : 'How are my payouts calculated?',
    'What is my current zone risk?',
    'When does my policy renew?',
  ];

  // ── Auto-scroll ────────────────────────────────────────────
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

  // ── Send message ───────────────────────────────────────────
  const sendMessage = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isLoading) return;

    setInput('');
    setChipsSent(true);
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      // The backend injects worker context (policy, DCI, claims) automatically
      // via build_context(worker_id) using the auth JWT — no extra params needed
      const res = await api.post('/chat', { message: userMsg, language: lang });
      const reply = res.data.reply ?? res.data.response ?? '';

      if (!reply) throw new Error('empty reply');

      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      const isNetworkErr = isNetworkError(err);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: isNetworkErr
            ? "Sorry, I'm having trouble connecting right now. Please try again in a moment."
            : "Sorry, something went wrong on my end. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
      // re-focus input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="chat-page">

        {/* Header */}
        <header className="stagger-1 chat-header">
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>Gig Copilot</h2>
            <p style={{ fontSize: '12px', color: 'var(--trust-emerald)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--trust-emerald)', boxShadow: '0 0 8px var(--trust-emerald)', flexShrink: 0, animation: 'pulseGlow 2s infinite' }} />
              AI Assistant Online
            </p>
          </div>

          {/* Language selector */}
          <div style={{ position: 'relative' }}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              style={{
                padding: '8px 32px 8px 14px', appearance: 'none', WebkitAppearance: 'none',
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-glass)',
                borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
              }}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code} style={{ background: '#0f172a' }}>{l.label}</option>
              ))}
            </select>
            <Globe size={14} color="var(--text-muted)" style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </header>

        {/* Messages area */}
        <div ref={scrollRef} className="stagger-2 chat-messages">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={index} className={`chat-row ${isUser ? 'user' : ''}`}>
                <div
                  className="chat-avatar"
                  style={{
                    background: isUser ? 'rgba(14, 165, 233, 0.2)' : 'rgba(20, 184, 166, 0.18)',
                    border: `1px solid ${isUser ? 'rgba(14,165,233,0.3)' : 'rgba(20,184,166,0.3)'}`,
                  }}
                >
                  {isUser ? <User size={16} color="#7DD3FC" /> : <Bot size={16} color="#5EEAD4" />}
                </div>

                <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>
                  {msg.content}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && <TypingIndicator />}

          {/* Suggestion chips — shown only before first user message */}
          {!chipsSent && !isLoading && (
            <div style={{ marginTop: '8px' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>Suggested</p>
              <div className="suggestions">
              {dynamicSuggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="suggestion-chip"
                >
                  {q}
                </button>
              ))}
              </div>
            </div>
          )}
        </div>

        {/* Input bar — fixed above bottom nav */}
        <div className="chat-composer">
          <form onSubmit={handleSubmit} className="chat-composer-form">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your coverage..."
              className="chat-input"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={`chat-send ${input.trim() && !isLoading ? 'enabled' : ''}`}
            >
              <Send size={17} color="white" style={{ marginLeft: '1px' }} />
            </button>
          </form>
        </div>
    </div>
  );
}
