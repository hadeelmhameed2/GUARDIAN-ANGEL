import { useRouter } from 'expo-router';
import { ArrowLeft, Save, Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Fonts, Palette, Radii, Shadow, Spacing } from '@/constants/theme';
import { apiFetch, isApiConfigured } from '@/src/api';
import { upsertEvidenceEntry } from '@/src/journal-storage';
import { useVoiceDrafts } from '@/src/voice-draft-context';
import {
  isVoiceTriggerEnabled,
  isVoiceTriggerSupported,
  primeMicrophonePermission,
  setVoiceTriggerEnabled,
} from '@/src/voice-trigger';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Lists voice-trigger drafts recorded silently by the Calculator screen
 * (src/voice-trigger.ts, via the shared VoiceDraftProvider context) and
 * hosts the "Enable Calculator Voice Trigger" toggle. This screen no longer
 * runs any listening/recording logic itself — that all happens in the
 * background on the Calculator screen so the disguise never has to show a
 * "listening" UI.
 */
export default function DraftsScreen() {
  const router = useRouter();
  const { drafts, removeDraft } = useVoiceDrafts();
  const [triggerEnabled, setTriggerEnabled] = useState(() => isVoiceTriggerEnabled());
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const isSupported = isVoiceTriggerSupported();

  const handleBack = () => {
    router.back();
  };

  const handleQuickExit = () => {
    router.replace('/(tabs)');
  };

  const handleToggleTrigger = async (next: boolean) => {
    if (!next) {
      setVoiceTriggerEnabled(false);
      setTriggerEnabled(false);
      return;
    }
    // Request the mic permission here, once, on this screen — so the
    // browser's permission prompt never has to appear on the Calculator
    // screen and blow the disguise.
    setIsRequestingPermission(true);
    const granted = await primeMicrophonePermission();
    setIsRequestingPermission(false);
    if (!granted) {
      Alert.alert(
        'Microphone blocked',
        'Guardian Angel needs microphone access to arm the calculator voice trigger.',
      );
      return;
    }
    setVoiceTriggerEnabled(true);
    setTriggerEnabled(true);
  };

  const handleDelete = (id: string) => {
    removeDraft(id);
  };

  const handleSave = async (id: string) => {
    const draft = drafts.find((item) => item.id === id);
    if (!draft) return;

    if (!isApiConfigured()) {
      Alert.alert('Server not configured', 'Set EXPO_PUBLIC_API_BASE_URL to save entries to your journal.');
      return;
    }

    setSavingIds((prev) => new Set(prev).add(id));
    try {
      // Blob URLs don't survive an app reload, so the draft is converted to
      // a Base64 string and written to localStorage — that's what makes it
      // durably playable from the Journal screen. The audio itself is still
      // never sent anywhere; only a metadata pointer (the storage key) is.
      const base64 = await blobToDataUrl(draft.blob);
      const storageKey = `voice_record_${draft.id}`;
      window.localStorage.setItem(storageKey, base64);

      const timestampIso = new Date(draft.timestamp).toISOString();

      // Makes the recording show up (and be playable) on the main Journal
      // screen — that screen reads this same encrypted local journal.
      const journaled = await upsertEvidenceEntry({
        id: draft.id,
        description: storageKey,
        timestamp: timestampIso,
        entryType: 'Voice Emergency',
      });
      if (!journaled) {
        throw new Error('Failed to write local journal entry');
      }

      // Best-effort mirror to the server audit trail — must not block or
      // fail the save itself. The local write above is the source of truth
      // and is already what makes the recording visible/playable in the
      // Journal, so a network hiccup (or this route not existing yet) here
      // should never make "Save" report failure or leave the draft stuck.
      try {
        const response = await apiFetch('/api/journal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            entry_type: 'Voice Emergency',
            description: storageKey,
            timestamp: timestampIso,
          }),
        });
        if (!response.ok) {
          console.warn('[DraftsScreen] /api/journal mirror failed', response.status);
        }
      } catch (err) {
        console.warn('[DraftsScreen] /api/journal mirror failed', err);
      }

      removeDraft(id);
    } catch {
      Alert.alert('Save failed', 'Could not log this event. The draft is still here if you want to retry.');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.iconButton} onPress={handleBack} accessibilityLabel="Back">
            <ArrowLeft size={19} color={Palette.inkSoft} strokeWidth={2.25} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drafts</Text>
          <TouchableOpacity style={styles.iconButton} onPress={handleQuickExit} accessibilityLabel="Exit">
            <X size={17} color={Palette.inkSoft} strokeWidth={2.25} />
          </TouchableOpacity>
        </View>

        {!isSupported ? (
          <View style={[styles.card, styles.unsupportedCard]}>
            <Text style={styles.unsupportedText}>
              Voice trigger recording needs a browser with Speech Recognition and microphone support.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.title}>Voice Emergency Trigger</Text>
            <Text style={styles.subtitle}>
              When armed, the Calculator screen silently listens for “הצילו” or “עזרה” in the background — no
              listening indicator is ever shown there, so the disguise stays intact.
            </Text>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Enable Calculator Voice Trigger</Text>
              {isRequestingPermission ? (
                <ActivityIndicator size="small" color={Palette.primary} />
              ) : (
                <Switch
                  value={triggerEnabled}
                  onValueChange={(next) => void handleToggleTrigger(next)}
                  trackColor={{ false: Palette.border, true: Palette.sageSoft }}
                  thumbColor={triggerEnabled ? Palette.sage : Palette.surface}
                  accessibilityLabel="Enable Calculator Voice Trigger"
                />
              )}
            </View>
          </View>
        )}

        <View style={styles.draftsSection}>
          <Text style={styles.draftsSectionTitle}>
            {drafts.length > 0 ? `Recorded drafts (${drafts.length})` : 'Recorded drafts'}
          </Text>

          {drafts.length === 0 ? (
            <Text style={styles.emptyText}>
              No drafts yet. Recordings triggered by the voice command on the Calculator screen will show up here.
            </Text>
          ) : (
            drafts.map((draft) => {
              const isSaving = savingIds.has(draft.id);
              return (
                <View key={draft.id} style={styles.draftCard}>
                  <Text style={styles.draftLabel}>{new Date(draft.timestamp).toLocaleString()}</Text>

                  {/* Native <audio> element: Expo Web (react-native-web) renders raw
                      HTML tags straight through, so this only needs the web guard. */}
                  {Platform.OS === 'web' ? (
                    <audio controls src={draft.url} style={{ width: '100%' }} />
                  ) : null}

                  <View style={styles.draftActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(draft.id)}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Delete draft recording"
                    >
                      <Trash2 size={18} color={Palette.onPrimary} />
                      <Text style={styles.actionButtonText}>Delete</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.saveButton]}
                      onPress={() => void handleSave(draft.id)}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityLabel="Save recording to journal"
                    >
                      {isSaving ? (
                        <ActivityIndicator size="small" color={Palette.onPrimary} />
                      ) : (
                        <>
                          <Save size={18} color={Palette.onPrimary} />
                          <Text style={styles.actionButtonText}>Save</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.bgCream,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    fontWeight: '700',
    color: Palette.ink,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.soft,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    fontWeight: '700',
    color: Palette.ink,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Palette.inkMuted,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  switchLabel: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  draftsSection: {
    gap: Spacing.md,
  },
  draftsSectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: Palette.ink,
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Palette.inkMuted,
  },
  draftCard: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.soft,
  },
  draftLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.inkSoft,
  },
  draftActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
  },
  deleteButton: {
    backgroundColor: Palette.statusRedInk,
  },
  saveButton: {
    backgroundColor: Palette.sage,
  },
  actionButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.onPrimary,
  },
  unsupportedCard: {
    borderColor: Palette.borderStrong,
  },
  unsupportedText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Palette.inkMuted,
  },
});
