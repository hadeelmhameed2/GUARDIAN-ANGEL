import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Easing,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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

const AFFIRMATIONS = [
  'You are not alone',
  'Your strength is within you',
  'We are here with you',
  'One step at a time',
  'Trust your intuition',
];

const GREEN_EMPOWERMENT_QUOTES = [
  'Inner Peace is your Greatest Power',
  'Strength Grows in Quiet Moments',
  'You are Building Your Future, Step by Step',
];

const GREEN_SUPPORT_TEXT =
  'This is your time to build your protective foundation quietly. Use these calm moments to focus on your personal and financial security. We are here to protect your safe space.';

export default function HomeScreen() {
  const router = useRouter();
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const [currentStatus, setStatus] = useState<RiskState>(getCurrentStatus());
  const [affirmation, setAffirmation] = useState(AFFIRMATIONS[0]);
  const [greenEmpowermentQuote, setGreenEmpowermentQuote] = useState(GREEN_EMPOWERMENT_QUOTES[0]);
  const [trustedContactName, setTrustedContactName] = useState('');
  const [trustedContactPhone, setTrustedContactPhone] = useState('');
  const [trustedContacts, setTrustedContactsState] = useState<TrustedContact[]>([]);
  const [showContactForm, setShowContactForm] = useState(true);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emojiRowVersion, setEmojiRowVersion] = useState(0);
  const isUnlocked = hasSecureSessionAccess();
  const statusOrder = useMemo(() => ({ red: 0, yellow: 1, green: 2 }), []);
  const trafficAnim = useRef(new Animated.Value(statusOrder[currentStatus])).current;
  const contactFormAnim = useRef(new Animated.Value(0)).current;
  const assessmentPressAnim = useRef(new Animated.Value(1)).current;

  useFocusEffect(
    useCallback(() => {
      const nextStatus = getCurrentStatus();
      setStatus(nextStatus);
      setAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
      setGreenEmpowermentQuote(
        GREEN_EMPOWERMENT_QUOTES[Math.floor(Math.random() * GREEN_EMPOWERMENT_QUOTES.length)],
      );
      const contacts = getTrustedContacts();
      setTrustedContactsState(contacts);
      setShowContactForm(contacts.length === 0);
      setEmojiRowVersion((prev) => prev + 1);
      setShowEmergencyModal(nextStatus === 'red');
    }, []),
  );

  useEffect(() => {
    Animated.timing(trafficAnim, {
      toValue: statusOrder[currentStatus],
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStatus, statusOrder, trafficAnim]);

  useEffect(() => {
    Animated.timing(contactFormAnim, {
      toValue: showContactForm ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [contactFormAnim, showContactForm]);

  const statusMeta = useMemo(() => {
    if (currentStatus === 'green') {
      return {
        label: 'Green',
        color: '#22c55e',
        message: 'Low Risk',
        actionLabel: 'Focus on Your Future Fund',
      };
    }
    if (currentStatus === 'yellow') {
      return {
        label: 'Yellow',
        color: '#eab308',
        message:
          'Caution: Some patterns need attention. Consider documenting your experiences and reviewing your safety plan.',
        actionLabel: 'Safety Tips',
      };
    }
    return {
      label: 'Red',
      color: '#ef4444',
      message: 'High-risk indicators detected.',
      actionLabel: null,
    };
  }, [currentStatus]);

  const handleStatusAction = () => {
    if (currentStatus === 'green') {
      router.push('/exit_fund');
      return;
    }
    if (currentStatus === 'yellow') {
      Alert.alert(
        'Safety Tips',
        '1. Keep your phone charged.\n2. Trust your gut.\n3. Keep your PIN secret.',
      );
    }
  };

  const saveTrustedContact = async () => {
    if (!isUnlocked) return;
    if (trustedContacts.length >= 2) {
      Alert.alert('Limit Reached', 'You can save up to 2 trusted contacts.');
      return;
    }
    if (!trustedContactPhone.trim()) {
      Alert.alert('Missing Number', 'Add a phone number to enable Support call access.');
      return;
    }
    await addTrustedContact({ name: trustedContactName, phone: trustedContactPhone });
    const nextContacts = getTrustedContacts();
    setTrustedContactsState(nextContacts);
    setTrustedContactName('');
    setTrustedContactPhone('');
    setShowContactForm(false);
    setEmojiRowVersion((prev) => prev + 1);
  };

  const openDialer = async (phone: string, fallbackAlert: string) => {
    const sanitized = phone.replace(/[^\d+]/g, '');
    if (!sanitized) {
      Alert.alert('Unavailable', fallbackAlert);
      return;
    }
    const telUrl = `tel:${sanitized}`;
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      Alert.alert('Unavailable', 'Dialer is not available on this device.');
      return;
    }
    // Do not change routes here: user should stay on current screen after dialing/canceling.
    await Linking.openURL(telUrl);
  };

  const removeTrustedContact = async (index: number) => {
    const next = trustedContacts.filter((_, idx) => idx !== index);
    await setTrustedContacts(next);
    setTrustedContactsState(next);
    setEmojiRowVersion((prev) => prev + 1);
  };

  const handleAssessmentPress = () => {
    Animated.sequence([
      Animated.timing(assessmentPressAnim, {
        toValue: 0.96,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(assessmentPressAnim, {
        toValue: 1,
        duration: 90,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.push('/assessment');
    });
  };

  const buildTrafficLightStyle = (index: number, color: string) => {
    const intensity = trafficAnim.interpolate({
      inputRange: [index - 0.65, index, index + 0.65],
      outputRange: [0, 1, 0],
      extrapolate: 'clamp',
    });
    return {
      backgroundColor: intensity.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(148,163,184,0.1)', color],
      }),
      borderColor: intensity.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(148,163,184,0.35)', color],
      }),
      shadowColor: color,
      shadowOpacity: intensity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.85],
      }),
      shadowRadius: intensity.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 20],
      }),
      transform: [
        {
          scale: intensity.interpolate({
            inputRange: [0, 1],
            outputRange: [0.92, 1.03],
          }),
        },
      ],
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={showEmergencyModal} transparent animationType="fade">
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyContent}>
            <Text style={styles.emergencyTitle}>EMERGENCY PROTOCOL ACTIVATED</Text>
            <Text style={styles.emergencyMessage}>Safety measures are now in progress.</Text>
            <TouchableOpacity style={styles.emergencyButton} onPress={() => setShowEmergencyModal(false)}>
              <Text style={styles.emergencyButtonText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Safe Zone</Text>
          <TouchableOpacity style={styles.quickExitButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.quickExitEmoji}>🧮</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.trafficShell}>
          <View style={styles.trafficHousing}>
            <Animated.View style={[styles.trafficLight, buildTrafficLightStyle(0, '#ef4444')]} />
            <Animated.View style={[styles.trafficLight, buildTrafficLightStyle(1, '#facc15')]} />
            <Animated.View style={[styles.trafficLight, buildTrafficLightStyle(2, '#22c55e')]} />
          </View>
          <Text style={styles.statusMessage}>{statusMeta.label} - {statusMeta.message}</Text>
        </View>

        <View style={styles.affirmationCard}>
          <Text style={styles.affirmationLabel}>Today&apos;s Affirmation</Text>
          <Text style={styles.affirmationText}>{currentStatus === 'green' ? greenEmpowermentQuote : affirmation}</Text>
          {currentStatus === 'green' ? (
            <View style={styles.greenEmpowermentCard}>
              <View style={styles.greenIconWrap}>
                <Text style={styles.greenIcon}>✓</Text>
              </View>
              <Text style={styles.greenAffirmation}>{greenEmpowermentQuote}</Text>
              <Text style={styles.greenSupportText}>{GREEN_SUPPORT_TEXT}</Text>
              <TouchableOpacity style={styles.greenActionButton} onPress={handleStatusAction}>
                <Text style={styles.greenActionButtonText}>Focus on Your Future Fund</Text>
              </TouchableOpacity>
            </View>
          ) : statusMeta.actionLabel ? (
            <TouchableOpacity style={styles.cardActionButton} onPress={handleStatusAction}>
              <Text style={styles.cardActionButtonText}>{statusMeta.actionLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isUnlocked && showContactForm ? (
          <Animated.View
            style={[
              styles.card,
              styles.safetyCard,
              currentStatus === 'red' ? styles.safetyCardEmergency : null,
              {
                opacity: contactFormAnim,
                transform: [
                  {
                    translateY: contactFormAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.contactInputWrap}>
                <TextInput
                  style={styles.contactInput}
                  value={trustedContactName}
                  onChangeText={setTrustedContactName}
                  placeholder="Support Contact Name (optional)"
                  placeholderTextColor="#9ca3af"
                />
                <TextInput
                  style={styles.contactInput}
                  value={trustedContactPhone}
                  onChangeText={setTrustedContactPhone}
                  placeholder="Support Contact Phone"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  style={[styles.contactSaveButton, currentStatus === 'red' ? styles.contactSaveButtonEmergency : null]}
                  onPress={() => void saveTrustedContact()}>
                  <Text style={styles.contactSaveButtonText}>
                    {trustedContacts.length > 0 ? 'Add Another' : 'Save'}
                  </Text>
                </TouchableOpacity>
                {trustedContacts.length > 0 ? (
                  <View style={styles.manageRow}>
                    {trustedContacts.map((_, index) => (
                      <TouchableOpacity
                        key={`remove-${index}`}
                        style={styles.removePill}
                        onPress={() => void removeTrustedContact(index)}>
                        <Text style={styles.removePillText}>Remove {index + 1}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
            </View>
          </Animated.View>
        ) : null}

        <View style={styles.bottomActions}>
          {isUnlocked ? (
            <View style={styles.emergencyActionsBottom}>
              <TouchableOpacity
                style={[styles.hotlineButton, styles.primaryEmergencyButton]}
                accessibilityRole="button"
                accessibilityLabel="Call Police 100"
                onPress={() => void openDialer('100', 'Unable to prepare the police call.')}>
                <Text style={styles.hotlineEmoji}>🚨</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.hotlineButton, styles.hotline118Button]}
                accessibilityRole="button"
                accessibilityLabel="Call Emergency Hotline 118"
                onPress={() => void openDialer('118', 'Unable to prepare the emergency hotline call.')}>
                <Text style={styles.hotlineEmoji}>🛡️</Text>
              </TouchableOpacity>
              <View key={`emoji-row-${emojiRowVersion}`} style={styles.supportEmojiRow}>
                {trustedContacts[0]?.phone ? (
                  <TouchableOpacity
                    style={[styles.emergencyActionButton, styles.secondaryEmergencyButton]}
                    onPress={() => void openDialer(trustedContacts[0].phone, 'Please add contact one first.')}>
                    <Text style={styles.emojiActionText}>👼</Text>
                  </TouchableOpacity>
                ) : null}
                {trustedContacts[1]?.phone ? (
                  <TouchableOpacity
                    style={[styles.emergencyActionButton, styles.secondaryEmergencyButton]}
                    onPress={() => void openDialer(trustedContacts[1].phone, 'Please add contact two first.')}>
                    <Text style={styles.emojiActionText}>🧚‍♀️</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {isUnlocked ? (
                <TouchableOpacity style={styles.plusTriggerButton} onPress={() => setShowContactForm((prev) => !prev)}>
                  <Text style={styles.plusTriggerText}>+</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <Animated.View style={{ transform: [{ scale: assessmentPressAnim }] }}>
            <TouchableOpacity style={styles.mainButton} onPress={handleAssessmentPress}>
              <Text style={styles.mainButtonText}>Status Assessment</Text>
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={styles.mainButton} onPress={() => router.push('/exit_fund')}>
            <Text style={styles.mainButtonText}>Exit Fund</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.mainButton} onPress={() => router.push('/shelters')}>
            <Text style={styles.mainButtonText}>Shelter Directory</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 26,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  quickExitButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  quickExitEmoji: {
    fontSize: 15,
  },
  trafficShell: {
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  trafficHousing: {
    width: 102,
    borderRadius: 28,
    paddingVertical: 12,
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  trafficLight: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.4,
  },
  affirmationCard: {
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.12)',
  },
  affirmationLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  affirmationText: {
    marginTop: 8,
    color: '#f8fafc',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
  },
  card: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d1d5db',
    marginBottom: 10,
  },
  statusMessage: {
    marginTop: 10,
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
  },
  greenEmpowermentCard: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#06120c',
    borderWidth: 1,
    borderColor: '#14532d',
    alignItems: 'center',
  },
  greenIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#14532d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  greenIcon: {
    color: '#d1fae5',
    fontSize: 18,
    fontWeight: '800',
  },
  greenAffirmation: {
    color: '#a7f3d0',
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 1.1,
    textTransform: 'lowercase',
  },
  greenSupportText: {
    marginTop: 12,
    color: '#6ee7b7',
    fontSize: 13,
    lineHeight: 26,
    textAlign: 'center',
    letterSpacing: 0.6,
  },
  greenActionButton: {
    marginTop: 14,
    backgroundColor: '#dcfce7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  greenActionButtonText: {
    color: '#14532d',
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCard: {
    backgroundColor: '#0b1220',
  },
  safetyCardEmergency: {
    backgroundColor: '#7f1d1d',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  contactInputWrap: {
    gap: 8,
    marginTop: 6,
  },
  contactInput: {
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  contactSaveButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactSaveButtonEmergency: {
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  contactSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  manageRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  removePill: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removePillText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
  },
  emergencyActionButton: {
    borderRadius: 18,
    width: 52,
    height: 52,
    paddingVertical: 0,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotlineButton: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primaryEmergencyButton: {
    backgroundColor: '#b91c1c',
    borderColor: '#dc2626',
  },
  hotline118Button: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  secondaryEmergencyButton: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#475569',
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
    justifyContent: 'center',
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
    backgroundColor: 'rgba(136,136,136,0.15)',
  },
  plusTriggerText: {
    color: '#8a8a8a',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
  },
  bottomActions: {
    marginTop: 'auto',
  },
  cardActionButton: {
    marginTop: 14,
    alignSelf: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cardActionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  mainButton: {
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  mainButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
  },
  emergencyOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  emergencyContent: {
    backgroundColor: '#7f1d1d',
    borderRadius: 18,
    padding: 22,
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  emergencyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },
  emergencyMessage: {
    marginTop: 10,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  emergencyButton: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
  },
  emergencyButtonText: {
    color: '#7f1d1d',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
  },
});
