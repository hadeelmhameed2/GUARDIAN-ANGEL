import { Pause, Play } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

import { Palette } from '@/constants/theme';

type Props = {
  uri: string;
  durationSec?: number;
};

function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return '0:00';
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function extractDataUri(source: string): { base64: string; extension: string } | null {
  const match = source.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1];
  const base64 = match[2];
  const extension = mime.includes('mp4') || mime.includes('aac')
    ? 'm4a'
    : mime.includes('wav')
      ? 'wav'
      : mime.includes('mpeg')
        ? 'mp3'
        : mime.includes('caf')
          ? 'caf'
          : 'm4a';
  return { base64, extension };
}

function hashString(input: string): string {
  let h = 0;
  for (let i = 0; i < Math.min(input.length, 2048); i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function materializeSource(source: string): string {
  if (!source.startsWith('data:')) return source;
  const parsed = extractDataUri(source);
  if (!parsed) return source;
  try {
    const name = `journal-audio-${hashString(source)}.${parsed.extension}`;
    const file = new File(Paths.cache, name);
    if (!file.exists) {
      file.create();
      file.write(parsed.base64, { encoding: 'base64' });
    }
    return file.uri;
  } catch {
    return source;
  }
}

export function NativeAudioPlayer({ uri, durationSec }: Props) {
  const [resolvedUri, setResolvedUri] = useState<string>(() => materializeSource(uri));

  useEffect(() => {
    setResolvedUri(materializeSource(uri));
  }, [uri]);

  const source = useMemo(() => ({ uri: resolvedUri }), [resolvedUri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // ignore
      }
    };
  }, [player]);

  const isPlaying = status.playing;
  const current = status.currentTime ?? 0;
  const total = status.duration || durationSec || 0;
  const reachedEnd = total > 0 && current >= total - 0.05;

  const handlePress = async () => {
    try {
      if (isPlaying) {
        player.pause();
        return;
      }
      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } catch {
        // best-effort
      }
      if (reachedEnd) {
        void player.seekTo(0);
      }
      player.play();
    } catch {
      // ignore playback errors
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => void handlePress()}
        style={styles.button}
        accessibilityLabel={isPlaying ? 'Pause recording' : 'Play recording'}>
        {isPlaying ? (
          <Pause size={14} color={Palette.primaryDeep} strokeWidth={2.25} fill={Palette.primaryDeep} />
        ) : (
          <Play size={14} color={Palette.primaryDeep} strokeWidth={2.25} fill={Palette.primaryDeep} />
        )}
      </TouchableOpacity>
      <Text style={styles.time}>
        {formatSeconds(current)} / {formatSeconds(total)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(210, 84, 40, 0.12)',
  },
  time: {
    fontSize: 12,
    color: Palette.inkSoft,
    fontVariant: ['tabular-nums'],
  },
});
