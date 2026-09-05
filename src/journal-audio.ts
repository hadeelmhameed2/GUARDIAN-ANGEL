import {
  AudioModule,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
} from 'expo-audio';
import { Alert, Platform } from 'react-native';

export type CapturedAudio = {
  base64: string;
  durationSec: number;
};

let activeRecording: AudioRecorder | null = null;
let startedAt = 0;

export async function startNativeRecording(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone needed', 'Allow microphone access to record voice notes.');
      return false;
    }
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
    });
    const recorder = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
    await recorder.prepareToRecordAsync();
    recorder.record();
    activeRecording = recorder;
    startedAt = Date.now();
    return true;
  } catch {
    Alert.alert('Recording error', 'Could not start recording.');
    activeRecording = null;
    return false;
  }
}

export async function stopNativeRecording(): Promise<CapturedAudio | null> {
  const recording = activeRecording;
  if (!recording) return null;
  try {
    await recording.stop();
  } catch {
    // ignore — we still want to try to retrieve the URI
  }
  const uri = recording.uri;
  const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  activeRecording = null;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {
    // ignore — mode reset is best-effort
  }
  if (!uri) return null;
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await blobToDataUrl(blob);
    return { base64, durationSec };
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
