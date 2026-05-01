import { useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Feather } from '@expo/vector-icons';
import {
  getCurrentStatus,
  addTrustedContact,
  getTrustedContacts,
  hasSecureSessionAccess,
  setTrustedContacts,
  type TrustedContact,
  type RiskState,
} from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getPanicSettings, savePanicSettings } from '@/src/panic-settings';
import {
  BranchTint,
  Fonts,
  HeaderGradient,
  PageGradient,
  Palette,
  Shadow,
} from '@/constants/theme';
import {
  buildEvidenceHtml,
  chainHashes,
  type EvidenceJournalEntry,
} from '@/src/evidence';

const HEADER_GRADIENTS = HeaderGradient;
const PAGE_GRADIENTS = PageGradient;
const BRANCH_TINT: Record<RiskState, string> = BranchTint;

const STATUS_SCENARIOS = {
  red: {
    pillBg: Palette.statusRedBg,
    pillTextKey: 'homeScreen.status.redPill',
    titleKey: 'homeScreen.status.redTitle',
    descriptionKey: 'homeScreen.status.redDescription',
  },
  yellow: {
    pillBg: Palette.statusYellowBg,
    pillTextKey: 'homeScreen.status.yellowPill',
    titleKey: 'homeScreen.status.yellowTitle',
    descriptionKey: 'homeScreen.status.yellowDescription',
  },
  green: {
    pillBg: Palette.statusGreenBg,
    pillTextKey: 'homeScreen.status.greenPill',
    titleKey: 'homeScreen.status.greenTitle',
    descriptionKey: 'homeScreen.status.greenDescription',
  },
} as const;

const HEART_AFFIRMATIONS = {
  red: 'homeScreen.affirmation.red',
  yellow: 'homeScreen.affirmation.yellow',
  green: 'homeScreen.affirmation.green',
} as const;

const SAFETY_TIPS = [
  'homeScreen.safetyTips.tip1',
  'homeScreen.safetyTips.tip2',
  'homeScreen.safetyTips.tip3',
  'homeScreen.safetyTips.tip4',
];

const ASSESSMENT_HERO_BG: Record<RiskState, string> = {
  red: '#FBE5DE',
  yellow: '#FBEAD2',
  green: '#EFF3E7',
};

const ACTION_GRID_BG: Record<RiskState, string> = {
  red: '#FCEEE7',
  yellow: '#FBF1DD',
  green: '#F0F4E8',
};

const EVIDENCE_JOURNAL_STORAGE_KEY = 'guardian_angel_evidence_journal_v1';

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function formatRecordingDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const direction = typeof i18n.dir === 'function' ? i18n.dir() : 'ltr';
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const [currentStatus, setStatus] = useState<RiskState>(getCurrentStatus());
  const [trustedContactName, setTrustedContactName] = useState('');
  const [trustedContactPhone, setTrustedContactPhone] = useState('');
  const [trustedContacts, setTrustedContactsState] = useState<TrustedContact[]>([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showSafetyTipsModal, setShowSafetyTipsModal] = useState(false);
  const [showPanicSettingsModal, setShowPanicSettingsModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [isTriggeringEmergency, setIsTriggeringEmergency] = useState(false);
  const [panicPhoneNumber, setPanicPhoneNumber] = useState('');
  const [panicMessage, setPanicMessage] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [selectedJournalImage, setSelectedJournalImage] = useState<string | null>(null);
  const [selectedJournalImageName, setSelectedJournalImageName] = useState('');
  const [selectedJournalAudio, setSelectedJournalAudio] = useState<string | null>(null);
  const [selectedJournalAudioDuration, setSelectedJournalAudioDuration] = useState(0);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isExportingEvidence, setIsExportingEvidence] = useState(false);
  const [journalEntries, setJournalEntries] = useState<EvidenceJournalEntry[]>([]);
  const [journalViewerImage, setJournalViewerImage] = useState<string | null>(null);
  const fileInputRef = useRef<any>(null);
  const mediaRecorderRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUnlocked = hasSecureSessionAccess();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  useFocusEffect(
    useCallback(() => {
      const nextStatus = getCurrentStatus();
      setStatus(nextStatus);
      const contacts = getTrustedContacts();
      setTrustedContactsState(contacts);
      setShowEmergencyModal(nextStatus === 'red');
      void (async () => {
        const settings = await getPanicSettings();
        setPanicPhoneNumber(settings.phoneNumber);
        setPanicMessage(settings.emergencyMessage);
      })();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(EVIDENCE_JOURNAL_STORAGE_KEY);
        if (!raw) {
          setJournalEntries([]);
          return;
        }
        try {
          const parsed = JSON.parse(raw) as EvidenceJournalEntry[];
          if (!Array.isArray(parsed)) {
            setJournalEntries([]);
            return;
          }
          void (async () => {
            const chained = await chainHashes(parsed);
            const needsRewrite = chained.some(
              (entry, idx) =>
                entry.entryHash !== parsed[idx]?.entryHash ||
                entry.previousEntryHash !== parsed[idx]?.previousEntryHash,
            );
            if (needsRewrite) {
              try {
                window.localStorage.setItem(EVIDENCE_JOURNAL_STORAGE_KEY, JSON.stringify(chained));
              } catch {
                // ignore — display chained values regardless
              }
            }
            setJournalEntries(chained);
          })();
        } catch {
          setJournalEntries([]);
        }
      }
    }, []),
  );

  const formatTimestamp = (date: Date) => {
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const year = date.getFullYear();
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${day}/${month}/${year}, ${hours}:${minutes}`;
  };

  const persistJournalEntries = (entries: EvidenceJournalEntry[]) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(EVIDENCE_JOURNAL_STORAGE_KEY, JSON.stringify(entries));
      return true;
    } catch (error: any) {
      const isQuotaError =
        error?.name === 'QuotaExceededError' ||
        error?.code === 22 ||
        error?.code === 1014 ||
        error?.name === 'NS_ERROR_DOM_QUOTA_REACHED';
      if (isQuotaError) {
        Alert.alert(
          'Storage is full',
          'Storage is full. Please delete old entries to add more, or upgrade to cloud storage.',
        );
      } else {
        Alert.alert('Save failed', 'Unable to save this entry right now.');
      }
      return false;
    }
  };

  const openImagePicker = () => {
    if (Platform.OS !== 'web') {
      Alert.alert('Unavailable', 'Image upload is currently available on web.');
      return;
    }
    fileInputRef.current?.click();
  };

  const compressImageToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const imageUrl = URL.createObjectURL(file);
      const image = new window.Image();

      image.onload = () => {
        const maxDimension = 800;
        const width = image.width;
        const height = image.height;
        const scale = Math.min(1, maxDimension / Math.max(width, height));
        const targetWidth = Math.max(1, Math.round(width * scale));
        const targetHeight = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(imageUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(image, 0, 0, targetWidth, targetHeight);
        const compressed = canvas.toDataURL('image/jpeg', 0.6);
        URL.revokeObjectURL(imageUrl);
        resolve(compressed);
      };

      image.onerror = () => {
        URL.revokeObjectURL(imageUrl);
        reject(new Error('Image load failed'));
      };

      image.src = imageUrl;
    });

  const handleWebFileChange = async (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    try {
      const compressedImage = await compressImageToDataUrl(file);
      setSelectedJournalImage(compressedImage);
      setSelectedJournalImageName(file.name || 'image');
    } catch {
      Alert.alert('Upload failed', 'Unable to read the selected image.');
    }
  };

  const saveJournalEntry = async () => {
    const description = incidentDescription.trim();
    if (!description && !selectedJournalImage && !selectedJournalAudio) {
      Alert.alert('Missing content', 'Add a description, image, or audio recording before saving.');
      return;
    }

    const baseEntry: EvidenceJournalEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      description,
      timestamp: formatTimestamp(new Date()),
      imageBase64: selectedJournalImage ?? undefined,
      audioBase64: selectedJournalAudio ?? undefined,
      audioDurationSec: selectedJournalAudio ? selectedJournalAudioDuration : undefined,
    };

    const draft = [baseEntry, ...journalEntries];
    const chained = await chainHashes(draft);
    const persisted = persistJournalEntries(chained);
    if (!persisted) return;
    setJournalEntries(chained);
    setIncidentDescription('');
    setSelectedJournalImage(null);
    setSelectedJournalImageName('');
    setSelectedJournalAudio(null);
    setSelectedJournalAudioDuration(0);
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteJournalEntry = async (id: string) => {
    const filtered = journalEntries.filter((entry) => entry.id !== id);
    const rechained = await chainHashes(filtered);
    const persisted = persistJournalEntries(rechained);
    if (!persisted) return;
    setJournalEntries(rechained);
  };

  const startAudioRecording = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Web only', 'Voice recording is currently available on the web.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof (window as any).MediaRecorder === 'undefined') {
      Alert.alert('Unsupported', 'Microphone recording is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      const RecorderCtor = (window as any).MediaRecorder;
      const recorder = new RecorderCtor(stream);
      recorder.ondataavailable = (event: any) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        try {
          const dataUrl = await blobToDataUrl(blob);
          setSelectedJournalAudio(dataUrl);
        } catch {
          Alert.alert('Recording error', 'Could not save the audio recording.');
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
      setRecordingSeconds(0);
      setSelectedJournalAudioDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          setSelectedJournalAudioDuration(next);
          return next;
        });
      }, 1000);
    } catch {
      Alert.alert('Microphone unavailable', 'Allow microphone access to record audio.');
    }
  };

  const stopAudioRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === 'recording') {
      recorder.stop();
    }
    setIsRecordingAudio(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const clearSelectedAudio = () => {
    setSelectedJournalAudio(null);
    setSelectedJournalAudioDuration(0);
    setRecordingSeconds(0);
  };

  const exportEvidencePdf = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      Alert.alert('Web only', 'Evidence export is currently available on the web.');
      return;
    }
    if (journalEntries.length === 0) {
      Alert.alert('Empty journal', 'Add at least one entry before exporting.');
      return;
    }
    setIsExportingEvidence(true);
    try {
      const chained = await chainHashes(journalEntries);
      try {
        window.localStorage.setItem(EVIDENCE_JOURNAL_STORAGE_KEY, JSON.stringify(chained));
      } catch {
        // ignore storage write failure; we can still export
      }
      setJournalEntries(chained);
      const html = buildEvidenceHtml(chained, new Date().toISOString());
      const win = window.open('', '_blank');
      if (!win) {
        Alert.alert('Pop-up blocked', 'Allow pop-ups for this site to export evidence.');
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch {
          // user can still print manually from the new tab
        }
      }, 700);
    } catch {
      Alert.alert('Export failed', 'Unable to generate the evidence export. Please try again.');
    } finally {
      setIsExportingEvidence(false);
    }
  };

  const clearAllJournalEntries = () => {
    Alert.alert('Clear all entries?', 'This will permanently delete all local journal entries.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          const persisted = persistJournalEntries([]);
          if (!persisted) return;
          setJournalEntries([]);
          setIncidentDescription('');
          setSelectedJournalImage(null);
          setSelectedJournalImageName('');
          if (Platform.OS === 'web' && fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        },
      },
    ]);
  };

  const saveTrustedContact = async () => {
    if (!isUnlocked) return;
    if (trustedContacts.length >= 2) {
      Alert.alert(t('homeScreen.alerts.limitReachedTitle'), t('homeScreen.alerts.limitReachedMessage'));
      return;
    }
    if (!trustedContactPhone.trim()) {
      Alert.alert(t('homeScreen.alerts.missingNumberTitle'), t('homeScreen.alerts.missingNumberMessage'));
      return;
    }
    await addTrustedContact({ name: trustedContactName, phone: trustedContactPhone });
    const nextContacts = getTrustedContacts();
    setTrustedContactsState(nextContacts);
    setTrustedContactName('');
    setTrustedContactPhone('');
  };

  const openDialer = async (phone: string, fallbackAlert: string) => {
    const sanitized = phone.replace(/[^\d+]/g, '');
    if (!sanitized) {
      Alert.alert(t('homeScreen.alerts.unavailableTitle'), fallbackAlert);
      return;
    }
    const telUrl = `tel:${sanitized}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert(t('homeScreen.alerts.unavailableTitle'), t('homeScreen.alerts.dialerUnavailable'));
      return;
    }
    // Do not change routes here: user should stay on current screen after dialing/canceling.
    await Linking.openURL(telUrl);
  };

  const removeTrustedContact = async (index: number) => {
    const next = trustedContacts.filter((_, idx) => idx !== index);
    await setTrustedContacts(next);
    setTrustedContactsState(next);
  };

  const savePanicSetup = async () => {
    const nextPhone = panicPhoneNumber.trim();
    const nextMessage = panicMessage.trim();
    if (!nextPhone || !nextMessage) {
      Alert.alert(t('panic.setup.errorTitle'), t('panic.setup.required'));
      return;
    }
    try {
      await savePanicSettings({
        phoneNumber: nextPhone,
        emergencyMessage: nextMessage,
      });
      setShowPanicSettingsModal(false);
      Alert.alert(t('panic.setup.savedTitle'), t('panic.setup.savedMessage'));
    } catch {
      Alert.alert(t('panic.setup.errorTitle'), t('panic.setup.saveError'));
    }
  };


  const triggerEmergencyIntervention = async () => {
    if (isTriggeringEmergency) return;
    setIsTriggeringEmergency(true);

    try {
      const settings = await getPanicSettings();
      const phoneNumber = settings.phoneNumber.trim();
      const emergencyMessage = settings.emergencyMessage.trim();
      if (!phoneNumber || !emergencyMessage) {
        Alert.alert(t('panic.setup.errorTitle'), t('panic.setup.required'));
        setShowPanicSettingsModal(true);
        return;
      }

      const smsUrl = `sms:${phoneNumber}?body=${encodeURIComponent(emergencyMessage)}`;
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = smsUrl;
      } else {
        const canOpen = await Linking.canOpenURL(smsUrl);
        if (!canOpen) {
          Alert.alert(t('panic.unavailableTitle'), t('panic.unavailableMessage'));
          return;
        }
        await Linking.openURL(smsUrl);
      }
      Alert.alert(t('panic.completedTitle'), t('panic.completedMessage'));
    } catch {
      Alert.alert(t('panic.failedTitle'), t('panic.failedMessage'));
    } finally {
      setIsTriggeringEmergency(false);
    }
  };

  const headerScenario = STATUS_SCENARIOS[currentStatus];
  const headerGradient = HEADER_GRADIENTS[currentStatus];
  const pageGradient = PAGE_GRADIENTS[currentStatus];
  const heartAffirmationKey = HEART_AFFIRMATIONS[currentStatus];

  const buildTrafficLightStyle = (light: RiskState) => {
    const isActive = light === currentStatus;
    const colors: Record<RiskState, string> = {
      red: '#D26B7A',
      yellow: '#D8A464',
      green: '#7FA886',
    };
    const color = colors[light];
    return {
      backgroundColor: isActive ? color : 'rgba(148,163,184,0.22)',
      borderColor: isActive ? color : 'rgba(148,163,184,0.42)',
      shadowColor: color,
      shadowOpacity: isActive ? 0.72 : 0,
      shadowRadius: isActive ? 14 : 0,
      transform: [{ scale: isActive ? 1.04 : 0.96 }],
      opacity: isActive ? 1 : 0.72,
    };
  };

  return (
    <LinearGradient colors={pageGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.pageGradient}>
      <SafeAreaView style={[styles.container, { direction }]}>
      <View pointerEvents="none" style={styles.branchOverlayWrap}>
        <Image
          source={require('../assets/images/traffic-light-bg.png')}
          style={[styles.branchOverlay, { tintColor: BRANCH_TINT[currentStatus] }]}
        />
      </View>
      <Modal visible={showEmergencyModal} transparent animationType="fade">
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>{t('homeScreen.emergency.title')}</Text>
            <Text style={styles.emergencyMessage}>{t('homeScreen.emergency.message')}</Text>
            <TouchableOpacity style={styles.emergencyButton} onPress={() => setShowEmergencyModal(false)}>
              <Text style={styles.emergencyButtonText}>{t('homeScreen.emergency.understood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal visible={showSupportModal} transparent animationType="fade" onRequestClose={() => setShowSupportModal(false)}>
        <View style={styles.supportOverlay}>
          <View style={styles.supportModal}>
            <Text style={styles.supportModalTitle}>{t('homeScreen.support.title')}</Text>
            <TouchableOpacity
              style={styles.supportActionButton}
              onPress={() => void openDialer('100', t('homeScreen.support.fallbackPolice'))}>
              <Text style={styles.supportActionText}>🚨 {t('homeScreen.support.police')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.supportActionButton}
              onPress={() => void openDialer('118', t('homeScreen.support.fallbackHotline'))}>
              <Text style={styles.supportActionText}>🛡️ {t('homeScreen.support.hotline')}</Text>
            </TouchableOpacity>
            {trustedContacts.map((contact, index) => (
              <TouchableOpacity
                key={`support-contact-${index}`}
                style={styles.supportActionButton}
                onPress={() => void openDialer(contact.phone, t('homeScreen.support.fallbackInvalidContact'))}>
                <Text style={styles.supportActionText}>
                  👤 {contact.name || t('homeScreen.support.customContact', { index: index + 1 })}
                </Text>
              </TouchableOpacity>
            ))}
            {trustedContacts.length === 0 ? (
              <Text style={styles.supportEmptyText}>{t('homeScreen.support.addContactsHint')}</Text>
            ) : null}
            <View style={styles.contactInputWrap}>
              <TextInput
                style={styles.contactInput}
                value={trustedContactName}
                onChangeText={setTrustedContactName}
                placeholder={t('homeScreen.support.trustedNamePlaceholder')}
                placeholderTextColor="#9ca3af"
              />
              <TextInput
                style={styles.contactInput}
                value={trustedContactPhone}
                onChangeText={setTrustedContactPhone}
                placeholder={t('homeScreen.support.trustedPhonePlaceholder')}
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
              <TouchableOpacity style={styles.contactSaveButton} onPress={() => void saveTrustedContact()}>
                <Text style={styles.contactSaveButtonText}>
                  {trustedContacts.length > 0 ? t('homeScreen.support.addOrUpdate') : t('homeScreen.support.saveContact')}
                </Text>
              </TouchableOpacity>
              {trustedContacts.length > 0 ? (
                <View style={styles.manageRow}>
                  {trustedContacts.map((contact, index) => (
                    <TouchableOpacity
                      key={`modal-call-${index}`}
                      style={styles.removePill}
                      onPress={() => void openDialer(contact.phone, t('homeScreen.support.fallbackAddContact'))}>
                      <Text style={styles.removePillText}>
                        {t('homeScreen.support.callContact', {
                          name: contact.name || t('homeScreen.support.contact', { index: index + 1 }),
                        })}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {trustedContacts.map((_, index) => (
                    <TouchableOpacity
                      key={`modal-remove-${index}`}
                      style={styles.removePill}
                      onPress={() => void removeTrustedContact(index)}>
                      <Text style={styles.removePillText}>{t('homeScreen.support.removeContact', { index: index + 1 })}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.supportCloseButton} onPress={() => setShowSupportModal(false)}>
              <Text style={styles.supportCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showSafetyTipsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSafetyTipsModal(false)}>
        <View style={styles.supportOverlay}>
          <View style={styles.safetyTipsModal}>
            <View style={styles.safetyTipsHeader}>
              <Text style={styles.safetyTipsTitle}>{t('homeScreen.safetyTips.title')}</Text>
              <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
                <Image source={require('../assets/images/image_10.png')} style={styles.stealthExitImage} />
              </TouchableOpacity>
            </View>
            {SAFETY_TIPS.map((tipKey) => (
              <View key={tipKey} style={styles.safetyTipRow}>
                <Text style={styles.safetyTipIcon}>🛡️</Text>
                <Text style={styles.safetyTipText}>{t(tipKey)}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.supportCloseButton} onPress={() => setShowSafetyTipsModal(false)}>
              <Text style={styles.supportCloseText}>{t('common.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showPanicSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPanicSettingsModal(false)}>
        <View style={styles.supportOverlay}>
          <View style={styles.supportModal}>
            <Text style={styles.supportModalTitle}>{t('panic.setup.title')}</Text>
            <Text style={styles.supportEmptyText}>{t('panic.setup.subtitle')}</Text>
            <TextInput
              style={styles.contactInput}
              value={panicPhoneNumber}
              onChangeText={setPanicPhoneNumber}
              placeholder={t('panic.setup.phonePlaceholder')}
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.contactInput, styles.panicMessageInput]}
              value={panicMessage}
              onChangeText={setPanicMessage}
              placeholder={t('panic.setup.messagePlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.contactSaveButton} onPress={() => void savePanicSetup()}>
              <Text style={styles.contactSaveButtonText}>{t('panic.setup.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.supportCloseButton} onPress={() => setShowPanicSettingsModal(false)}>
              <Text style={styles.supportCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(journalViewerImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setJournalViewerImage(null)}>
        <View style={styles.supportOverlay}>
          <View style={styles.journalImageViewerModal}>
            {journalViewerImage ? <Image source={{ uri: journalViewerImage }} style={styles.journalViewerImage} /> : null}
            <TouchableOpacity style={styles.supportCloseButton} onPress={() => setJournalViewerImage(null)}>
              <Text style={styles.supportCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {showJournalModal ? (
          <View style={styles.journalPage}>
            <View style={styles.journalPageHeader}>
              <TouchableOpacity style={styles.backButton} onPress={() => setShowJournalModal(false)}>
                <Feather name="chevron-left" size={22} color={Palette.inkSoft} />
              </TouchableOpacity>
              <Text style={styles.journalPageTitle}>Journal</Text>
              <TouchableOpacity
                style={[styles.journalExportButton, isExportingEvidence && styles.journalExportButtonDisabled]}
                onPress={() => void exportEvidencePdf()}
                disabled={isExportingEvidence}
                accessibilityLabel="Export evidence PDF">
                <Feather name="file-text" size={14} color="#FFFFFF" />
                <Text style={styles.journalExportButtonText}>
                  {isExportingEvidence ? 'Exporting…' : 'Export'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.journalSubtitle}>
              Privately record incidents with date, time, photos, and voice notes. Each entry is hash-chained so any later edit invalidates the chain.
            </Text>
            <TextInput
              style={styles.journalTextarea}
              value={incidentDescription}
              onChangeText={setIncidentDescription}
              placeholder="Describe what happened..."
              placeholderTextColor={Palette.inkFaint}
              multiline
              textAlignVertical="top"
            />
            {Platform.OS === 'web'
              ? React.createElement('input', {
                  ref: fileInputRef,
                  type: 'file',
                  accept: 'image/*',
                  onChange: handleWebFileChange,
                  style: { display: 'none' },
                })
              : null}
            <View style={styles.journalAttachRow}>
              <TouchableOpacity style={styles.journalAttachButton} onPress={openImagePicker}>
                <Feather name="image" size={15} color={Palette.primaryDeep} />
                <Text style={styles.journalAttachButtonText}>Add image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.journalAttachButton, isRecordingAudio && styles.journalAttachButtonRecording]}
                onPress={() => (isRecordingAudio ? stopAudioRecording() : void startAudioRecording())}>
                <Feather
                  name={isRecordingAudio ? 'square' : 'mic'}
                  size={15}
                  color={isRecordingAudio ? '#FFFFFF' : Palette.primaryDeep}
                />
                <Text
                  style={[
                    styles.journalAttachButtonText,
                    isRecordingAudio && styles.journalAttachButtonTextRecording,
                  ]}>
                  {isRecordingAudio ? `Stop · ${formatRecordingDuration(recordingSeconds)}` : 'Record audio'}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.journalSaveButton} onPress={() => void saveJournalEntry()}>
              <Feather name="check" size={15} color="#FFFFFF" />
              <Text style={styles.journalSaveButtonText}>Save entry</Text>
            </TouchableOpacity>
            {selectedJournalImage ? (
              <View style={styles.journalSelectedImageRow}>
                <Image source={{ uri: selectedJournalImage }} style={styles.journalSelectedImage} />
                <Text style={styles.journalSelectedImageLabel} numberOfLines={1}>
                  {selectedJournalImageName || 'Selected image'}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedJournalImage(null);
                    setSelectedJournalImageName('');
                    if (Platform.OS === 'web' && fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}>
                  <Feather name="x" size={16} color={Palette.inkMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
            {selectedJournalAudio ? (
              <View style={styles.journalSelectedAudioRow}>
                <View style={styles.journalSelectedAudioIcon}>
                  <Feather name="mic" size={14} color={Palette.primaryDeep} />
                </View>
                <View style={styles.journalSelectedAudioBody}>
                  {Platform.OS === 'web'
                    ? React.createElement('audio', {
                        controls: true,
                        src: selectedJournalAudio,
                        style: { width: '100%' },
                      })
                    : (
                      <Text style={styles.journalSelectedImageLabel}>
                        Recording · {formatRecordingDuration(selectedJournalAudioDuration)}
                      </Text>
                    )}
                </View>
                <TouchableOpacity onPress={clearSelectedAudio}>
                  <Feather name="x" size={16} color={Palette.inkMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={styles.journalClearAllButton} onPress={clearAllJournalEntries}>
              <Text style={styles.journalClearAllButtonText}>Clear All Entries</Text>
            </TouchableOpacity>

            <View style={styles.journalFeed}>
              {journalEntries.map((entry) => (
                <View key={entry.id} style={styles.journalEntryCard}>
                  <Text style={styles.journalEntryTimestamp}>{entry.timestamp}</Text>
                  {entry.description ? <Text style={styles.journalEntryText}>{entry.description}</Text> : null}
                  {entry.imageBase64 ? (
                    <TouchableOpacity onPress={() => setJournalViewerImage(entry.imageBase64 ?? null)}>
                      <Image source={{ uri: entry.imageBase64 }} style={styles.journalThumb} />
                    </TouchableOpacity>
                  ) : null}
                  {entry.audioBase64 && Platform.OS === 'web'
                    ? React.createElement('audio', {
                        controls: true,
                        src: entry.audioBase64,
                        style: { width: '100%', marginTop: 8 },
                      })
                    : entry.audioBase64
                      ? (
                        <Text style={styles.journalEntryAudioFallback}>
                          🎤 Audio recording attached ({entry.audioDurationSec ?? 0}s)
                        </Text>
                      )
                      : null}
                  {entry.entryHash ? (
                    <View style={styles.journalEntryHashRow}>
                      <Feather name="link" size={10} color={Palette.inkFaint} />
                      <Text style={styles.journalEntryHash} numberOfLines={1}>
                        {entry.entryHash.slice(0, 16)}…
                      </Text>
                    </View>
                  ) : null}
                  <TouchableOpacity style={styles.journalDeleteButton} onPress={() => void deleteJournalEntry(entry.id)}>
                    <Text style={styles.journalDeleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityLabel="Back">
                <Feather name="chevron-left" size={22} color={Palette.inkSoft} />
              </TouchableOpacity>
              <View style={styles.headerRightActions}>
                <LanguageSwitcher />
                <TouchableOpacity
                  style={styles.quickExitButton}
                  onPress={() => router.replace('/(tabs)')}
                  accessibilityLabel="Exit">
                  <Feather name="x" size={18} color={Palette.inkSoft} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.welcomeBlock}>
              <Text style={styles.welcomeEyebrow}>{t('homeScreen.safeZone')}</Text>
              <Text style={styles.welcomeTitle}>You are{'\n'}held here.</Text>
              <View style={styles.welcomeOrnament}>
                <View style={styles.welcomeOrnamentLine} />
                <Feather name="heart" size={11} color={Palette.primary} />
                <View style={styles.welcomeOrnamentLine} />
              </View>
            </View>

            <LinearGradient
              colors={headerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.statusHero}>
              <View style={styles.headerMainRow}>
                <View style={styles.trafficHousingSoft}>
                  <View style={[styles.trafficLightSoft, buildTrafficLightStyle('red')]} />
                  <View style={[styles.trafficLightSoft, buildTrafficLightStyle('yellow')]} />
                  <View style={[styles.trafficLightSoft, buildTrafficLightStyle('green')]} />
                </View>
                <View style={styles.statusTextWrap}>
                  <View style={[styles.statusPill, { backgroundColor: headerScenario.pillBg }]}>
                    <Text style={styles.statusPillText}>{t(headerScenario.pillTextKey)}</Text>
                  </View>
                  <Text style={styles.statusMessage}>{t(headerScenario.titleKey)}</Text>
                  <Text style={styles.statusSubMessage}>{t(headerScenario.descriptionKey)}</Text>
                </View>
              </View>
              <View style={styles.statusDivider}>
                <View style={styles.statusDividerLine} />
                <Text style={styles.statusDividerOrnament}>✿</Text>
                <View style={styles.statusDividerLine} />
              </View>
              <Text style={styles.statusAffirmation}>&ldquo;{t(heartAffirmationKey)}&rdquo;</Text>
            </LinearGradient>

            <View style={styles.bentoSection}>
              <Text style={styles.sectionLabel}>{t('homeScreen.actions.subheader')}</Text>

              <View style={styles.bentoRow}>
                <TouchableOpacity
                  style={styles.bentoCardSmall}
                  onPress={() => setShowSafetyTipsModal(true)}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.sageSoft }]}>
                    <Feather name="shield" size={20} color={Palette.statusGreenInk} />
                  </View>
                  <Text style={styles.bentoCardTitle}>{t('homeScreen.actions.securityTipsTitle')}</Text>
                  <Text style={styles.bentoCardDescription} numberOfLines={3}>
                    {t('homeScreen.actions.securityTipsDescription')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.bentoCardWide}
                  onPress={() => router.push('/assessment')}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.primarySoft }]}>
                    <Feather name="clipboard" size={20} color={Palette.primaryDeep} />
                  </View>
                  <Text style={styles.bentoCardTitle}>{t('homeScreen.actions.startAssessmentTitle')}</Text>
                  <Text style={styles.bentoCardDescription} numberOfLines={3}>
                    {t('homeScreen.actions.startAssessmentDescription')}
                  </Text>
                  <View style={styles.bentoCardCTA}>
                    <Text style={styles.bentoCardCTAText}>{t('homeScreen.actions.startQuiz')}</Text>
                    <Feather name="arrow-right" size={13} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={styles.bentoRow}>
                <TouchableOpacity
                  style={styles.bentoCardEqual}
                  onPress={() => setShowSupportModal(true)}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.surfaceTinted }]}>
                    <Feather name="phone-call" size={20} color={Palette.primaryDeep} />
                  </View>
                  <Text style={styles.bentoCardTitle}>{t('homeScreen.support.title')}</Text>
                  <Text style={styles.bentoCardDescription}>
                    {t('homeScreen.actions.talkToSomeoneDescription')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bentoCardEqual}
                  onPress={() => router.push('/shelters')}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.goldSoft }]}>
                    <Feather name="home" size={20} color={Palette.statusYellowInk} />
                  </View>
                  <Text style={styles.bentoCardTitle}>{t('homeScreen.actions.shelters')}</Text>
                  <Text style={styles.bentoCardDescription}>
                    {t('homeScreen.actions.sheltersDescription')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.bentoCardEmergency}
                onPress={() => void triggerEmergencyIntervention()}
                accessibilityRole="button"
                accessibilityLabel={t('panic.triggerTitle')}>
                <View style={styles.bentoEmergencyContent}>
                  <View style={styles.bentoEmergencyIconWrap}>
                    <Feather name="alert-triangle" size={22} color="#FFFFFF" />
                  </View>
                  <View style={styles.bentoEmergencyTextWrap}>
                    <Text style={styles.bentoEmergencyTitle}>{t('panic.triggerTitle')}</Text>
                    <Text style={styles.bentoEmergencyDescription}>
                      {isTriggeringEmergency ? t('panic.triggering') : t('panic.triggerDescription')}
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={20} color="#FFFFFF" />
                </View>
                <TouchableOpacity
                  style={styles.bentoEmergencySetup}
                  onPress={() => setShowPanicSettingsModal(true)}>
                  <Feather name="settings" size={11} color="#FFFFFF" />
                  <Text style={styles.bentoEmergencySetupText}>{t('panic.setup.open')}</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              <View style={styles.bentoRow}>
                <TouchableOpacity
                  style={styles.bentoCardEqual}
                  onPress={() => router.push('/exit_fund')}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.primarySoft }]}>
                    <Feather name="lock" size={20} color={Palette.primaryDeep} />
                  </View>
                  <Text style={styles.bentoCardTitle}>{t('homeScreen.actions.secureResources')}</Text>
                  <Text style={styles.bentoCardDescription}>
                    {t('homeScreen.actions.secureResourcesDescription')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bentoCardEqual}
                  onPress={() => setShowJournalModal(true)}>
                  <View style={[styles.bentoIconWrap, { backgroundColor: Palette.sageSoft }]}>
                    <Feather name="book-open" size={20} color={Palette.statusGreenInk} />
                  </View>
                  <Text style={styles.bentoCardTitle}>Journal</Text>
                  <Text style={styles.bentoCardDescription}>
                    Document incidents and keep personal notes.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  pageGradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  branchOverlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  branchOverlay: {
    position: 'absolute',
    bottom: -90,
    right: -35,
    width: 420,
    height: 520,
    opacity: 0.12,
    transform: [{ rotate: '-14deg' }],
    zIndex: 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    flexGrow: 1,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: Palette.ink,
    textAlign: 'left',
    fontFamily: Fonts.serif,
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  headerIconText: {
    color: Palette.inkSoft,
    fontSize: 18,
    fontWeight: '500',
  },
  quickExitButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    paddingHorizontal: 0,
    ...Shadow.soft,
  },
  quickExitEmoji: {
    fontSize: 16,
    fontWeight: '700',
    color: Palette.ink,
  },
  stealthExitImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  trafficShell: {
    marginBottom: 22,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  headerMainRow: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'flex-start',
    writingDirection: 'ltr',
  },
  trafficHousingSoft: {
    width: 78,
    borderRadius: 28,
    paddingVertical: 16,
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#2D2421',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#2D2421',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  trafficLightSoft: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
  statusTextWrap: {
    flex: 1,
    alignItems: 'flex-start',
    writingDirection: 'ltr',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(168, 87, 108, 0.22)',
  },
  statusPillText: {
    color: Palette.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  affirmationCard: {
    backgroundColor: '#FFFCF9',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  affirmationLabel: {
    color: Palette.inkMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  affirmationText: {
    marginTop: 8,
    color: Palette.ink,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
    fontFamily: Fonts.serif,
  },
  card: {
    backgroundColor: '#FFFCF9',
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 10,
  },
  statusMessage: {
    marginTop: 12,
    fontSize: 23,
    color: Palette.ink,
    textAlign: 'left',
    lineHeight: 30,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    writingDirection: 'ltr',
  },
  statusSubMessage: {
    marginTop: 8,
    color: Palette.inkMuted,
    fontSize: 14,
    textAlign: 'left',
    lineHeight: 22,
    writingDirection: 'ltr',
  },
  headerAffirmationBox: {
    marginTop: 18,
    borderRadius: 20,
    backgroundColor: '#FFFCF9',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: Palette.primary,
    writingDirection: 'ltr',
  },
  headerAffirmationIcon: {
    fontSize: 18,
    lineHeight: 24,
  },
  headerAffirmationText: {
    flex: 1,
    color: Palette.inkSoft,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  greenEmpowermentCard: {
    marginTop: 14,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    alignItems: 'center',
    ...Shadow.soft,
  },
  greenIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Palette.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  greenIcon: {
    color: Palette.sageSoft,
    fontSize: 18,
    fontWeight: '800',
  },
  greenAffirmation: {
    color: Palette.ink,
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '300',
    textAlign: 'left',
    letterSpacing: 1.1,
    textTransform: 'lowercase',
  },
  greenSupportText: {
    marginTop: 12,
    color: Palette.inkMuted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: 'left',
    letterSpacing: 0.4,
  },
  greenActionButton: {
    marginTop: 14,
    backgroundColor: '#FFFCF9',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  greenActionButtonText: {
    color: Palette.inkSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCard: {
    backgroundColor: '#FFFCF9',
  },
  safetyCardEmergency: {
    backgroundColor: Palette.emergencyDeep,
    borderWidth: 1,
    borderColor: Palette.primarySoft,
  },
  contactInputWrap: {
    gap: 10,
    marginTop: 8,
  },
  contactInput: {
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: '#FDF8F2',
    color: Palette.ink,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  panicMessageInput: {
    minHeight: 100,
  },
  contactSaveButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  contactSaveButtonEmergency: {
    backgroundColor: Palette.emergencyDeep,
    borderWidth: 1,
    borderColor: Palette.primarySoft,
  },
  contactSaveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  manageRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  removePill: {
    backgroundColor: Palette.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  removePillText: {
    color: Palette.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  emergencyActionButton: {
    borderRadius: 18,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineButton: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryEmergencyButton: {
    backgroundColor: Palette.emergencyDeep,
    borderColor: Palette.primary,
  },
  hotline118Button: {
    backgroundColor: Palette.sage,
    borderColor: Palette.sageSoft,
  },
  secondaryEmergencyButton: {
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  disabledEmojiButton: {
    opacity: 0.35,
  },
  emergencyActionIcon: {
    fontSize: 15,
  },
  emojiActionText: {
    fontSize: 24,
  },
  hotlineEmoji: {
    fontSize: 24,
  },
  emergencyActionsBottom: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  supportEmojiRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  plusTriggerButton: {
    marginLeft: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,151,143,0.18)',
  },
  plusTriggerText: {
    color: Palette.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  bottomActions: {
    marginTop: 'auto',
  },
  actionSubheader: {
    marginTop: 8,
    marginBottom: 16,
    color: Palette.ink,
    fontSize: 22,
    fontFamily: Fonts.serif,
    fontWeight: '700',
    textAlign: 'left',
    letterSpacing: 0.3,
  },
  securityTipsButton: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 18,
    marginBottom: 14,
    ...Shadow.soft,
  },
  securityTipsTitle: {
    color: Palette.ink,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  securityTipsDescription: {
    marginTop: 6,
    color: Palette.inkMuted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  securityTipsArrow: {
    marginTop: 8,
    color: Palette.primary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
  },
  assessmentHeroCard: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  assessmentHeroTitle: {
    marginTop: 0,
    color: Palette.ink,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  assessmentHeroDescription: {
    marginTop: 10,
    color: Palette.inkMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  assessmentHeroActionRow: {
    marginTop: 18,
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },
  assessmentHeroActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  assessmentHeroArrow: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionGridCard: {
    width: '48.5%',
    minHeight: 184,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 16,
    ...Shadow.soft,
  },
  emergencyActionGridCard: {
    backgroundColor: Palette.emergencyDeep,
    borderColor: Palette.emergencyMid,
    shadowColor: Palette.emergencyDeep,
    shadowOpacity: 0.22,
  },
  actionGridIconImage: {
    width: 26,
    height: 26,
    resizeMode: 'contain',
    marginBottom: 10,
    tintColor: Palette.primaryDeep,
  },
  actionGridIconEmoji: {
    fontSize: 22,
    marginBottom: 10,
  },
  actionGridTitle: {
    color: Palette.ink,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  emergencyActionGridTitle: {
    color: '#FFFFFF',
  },
  actionGridDescription: {
    marginTop: 8,
    color: Palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  emergencyActionGridDescription: {
    color: Palette.emergencyOnDark,
  },
  actionGridArrow: {
    color: Palette.primary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
  },
  emergencyActionGridArrow: {
    color: '#FFFFFF',
  },
  panicInlineSetupButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Palette.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  panicInlineSetupText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  supportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 47, 44, 0.36)',
    justifyContent: 'center',
    padding: 24,
  },
  supportModal: {
    backgroundColor: '#FFFCF9',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.lift,
  },
  supportModalTitle: {
    color: Palette.ink,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    marginBottom: 14,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportActionButton: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    backgroundColor: Palette.surfaceTinted,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  supportActionText: {
    color: Palette.ink,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportEmptyText: {
    marginVertical: 6,
    color: Palette.inkMuted,
    fontSize: 12,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportCloseButton: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: Palette.surfaceMuted,
  },
  supportCloseText: {
    textAlign: 'center',
    color: Palette.inkSoft,
    fontWeight: '700',
  },
  safetyTipsModal: {
    backgroundColor: '#FFFCF9',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.lift,
  },
  safetyTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  safetyTipsTitle: {
    color: Palette.ink,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    textAlign: 'left',
  },
  safetyTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    backgroundColor: Palette.surfaceTinted,
    borderRadius: 14,
    padding: 12,
  },
  safetyTipIcon: {
    fontSize: 16,
    lineHeight: 22,
  },
  safetyTipText: {
    flex: 1,
    color: Palette.ink,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  cardActionButton: {
    marginTop: 14,
    alignSelf: 'stretch',
    backgroundColor: Palette.surface,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  cardActionButtonText: {
    color: Palette.inkSoft,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  mainButton: {
    backgroundColor: Palette.surface,
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  mainButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  mainButtonIcon: {
    fontSize: 18,
  },
  mainButtonText: {
    color: Palette.inkSoft,
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    writingDirection: 'ltr',
  },
  emergencyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 47, 44, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  emergencyContent: {
    backgroundColor: Palette.emergencyDeep,
    borderRadius: 22,
    padding: 24,
    borderWidth: 2,
    borderColor: Palette.primarySoft,
  },
  emergencyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    lineHeight: 30,
    textAlign: 'center',
  },
  emergencyMessage: {
    marginTop: 12,
    color: Palette.emergencyOnDark,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  emergencyButton: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 14,
  },
  emergencyButtonText: {
    color: Palette.emergencyDeep,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  journalPage: {
    width: '100%',
  },
  journalPageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  journalPageTitle: {
    color: Palette.ink,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  journalPageHeaderSpacer: {
    width: 38,
    height: 38,
  },
  journalSubtitle: {
    marginTop: 4,
    color: Palette.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'left',
  },
  journalTextarea: {
    marginTop: 14,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: '#FDF8F2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Palette.ink,
    fontSize: 14,
  },
  journalFormFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  journalAttachRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  journalAttachButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: Palette.surfaceTinted,
  },
  journalAttachButtonRecording: {
    backgroundColor: Palette.primary,
    borderColor: Palette.primaryDeep,
  },
  journalAttachButtonText: {
    color: Palette.primaryDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  journalAttachButtonTextRecording: {
    color: '#FFFFFF',
  },
  journalImageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: Palette.surface,
    alignItems: 'center',
  },
  journalImageButtonText: {
    color: Palette.inkSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  journalSaveButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    backgroundColor: Palette.primary,
    ...Shadow.soft,
  },
  journalSaveButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  journalExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Palette.primary,
    ...Shadow.soft,
  },
  journalExportButtonDisabled: {
    opacity: 0.6,
  },
  journalExportButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  journalSelectedAudioRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Palette.surfaceTinted,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  journalSelectedAudioIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalSelectedAudioBody: {
    flex: 1,
  },
  journalEntryAudioFallback: {
    marginTop: 8,
    color: Palette.inkMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  journalEntryHashRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  journalEntryHash: {
    color: Palette.inkFaint,
    fontSize: 10,
    fontFamily: Fonts.mono,
    letterSpacing: 0.4,
  },
  journalClearAllButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Palette.primarySoft,
    backgroundColor: '#FCEEED',
  },
  journalClearAllButtonText: {
    color: Palette.primaryDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  journalSelectedImageRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  journalSelectedImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  journalSelectedImageLabel: {
    flex: 1,
    color: Palette.inkMuted,
    fontSize: 12,
  },
  journalFeed: {
    marginTop: 16,
    gap: 12,
  },
  journalEntryCard: {
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#FFFCF9',
    ...Shadow.soft,
  },
  journalEntryTimestamp: {
    color: Palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  journalEntryText: {
    marginTop: 6,
    color: Palette.ink,
    fontSize: 14,
    lineHeight: 21,
  },
  journalThumb: {
    marginTop: 10,
    width: 96,
    height: 96,
    borderRadius: 12,
  },
  journalDeleteButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FCEEED',
    borderWidth: 1,
    borderColor: Palette.primarySoft,
  },
  journalDeleteButtonText: {
    color: Palette.primaryDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  journalImageViewerModal: {
    backgroundColor: '#FFFCF9',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  journalViewerImage: {
    width: '100%',
    height: 320,
    borderRadius: 14,
    resizeMode: 'contain',
    backgroundColor: Palette.surfaceMuted,
  },

  // Welcome / greeting
  welcomeBlock: {
    marginBottom: 26,
    alignItems: 'center',
  },
  welcomeEyebrow: {
    color: Palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  welcomeTitle: {
    marginTop: 10,
    color: Palette.ink,
    fontSize: 38,
    lineHeight: 46,
    fontFamily: Fonts.serif,
    fontWeight: '500',
    fontStyle: 'italic',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  welcomeOrnament: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
  },
  welcomeOrnamentLine: {
    width: 28,
    height: 1,
    backgroundColor: Palette.borderStrong,
  },

  // Status hero card (replaces traffic shell)
  statusHero: {
    marginBottom: 26,
    borderRadius: 32,
    padding: 26,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.lift,
  },
  statusTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  dotStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  statusDivider: {
    marginTop: 22,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(168, 87, 108, 0.22)',
  },
  statusDividerOrnament: {
    fontSize: 14,
    color: Palette.primary,
  },
  statusAffirmation: {
    color: Palette.inkSoft,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: 6,
  },

  // Bento grid
  bentoSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    marginBottom: 16,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    color: Palette.inkMuted,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  bentoCardSmall: {
    width: 132,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  bentoCardWide: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  bentoCardEqual: {
    flex: 1,
    padding: 18,
    borderRadius: 24,
    minHeight: 168,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  bentoIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  bentoCardTitle: {
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    lineHeight: 22,
  },
  bentoCardDescription: {
    marginTop: 6,
    color: Palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  bentoCardCTA: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  bentoCardCTAText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },

  // Emergency wide bento card (full width, dark)
  bentoCardEmergency: {
    marginBottom: 12,
    borderRadius: 24,
    padding: 20,
    backgroundColor: Palette.emergencyDeep,
    borderWidth: 1,
    borderColor: Palette.emergencyMid,
    shadowColor: Palette.emergencyDeep,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  bentoEmergencyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bentoEmergencyIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoEmergencyTextWrap: {
    flex: 1,
  },
  bentoEmergencyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  bentoEmergencyDescription: {
    marginTop: 4,
    color: Palette.emergencyOnDark,
    fontSize: 12,
    lineHeight: 18,
  },
  bentoEmergencySetup: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  bentoEmergencySetupText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
