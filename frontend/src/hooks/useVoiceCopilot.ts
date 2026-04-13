import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguageStore } from "@/store/languageStore";
import { API_BASE_URL } from "@/lib/api";

const audioCache = new Map<string, string>();

const LANG_MAP: Record<string, string> = {
  en: "en-US",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  as: "as-IN",
};

export function useVoiceCopilot(onTranscript: (text: string) => void) {
  const language = useLanguageStore((s) => s.language);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Store onTranscript in a ref so it never appears in the useEffect dep array.
  // Without this, every render of the parent creates a new inline callback,
  // causing the effect to tear down and recreate the recognition instance —
  // which triggers a cascade of "aborted" SpeechRecognitionErrorEvents.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Build the recognition instance only when language changes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    // Tear down any previous instance cleanly before creating a new one.
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
    setIsListening(false);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = LANG_MAP[language] || "en-US";

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const text = event.results[last][0].transcript;
      if (text.trim()) {
        onTranscriptRef.current(text.trim());
      }
    };

    recognition.onerror = (e: any) => {
      const errorType: string = e?.error ?? "unknown";

      // 'no-speech' is non-fatal — the browser fires it when it hears silence.
      // Do not reset isListening; let it keep going (continuous mode).
      if (errorType === "no-speech") return;

      // These are fatal — mic permission denied, hardware lost, etc.
      console.warn(`[VoiceCopilot] Speech recognition error: ${errorType}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    // Cleanup: abort recognition when language changes or component unmounts.
    return () => {
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
      setIsListening(false);
    };
  }, [language]); // ← onTranscript intentionally omitted; accessed via ref above

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      alert("Voice recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        console.warn("[VoiceCopilot] Could not start recognition:", e);
      }
    }
  }, [isListening]);

  const interruptSpeech = useCallback(() => {
    // Stop ElevenLabs / cached audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser speechSynthesis fallback
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsAudioLoading(false);
  }, []);

  // Browser TTS fallback (used when ElevenLabs key is absent or call fails)
  const browserSpeak = useCallback(
    (text: string, overrideLang?: string) => {
      setIsAudioLoading(false);
      if (typeof window === "undefined" || !window.speechSynthesis) {
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = LANG_MAP[overrideLang || language] || "en-US";

      // Attempt to find a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(
        (v) =>
          v.lang.startsWith(utt.lang.split("-")[0]) &&
          (v.name.toLowerCase().includes("female") ||
            v.name.toLowerCase().includes("woman")),
      );
      if (femaleVoice) utt.voice = femaleVoice;

      utt.rate = 1.05;
      utt.onend = () => setIsSpeaking(false);
      utt.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utt);
    },
    [language],
  );

  // ElevenLabs TTS layer (with browser fallback)
  const speak = useCallback(
    async (payload: string | { text: string; lang: string }) => {
      interruptSpeech();

      const textToSpeak = typeof payload === "string" ? payload : payload.text;
      const reqLang = typeof payload === "string" ? language : payload.lang;

      // Clean markdown, code blocks, etc.
      const cleanSpeech = textToSpeak
        .replace(/[\*\_\`\#]/g, "") // Remove *, _, `, #
        .replace(/\n+/g, " ") // Replace newlines with spaces
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Simplify markdown links to just the text
        .trim();

      if (!cleanSpeech) return;

      setIsAudioLoading(true);

      try {
        if (audioCache.has(cleanSpeech)) {
          const audioUrl = audioCache.get(cleanSpeech)!;
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          setIsAudioLoading(false);
          setIsSpeaking(true);
          audio.play();
          return;
        }

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Note: Here "female" voice param could be passed down to backend or backend might default to a female voice.
          body: JSON.stringify({
            text: cleanSpeech,
            gender: "female",
            language: reqLang,
          }),
        });

        // 204 = no ElevenLabs key configured — fall back to browser TTS silently
        if (res.status === 204) {
          browserSpeak(cleanSpeech, reqLang);
          return;
        }

        if (!res.ok) throw new Error(`TTS API ${res.status}`);

        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        audioCache.set(cleanSpeech, audioUrl);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          browserSpeak(cleanSpeech, reqLang);
        };

        setIsAudioLoading(false);
        setIsSpeaking(true);
        audio.play();
      } catch {
        // Any network/API failure → silent fallback to browser TTS
        setIsAudioLoading(false);
        browserSpeak(cleanSpeech, reqLang);
      }
    },
    [interruptSpeech, browserSpeak, language],
  );

  return {
    isListening,
    isSpeaking,
    isAudioLoading,
    toggleListening,
    speak,
    interruptSpeech,
  };
}
