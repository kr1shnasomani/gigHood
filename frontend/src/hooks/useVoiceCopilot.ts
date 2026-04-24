import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguageStore } from "@/store/languageStore";

export function useVoiceCopilot(onTranscript: (text: string) => void) {
  const language = useLanguageStore((s) => s.language);
  const [isListening, setIsListening] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const [listenError, setListenError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVoiceSupported(true);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVoiceSupported(false);
    }
  }, []);

  const toggleListening = useCallback(async () => {
    setListenError(null);

    // Stop recording
    if (isListening && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      return;
    }

    // Start recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        audioChunksRef.current = [];
        
        // Stop all tracks to release the mic
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        if (audioBlob.size < 500) {
           return; // Too short to transcribe
        }

        setIsAudioLoading(true);
        try {
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.webm");
          formData.append("language", language);

          const res = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
             throw new Error(`STT HTTP Error: ${res.status}`);
          }
          
          const data = await res.json();
          const transcript = data.transcript;
          if (transcript && transcript.trim()) {
            onTranscriptRef.current(transcript.trim());
          }
        } catch (error) {
          console.error("[VoiceCopilot] STT error:", error);
          setListenError("Voice service is currently unavailable. Please try again.");
        } finally {
          setIsAudioLoading(false);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (e) {
      console.warn("[VoiceCopilot] Could not start microphone:", e);
      setListenError("Unable to access microphone. Please check permissions.");
      setIsListening(false);
    }
  }, [isListening, language]);

  return {
    isListening,
    isAudioLoading,
    isVoiceSupported,
    listenError,
    toggleListening,
  };
}
