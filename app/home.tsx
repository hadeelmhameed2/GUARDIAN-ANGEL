import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
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

const HEADER_GRADIENTS = {
  red: ['#fdecec', '#f9dede', '#f7e8e6'],
  yellow: ['#fff4dd', '#fdeac8', '#fef8e8'],
  green: ['#e8f5e9', '#dff0e1', '#eef8ef'],
} as const;

const PAGE_GRADIENTS = {
  red: ['#FFD6D6', '#FAF3E0'],
  yellow: ['#FFE8D1', '#FAF3E0'],
  green: ['#E8F5E9', '#FAF3E0'],
} as const;
const BRANCH_TINT: Record<RiskState, string> = {
  red: '#9f4b4b',
  yellow: '#a8692e',
  green: '#4d6d52',
};

const STATUS_SCENARIOS = {
  red: {
    pillBg: '#FDECEC',
    pillTextKey: 'homeScreen.status.redPill',
    titleKey: 'homeScreen.status.redTitle',
    descriptionKey: 'homeScreen.status.redDescription',
  },
  yellow: {
    pillBg: '#FEF9E7',
    pillTextKey: 'homeScreen.status.yellowPill',
    titleKey: 'homeScreen.status.yellowTitle',
    descriptionKey: 'homeScreen.status.yellowDescription',
  },
  green: {
    pillBg: '#E8F5E9',
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

const ASSESSMENT_HERO_BG = {
  red: '#FFD6D6',
  yellow: '#FFE8D1',
  green: '#E8F5E9',
} as const;

const ACTION_GRID_BG = {
  red: '#fdeeee',
  yellow: '#fdf3e4',
  green: '#edf6ee',
} as const;

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
  const [isTriggeringEmergency, setIsTriggeringEmergency] = useState(false);
  const [panicPhoneNumber, setPanicPhoneNumber] = useState('');
  const [panicMessage, setPanicMessage] = useState('');
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
    }, []),
  );

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
      red: '#ef4444',
      yellow: '#f59e0b',
      green: '#22c55e',
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.headerIconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('homeScreen.safeZone')}</Text>
          <View style={styles.headerRightActions}>
            <LanguageSwitcher />
            <TouchableOpacity style={styles.quickExitButton} onPress={() => router.replace('/(tabs)')}>
              <Image source={require('../assets/images/image_10.png')} style={styles.stealthExitImage} />
            </TouchableOpacity>
          </View>
        </View>

        <LinearGradient colors={headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trafficShell}>
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
          <View style={styles.headerAffirmationBox}>
            <Text style={styles.headerAffirmationIcon}>🤍</Text>
            <Text style={styles.headerAffirmationText}>{t(heartAffirmationKey)}</Text>
          </View>
        </LinearGradient>

        <View style={styles.bottomActions}>
          <Text style={styles.actionSubheader}>{t('homeScreen.actions.subheader')}</Text>
          <TouchableOpacity
            style={[styles.securityTipsButton, { backgroundColor: ACTION_GRID_BG[currentStatus] }]}
            onPress={() => setShowSafetyTipsModal(true)}>
            <Text style={styles.securityTipsTitle}>{t('homeScreen.actions.securityTipsTitle')}</Text>
            <Text style={styles.securityTipsDescription}>{t('homeScreen.actions.securityTipsDescription')}</Text>
            <Text style={styles.securityTipsArrow}>&gt;</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.assessmentHeroCard, { backgroundColor: ASSESSMENT_HERO_BG[currentStatus] }]} onPress={() => router.push('/assessment')}>
            <Text style={styles.assessmentHeroTitle}>{t('homeScreen.actions.startAssessmentTitle')}</Text>
            <Text style={styles.assessmentHeroDescription}>{t('homeScreen.actions.startAssessmentDescription')}</Text>
            <View style={styles.assessmentHeroActionRow}>
              <Text style={styles.assessmentHeroActionText}>{t('homeScreen.actions.startQuiz')}</Text>
              <Text style={styles.assessmentHeroArrow}>&gt;</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.actionGridRow}>
            <TouchableOpacity style={[styles.actionGridCard, { backgroundColor: ACTION_GRID_BG[currentStatus] }]} onPress={() => setShowSupportModal(true)}>
              <Image source={require('../assets/images/image_12.png')} style={styles.actionGridIconImage} />
              <Text style={styles.actionGridTitle}>{t('homeScreen.support.title')}</Text>
              <Text style={styles.actionGridDescription}>{t('homeScreen.actions.talkToSomeoneDescription')}</Text>
              <Text style={styles.actionGridArrow}>&gt;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionGridCard, { backgroundColor: ACTION_GRID_BG[currentStatus] }]} onPress={() => router.push('/shelters')}>
              <Image source={require('../assets/images/image_11.png')} style={styles.actionGridIconImage} />
              <Text style={styles.actionGridTitle}>{t('homeScreen.actions.shelters')}</Text>
              <Text style={styles.actionGridDescription}>{t('homeScreen.actions.sheltersDescription')}</Text>
              <Text style={styles.actionGridArrow}>&gt;</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionGridCard, styles.emergencyActionGridCard]}
              onPress={() => void triggerEmergencyIntervention()}
              accessibilityRole="button"
              accessibilityLabel={t('panic.triggerTitle')}>
              <Text style={styles.actionGridIconEmoji}>🚨</Text>
              <Text style={[styles.actionGridTitle, styles.emergencyActionGridTitle]}>{t('panic.triggerTitle')}</Text>
              <Text style={[styles.actionGridDescription, styles.emergencyActionGridDescription]}>
                {isTriggeringEmergency ? t('panic.triggering') : t('panic.triggerDescription')}
              </Text>
              <TouchableOpacity style={styles.panicInlineSetupButton} onPress={() => setShowPanicSettingsModal(true)}>
                <Text style={styles.panicInlineSetupText}>{t('panic.setup.open')}</Text>
              </TouchableOpacity>
              <Text style={[styles.actionGridArrow, styles.emergencyActionGridArrow]}>&gt;</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionGridCard, { backgroundColor: ACTION_GRID_BG[currentStatus] }]} onPress={() => router.push('/exit_fund')}>
              <Image source={require('../assets/images/image_13.png')} style={styles.actionGridIconImage} />
              <Text style={styles.actionGridTitle}>{t('homeScreen.actions.secureResources')}</Text>
              <Text style={styles.actionGridDescription}>{t('homeScreen.actions.secureResourcesDescription')}</Text>
              <Text style={styles.actionGridArrow}>&gt;</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    opacity: 0.15,
    transform: [{ rotate: '-14deg' }],
    zIndex: 0,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 26,
    flexGrow: 1,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#1c2b3a',
    textAlign: 'left',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#dce5ee',
  },
  headerIconText: {
    color: '#4a5d72',
    fontSize: 16,
    fontWeight: '700',
  },
  quickExitButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#dce5ee',
    paddingHorizontal: 12,
  },
  quickExitEmoji: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
  },
  stealthExitImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  trafficShell: {
    marginBottom: 20,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    padding: 25,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  headerMainRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
    writingDirection: 'ltr',
  },
  trafficHousingSoft: {
    width: 74,
    borderRadius: 24,
    paddingVertical: 14,
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(32,41,52,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#111827',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  trafficLightSoft: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    paddingVertical: 7,
  },
  statusPillText: {
    color: '#2D3436',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  affirmationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  affirmationLabel: {
    color: '#6b7f95',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  affirmationText: {
    marginTop: 8,
    color: '#1c2b3a',
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 10,
  },
  statusMessage: {
    marginTop: 10,
    fontSize: 25,
    color: '#2D3436',
    textAlign: 'left',
    lineHeight: 32,
    fontWeight: '700',
    writingDirection: 'ltr',
  },
  statusSubMessage: {
    marginTop: 10,
    color: '#2D3436',
    fontSize: 14,
    textAlign: 'left',
    lineHeight: 21,
    writingDirection: 'ltr',
  },
  headerAffirmationBox: {
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#FFF5F5',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    writingDirection: 'ltr',
  },
  headerAffirmationIcon: {
    fontSize: 18,
    lineHeight: 23,
  },
  headerAffirmationText: {
    flex: 1,
    color: '#2D3436',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  greenEmpowermentCard: {
    marginTop: 14,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
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
    color: '#334155',
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '300',
    textAlign: 'left',
    letterSpacing: 1.1,
    textTransform: 'lowercase',
  },
  greenSupportText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 13,
    lineHeight: 26,
    textAlign: 'left',
    letterSpacing: 0.6,
  },
  greenActionButton: {
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dbe4ec',
  },
  greenActionButtonText: {
    color: '#42566b',
    fontSize: 13,
    fontWeight: '700',
  },
  safetyCard: {
    backgroundColor: '#ffffff',
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
    borderColor: '#d3dee8',
    backgroundColor: '#f8fbff',
    color: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  panicMessageInput: {
    minHeight: 96,
  },
  contactSaveButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#ecf1f7',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactSaveButtonEmergency: {
    backgroundColor: '#991b1b',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  contactSaveButtonText: {
    color: '#42566b',
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
    backgroundColor: '#eef3f8',
    borderWidth: 1,
    borderColor: '#d3dee8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  removePillText: {
    color: '#475569',
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
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: '#d3dee8',
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
    justifyContent: 'flex-start',
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
  actionSubheader: {
    marginTop: 6,
    marginBottom: 14,
    color: '#2D3436',
    fontSize: 21,
    fontFamily: 'serif',
    textAlign: 'left',
  },
  securityTipsButton: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  securityTipsTitle: {
    color: '#2D3436',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  securityTipsDescription: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  securityTipsArrow: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
  },
  assessmentHeroCard: {
    width: '100%',
    borderRadius: 25,
    padding: 25,
    marginBottom: 16,
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#cde5d1',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  assessmentHeroTitle: {
    marginTop: 0,
    color: '#2D3436',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  assessmentHeroDescription: {
    marginTop: 10,
    color: '#3f4c4f',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  assessmentHeroActionRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  assessmentHeroActionText: {
    color: '#2D3436',
    fontSize: 14,
    fontWeight: '700',
  },
  assessmentHeroArrow: {
    color: '#2D3436',
    fontSize: 16,
    fontWeight: '700',
  },
  actionGridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionGridCard: {
    width: '48.5%',
    minHeight: 176,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  emergencyActionGridCard: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
    shadowColor: '#7f1d1d',
    shadowOpacity: 0.22,
  },
  actionGridIconImage: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  actionGridIconEmoji: {
    fontSize: 22,
    marginBottom: 8,
  },
  actionGridTitle: {
    color: '#2D3436',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  emergencyActionGridTitle: {
    color: '#fff',
  },
  actionGridDescription: {
    marginTop: 8,
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  emergencyActionGridDescription: {
    color: '#fee2e2',
  },
  actionGridArrow: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'left',
  },
  emergencyActionGridArrow: {
    color: '#fff',
  },
  panicInlineSetupButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  panicInlineSetupText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  supportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  supportModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  supportModalTitle: {
    color: '#2D3436',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportActionButton: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  supportActionText: {
    color: '#2D3436',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportEmptyText: {
    marginVertical: 4,
    color: '#6b7280',
    fontSize: 12,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  supportCloseButton: {
    marginTop: 6,
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
  },
  supportCloseText: {
    textAlign: 'center',
    color: '#374151',
    fontWeight: '700',
  },
  safetyTipsModal: {
    backgroundColor: '#F8F4EA',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbe7d9',
  },
  safetyTipsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  safetyTipsTitle: {
    color: '#2D3436',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'left',
  },
  safetyTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  safetyTipIcon: {
    fontSize: 14,
    lineHeight: 20,
  },
  safetyTipText: {
    flex: 1,
    color: '#2D3436',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  cardActionButton: {
    marginTop: 14,
    alignSelf: 'stretch',
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#dbe4ec',
  },
  cardActionButtonText: {
    color: '#42566b',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  mainButton: {
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#dbe4ec',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
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
    color: '#42566b',
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    writingDirection: 'ltr',
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
