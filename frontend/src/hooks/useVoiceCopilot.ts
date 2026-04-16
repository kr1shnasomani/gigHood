import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguageStore } from "@/store/languageStore";

type SpeechRecognitionErrorType =
  | "no-speech"
  | "aborted"
  | "audio-capture"
  | "network"
  | "not-allowed"
  | "service-not-allowed"
  | string;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldKeepListeningRef = useRef(false);
  const restartTimerRef = useRef<number | null>(null);

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
      ((window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition) ||
      ((window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition);
    if (!SpeechRecognition) {
      setIsVoiceSupported(false);
      return;
    }

    setIsVoiceSupported(true);
    setListenError(null);

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
    shouldKeepListeningRef.current = false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = LANG_MAP[language] || "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: unknown) => {
      const evt = event as {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      };
      let finalText = "";
      for (let i = evt.resultIndex; i < evt.results.length; i += 1) {
        const result = evt.results[i];
        if (result.isFinal) {
          finalText += `${result[0].transcript} `;
        }
      }
      const cleaned = finalText.trim();
      if (cleaned) {
        onTranscriptRef.current(cleaned);
        shouldKeepListeningRef.current = false;
        try {
          recognition.stop();
        } catch {
          /* noop */
        }
      }
    };

    recognition.onerror = (e: unknown) => {
      const errorType =
        (e as { error?: SpeechRecognitionErrorType } | undefined)?.error ?? "unknown";

      // 'no-speech' is non-fatal — the browser fires it when it hears silence.
      // Do not reset isListening; let it keep going (continuous mode).
      if (errorType === "no-speech" || errorType === "aborted") return;

      // These are fatal — mic permission denied, hardware lost, etc.
      console.warn(`[VoiceCopilot] Speech recognition error: ${errorType}`);
      if (errorType === "not-allowed" || errorType === "service-not-allowed") {
        setListenError("Microphone permission is blocked. Enable mic access in browser settings.");
      } else if (errorType === "audio-capture") {
        setListenError("No microphone detected. Please check your audio input device.");
      } else if (errorType === "network") {
        setListenError("Speech network error. Please try again with a stable connection.");
      } else {
        setListenError("Voice input failed. Please try again.");
      }
      shouldKeepListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current) {
        if (restartTimerRef.current !== null) {
          window.clearTimeout(restartTimerRef.current);
        }
        restartTimerRef.current = window.setTimeout(() => {
          try {
            recognition.start();
            setIsListening(true);
          } catch {
            setIsListening(false);
            shouldKeepListeningRef.current = false;
          }
        }, 220);
        return;
      }
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
      if (restartTimerRef.current !== null) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      shouldKeepListeningRef.current = false;
      setIsListening(false);
    };
  }, [language]); // ← onTranscript intentionally omitted; accessed via ref above

  const toggleListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setListenError("Voice recognition is not supported in this browser.");
      return;
    }
    if (isListening) {
      shouldKeepListeningRef.current = false;
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        setListenError(null);
        shouldKeepListeningRef.current = true;
        recognition.start();
        setIsListening(true);
      } catch (e) {
        shouldKeepListeningRef.current = false;
        console.warn("[VoiceCopilot] Could not start recognition:", e);
        setListenError("Unable to start microphone. Please try again.");
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
    isVoiceSupported,
    listenError,
    toggleListening,
    speak,
    interruptSpeech,
  };
}
