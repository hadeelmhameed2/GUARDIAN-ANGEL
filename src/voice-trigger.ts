import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

const TRIGGER_WORDS = ['הצילו', 'עזרה'];
const RECORDING_DURATION_MS = 10_000;
const RECOGNITION_LANG = 'he-IL';

// Native scream detection: metering value (dB) that counts as "loud enough".
// iOS/Android AVAudioRecorder metering ranges from ~-160 dB (silent) to 0 dB
// (peak). Normal speech sits around -30 to -20; a scream lands around -10.
// -18 catches actual shouts while ignoring background chatter.
const NATIVE_SCREAM_DB_THRESHOLD = -18;
// Sustain — number of consecutive loud metering samples required before we
// treat it as a scream. One frame is ~100ms; three frames = ~300ms of
// sustained loudness (a door slam or cough is usually one sharp frame).
const NATIVE_SCREAM_SUSTAIN_FRAMES = 3;

/** Persisted flag: does the disguised Calculator screen arm the background voice trigger when focused? */
export const VOICE_TRIGGER_ENABLED_KEY = 'voice_trigger_enabled';

export type VoiceDraft = {
  id: string;
  timestamp: number;
  // Web path
  blob?: Blob;
  url?: string;
  // Native path
  nativeUri?: string;
  nativeBase64?: string;
  durationSec?: number;
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
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceTriggerSupported(): boolean {
  if (Platform.OS === 'web') {
    return (
      typeof window !== 'undefined' &&
      !!getSpeechRecognitionCtor() &&
      !!navigator?.mediaDevices?.getUserMedia
    );
  }
  // Native: expo-audio recording + metering is available on iOS and Android.
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function readEnabledFlagSync(): boolean {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      return window.localStorage.getItem(VOICE_TRIGGER_ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

export function isVoiceTriggerEnabled(): boolean {
  // Sync read only works on web (localStorage is sync). On native this
  // always reports false — use isVoiceTriggerEnabledAsync there, otherwise
  // the UI renders "off" while the stored flag says "on".
  return readEnabledFlagSync();
}

async function readEnabledFlagAsync(): Promise<boolean> {
  if (Platform.OS === 'web') return readEnabledFlagSync();
  try {
    return (await AsyncStorage.getItem(VOICE_TRIGGER_ENABLED_KEY)) === 'true';
  } catch {
    return false;
  }
}

/** Reads the persisted arm flag on either platform. */
export function isVoiceTriggerEnabledAsync(): Promise<boolean> {
  return readEnabledFlagAsync();
}

export async function setVoiceTriggerEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    try {
      if (enabled) {
        window.localStorage.setItem(VOICE_TRIGGER_ENABLED_KEY, 'true');
      } else {
        window.localStorage.removeItem(VOICE_TRIGGER_ENABLED_KEY);
      }
    } catch {
      // Ignore — worst case the toggle doesn't persist across reloads.
    }
    return;
  }
  try {
    await AsyncStorage.setItem(VOICE_TRIGGER_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore — worst case the toggle doesn't persist across restarts.
  }
}

/**
 * Requests microphone access once (so the browser/OS permission prompt fires
 * here, on the Drafts screen) and releases the stream. Later, silent
 * getUserMedia / recorder starts from the Calculator screen reuse the
 * already-granted permission without prompting again — that's what keeps
 * the disguise intact.
 */
export async function primeMicrophonePermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }
  try {
    const permission = await requestRecordingPermissionsAsync();
    return !!permission.granted;
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
 * Whenever the screen gains focus, if `voice_trigger_enabled` was set (via
 * the Drafts screen toggle), starts listening with zero UI feedback — the
 * calculator must look and behave exactly like a calculator the entire
 * time. Listening stops as soon as the screen loses focus.
 *
 * Web: Web Speech API listens for the Hebrew trigger words `הצילו` / `עזרה`.
 * Native (iOS/Android): expo-audio recorder with metering watches for a
 *   sustained loud sound (a scream) — Expo Go can't do on-device Hebrew
 *   speech recognition without a dev build, so this catches the intent
 *   ("someone is shouting for help") without the language dependency.
 *
 * On trigger, records 10s of audio and hands the result to `onDraftRecorded`
 * (wired to the shared voice-draft context so the Drafts screen can list
 * it). Never shows an Alert — a permission popup or error dialog here
 * would blow the disguise, so every failure just fails quietly.
 */
export function useVoiceEmergencyTrigger(onDraftRecorded: (draft: VoiceDraft) => void): void {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Native recorder + polling refs
  const nativeRecorderRef = useRef<AudioRecorder | null>(null);
  const nativePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeSustainCountRef = useRef(0);
  const nativeTriggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a second trigger firing while the first 10s capture runs.
  const isTriggeredRef = useRef(false);
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
      if (isTriggeredRef.current) return;
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i]?.[0]?.transcript ?? '';
        if (TRIGGER_WORDS.some((word) => transcript.includes(word))) {
          isTriggeredRef.current = true;
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
      if (recognitionRef.current === recognition) {
        recognition.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [startRecording]);

  const teardownNative = useCallback(() => {
    if (nativeTriggerTimerRef.current) {
      clearTimeout(nativeTriggerTimerRef.current);
      nativeTriggerTimerRef.current = null;
    }
    if (nativePollRef.current) {
      clearInterval(nativePollRef.current);
      nativePollRef.current = null;
    }
    const recorder = nativeRecorderRef.current;
    nativeRecorderRef.current = null;
    if (recorder) {
      try {
        void recorder.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const finaliseNativeDraft = useCallback(async () => {
    if (nativePollRef.current) {
      clearInterval(nativePollRef.current);
      nativePollRef.current = null;
    }
    const recorder = nativeRecorderRef.current;
    if (!recorder) return;
    try {
      await recorder.stop();
    } catch {
      // ignore — still try to grab the URI
    }
    const uri = recorder.uri;
    nativeRecorderRef.current = null;
    if (!uri) return;
    try {
      // The recorder-produced file lives in a temp dir the OS can sweep.
      // Copy it into the app cache under a stable name so the player can
      // replay it later. Use expo-file-system's File.arrayBuffer + write.
      const src = new File(uri);
      const bytes = await src.arrayBuffer();
      const view = new Uint8Array(bytes);
      // Chunked base64 encode to avoid one huge fromCharCode.apply call.
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < view.length; i += chunkSize) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(view.subarray(i, i + chunkSize)),
        );
      }
      const base64 = btoa(binary);
      const dataUri = `data:audio/m4a;base64,${base64}`;

      const draftId = createDraftId();
      let persistedUri = uri;
      try {
        const dest = new File(Paths.cache, `voice-draft-${draftId}.m4a`);
        if (!dest.exists) {
          dest.create();
          dest.write(base64, { encoding: 'base64' });
        }
        persistedUri = dest.uri;
      } catch {
        // fall back to the recorder-provided uri
      }

      onDraftRecordedRef.current({
        id: draftId,
        timestamp: Date.now(),
        nativeUri: persistedUri,
        nativeBase64: dataUri,
        durationSec: Math.round(RECORDING_DURATION_MS / 1000),
      });
    } catch {
      // silent
    }
  }, []);

  const startListeningNative = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const recorder = new AudioModule.AudioRecorder({
        ...RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      nativeRecorderRef.current = recorder;

      await recorder.prepareToRecordAsync();
      recorder.record();

      // Poll the recorder's status every 100ms and watch its metering
      // value. iOS/Android AVAudioRecorder metering is in dB (~-160 quiet,
      // 0 = peak). A sustained loud stretch (3 samples above threshold)
      // triggers the 10s draft capture.
      nativePollRef.current = setInterval(() => {
        if (isTriggeredRef.current) return;
        const active = nativeRecorderRef.current;
        if (!active) return;
        let level: number | undefined;
        try {
          level = active.getStatus().metering;
        } catch {
          return;
        }
        if (typeof level !== 'number') return;
        if (level >= NATIVE_SCREAM_DB_THRESHOLD) {
          nativeSustainCountRef.current += 1;
          if (nativeSustainCountRef.current >= NATIVE_SCREAM_SUSTAIN_FRAMES) {
            isTriggeredRef.current = true;
            // Continue recording for 10 more seconds so the draft captures
            // the whole scream + a moment after.
            nativeTriggerTimerRef.current = setTimeout(() => {
              void finaliseNativeDraft();
            }, RECORDING_DURATION_MS);
          }
        } else {
          // Any quiet frame resets the sustain counter; keeps false positives
          // (a sudden slam or cough) from ever tripping the trigger.
          nativeSustainCountRef.current = 0;
        }
      }, 100);
    } catch {
      teardownNative();
    }
  }, [finaliseNativeDraft, teardownNative]);

  // Arms on focus rather than on mount: the Calculator screen stays mounted
  // underneath the Drafts screen, so a mount-only effect would never see the
  // toggle the user just switched on. Disarming on blur also means the mic is
  // only ever held while the disguise screen is actually showing.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const arm = async () => {
        const enabled = await readEnabledFlagAsync();
        if (cancelled || !enabled) return;
        if (Platform.OS === 'web') {
          startListening();
        } else {
          void startListeningNative();
        }
      };

      void arm();

      return () => {
        cancelled = true;
        const recognition = recognitionRef.current;
        recognitionRef.current = null;
        recognition?.stop();
        if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
        cleanupStream();
        teardownNative();
        isTriggeredRef.current = false;
        nativeSustainCountRef.current = 0;
      };
    }, [cleanupStream, startListening, startListeningNative, teardownNative]),
  );
}
