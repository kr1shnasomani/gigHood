'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { workerApi, type Claim } from '../../../lib/worker';
import api from '../../../lib/api';
import { useLanguageStore, type AppLanguage } from '../../../store/languageStore';
import { t } from '../../../lib/i18n';

type Message = { role: 'user' | 'assistant'; content: string };

const WELCOME_MESSAGES: Record<AppLanguage, string> = {
  en: "Namaste! I'm your Gig Copilot. I can explain your policy, your current zone risk, and your claim history. How can I help?",
  hi: 'नमस्ते! मैं आपका Gig Copilot हूं। मैं आपकी पॉलिसी, आपके क्षेत्र का जोखिम और आपके क्लेम इतिहास को समझाने में मदद कर सकता हूं। मैं कैसे मदद करूं?',
  ta: 'வணக்கம்! நான் உங்கள் Gig Copilot. உங்கள் பாலிசி, உங்கள் பகுதியில் உள்ள அபாயம், மற்றும் உங்கள் கிளைம் வரலாறு பற்றி விளக்க முடியும். எப்படி உதவலாம்?',
  te: 'నమస్తే! నేను మీ Gig Copilot. మీ పాలసీ, మీ ప్రాంతపు రిస్క్, మరియు మీ క్లెయిమ్ చరిత్ర గురించి వివరించగలను. నేను ఎలా సహాయం చేయగలను?',
  kn: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ Gig Copilot. ನಿಮ್ಮ ಪಾಲಿಸಿ, ನಿಮ್ಮ ಪ್ರದೇಶದ ಅಪಾಯ, ಮತ್ತು ನಿಮ್ಮ ಕ್ಲೈಮ್ ಇತಿಹಾಸವನ್ನು ವಿವರಿಸಬಹುದು. ನಾನು ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?',
  mr: 'नमस्कार! मी तुमचा Gig Copilot आहे. तुमची पॉलिसी, क्षेत्राचा धोका आणि क्लेम इतिहास समजावून सांगू शकतो. मी कशी मदत करू?',
  bn: 'নমস্কার! আমি আপনার Gig Copilot। আপনার পলিসি, জোন ঝুঁকি এবং ক্লেম ইতিহাস ব্যাখ্যা করতে পারি। কীভাবে সাহায্য করতে পারি?',
  as: 'নমস্কাৰ! মই আপোনাৰ Gig Copilot। আপোনাৰ পলিচি, জোন ঝুঁকি আৰু ক্লেইম ইতিহাস ব্যাখ্যা কৰিব পাৰো। কেনেকৈ সহায় কৰিম?',
};

function isNetworkError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return !('response' in error);
}

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
              width: '7px',
              height: '7px',
              borderRadius: '50%',
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

export default function ChatPage() {
  const language = useLanguageStore((s) => s.language);
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME_MESSAGES.en }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chipsSent, setChipsSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: claims } = useQuery<Claim[]>({
    queryKey: ['claims'],
    queryFn: workerApi.getClaims,
    staleTime: 60000,
  });

  const lastPaidClaim = claims?.find((c) => c.status === 'paid' || c.status === 'approved');
  const dynamicSuggestions = [
    lastPaidClaim
      ? `Why was my last payout ₹${lastPaidClaim.payout_amount.toLocaleString('en-IN')}?`
      : 'How are my payouts calculated?',
    'What is my current zone risk?',
    'When does my policy renew?',
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
    if (!chipsSent) {
      setMessages([{ role: 'assistant', content: WELCOME_MESSAGES[language] ?? WELCOME_MESSAGES.en }]);
    }
  }, [language, chipsSent]);

  const sendMessage = async (text: string) => {
    const userMsg = text.trim();
    if (!userMsg || isLoading) return;

    setInput('');
    setChipsSent(true);
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await api.post('/chat', { message: userMsg, language });
      const reply = res.data.reply ?? res.data.response ?? '';
      if (!reply) throw new Error('empty reply');
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: unknown) {
      const isNetworkErr = isNetworkError(err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: isNetworkErr
            ? "Sorry, I'm having trouble connecting right now. Please try again in a moment."
            : 'Sorry, something went wrong on my end. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="chat-page">
      <header className="stagger-1 chat-header">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.5px' }}>Gig Copilot</h2>
          <p style={{ fontSize: '12px', color: 'var(--trust-emerald)', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--trust-emerald)', boxShadow: '0 0 8px var(--trust-emerald)', flexShrink: 0, animation: 'pulseGlow 2s infinite' }} />
            {t(language, 'ai_assistant_online')}
          </p>
        </div>
      </header>

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

              <div className={`chat-bubble ${isUser ? 'user' : 'assistant'}`}>{msg.content}</div>
            </div>
          );
        })}

        {isLoading && <TypingIndicator />}

        {!chipsSent && !isLoading && (
          <div style={{ marginTop: '8px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>Suggested</p>
            <div className="suggestions">
              {dynamicSuggestions.map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)} className="suggestion-chip">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chat-composer">
        <form onSubmit={handleSubmit} className="chat-composer-form">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t(language, 'ask_coverage')}
            className="chat-input"
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading || !input.trim()} className={`chat-send ${input.trim() && !isLoading ? 'enabled' : ''}`}>
            <Send size={17} color="white" style={{ marginLeft: '1px' }} />
          </button>
        </form>
      </div>
    </div>
  );
}
