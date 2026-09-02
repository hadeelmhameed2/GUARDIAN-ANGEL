import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const TRIGGER_WORDS = ['הצילו', 'עזרה'];
const RECORDING_DURATION_MS = 10_000;
const RECOGNITION_LANG = 'he-IL';

/** localStorage flag: does the disguised Calculator screen arm the background voice trigger on mount? */
export const VOICE_TRIGGER_ENABLED_KEY = 'voice_trigger_enabled';

export type VoiceDraft = {
  id: string;
  blob: Blob;
  url: string;
  timestamp: number;
};

// The Web Speech API (SpeechRecognition) isn't part of TypeScript's DOM lib
// yet, so its shape is declared locally — just enough of it to drive the
// trigger without pulling in a third-party ambient types package.
type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { [index: number]: { transcript: string } };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  // Chrome/Edge/Safari only ship the prefixed global; Firefox has neither.
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceTriggerSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    !!getSpeechRecognitionCtor() &&
    !!navigator?.mediaDevices?.getUserMedia
  );
}

export function isVoiceTriggerEnabled(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(VOICE_TRIGGER_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setVoiceTriggerEnabled(enabled: boolean): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(VOICE_TRIGGER_ENABLED_KEY, 'true');
    } else {
      window.localStorage.removeItem(VOICE_TRIGGER_ENABLED_KEY);
    }
  } catch {
    // Ignore — worst case the toggle doesn't persist across reloads.
  }
}

/**
 * Requests microphone access once (so the browser's permission prompt fires
 * here, on the Drafts screen) and immediately releases the stream. Later,
 * silent `getUserMedia` calls from the Calculator screen reuse the
 * already-granted permission without prompting again — that's what keeps
 * the disguise intact.
 */
export async function primeMicrophonePermission(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch {
    return false;
  }
}

function createDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Silent background voice trigger for the disguised Calculator screen.
 *
 * On mount, if `voice_trigger_enabled` was set (via the Drafts screen
 * toggle), starts the Web Speech API listening for the Hebrew trigger words
 * with zero UI feedback — the calculator must look and behave exactly like
 * a calculator the entire time. On a match, it silently records 10s of
 * audio via MediaRecorder and hands the result to `onDraftRecorded`
 * (wired to the shared voice-draft context so the Drafts screen can list
 * it). Never shows an Alert — a permission popup or error dialog here
 * would blow the disguise, so every failure just fails quietly.
 */
export function useVoiceEmergencyTrigger(onDraftRecorded: (draft: VoiceDraft) => void): void {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onDraftRecordedRef = useRef(onDraftRecorded);
  onDraftRecordedRef.current = onDraftRecorded;

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        onDraftRecordedRef.current({ id: createDraftId(), blob, url, timestamp: Date.now() });
        cleanupStream();
      };

      recorder.start();
      stopTimerRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, RECORDING_DURATION_MS);
    } catch {
      // Silent by design — see the function doc comment above.
      cleanupStream();
    }
  }, [cleanupStream]);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionCtor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = RECOGNITION_LANG;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript ?? '';
        if (TRIGGER_WORDS.some((word) => transcript.includes(word))) {
          const active = recognitionRef.current;
          recognitionRef.current = null;
          active?.stop();
          void startRecording();
          return;
        }
      }
    };

    recognition.onerror = () => {
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      // Some browsers end recognition after a pause in speech even with
      // `continuous: true`. Restart automatically while still armed.
      if (recognitionRef.current === recognition) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [startRecording]);

  useEffect(() => {
    if (!isVoiceTriggerEnabled()) return;
    startListening();
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition?.stop();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      cleanupStream();
    };
    // Intentionally mount-only: the Calculator screen checks the flag once
    // when it mounts, per the stealth-mode design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
