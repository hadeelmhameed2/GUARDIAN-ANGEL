import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Fonts, Palette, Radii, Shadow } from '@/constants/theme';
import { useRtlTextStyle } from '@/hooks/use-rtl-text-style';
import { getEmergencyContact, saveEmergencyContact } from '@/src/emergency-contact';
import { disableSafetyCheckinSchedules } from '@/src/mood-checkin/pipeline';
import { getSafetySettings, saveSafetySettings } from '@/src/mood-checkin/storage';

export default function CoreSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const direction = typeof i18n.dir === 'function' ? i18n.dir() : 'ltr';
  const { rtlText } = useRtlTextStyle();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [safetyCheckinEnabled, setSafetyCheckinEnabled] = useState(false);
  const [presetSosMessage, setPresetSosMessage] = useState('');
  const [isSavingSafety, setIsSavingSafety] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/home');
  };

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const data = await getEmergencyContact();
        setName(data.name);
        setPhone(data.phone);
        setEmail(data.email);
        const safety = await getSafetySettings();
        setSafetyCheckinEnabled(safety.safetyCheckinEnabled);
        setPresetSosMessage(safety.presetSosMessage);
      })();
    }, []),
  );

  const onToggleAutomatedSos = async (value: boolean) => {
    setSafetyCheckinEnabled(value);
    try {
      await saveSafetySettings({ safetyCheckinEnabled: value, presetSosMessage });
      if (!value) {
        await disableSafetyCheckinSchedules();
      }
    } catch {
      setSafetyCheckinEnabled(!value);
      Alert.alert(t('panic.settings.errorTitle'), t('panic.settings.saveErrorMessage'));
    }
  };

  const onSaveSafetyMessage = async () => {
    setIsSavingSafety(true);
    try {
      await saveSafetySettings({ safetyCheckinEnabled, presetSosMessage });
      Alert.alert(t('panic.settings.successTitle'), t('panic.settings.successMessage'));
    } catch {
      Alert.alert(t('panic.settings.errorTitle'), t('panic.settings.saveErrorMessage'));
    } finally {
      setIsSavingSafety(false);
    }
  };

  const onSave = async () => {
    const nextName = name.trim();
    const nextPhone = phone.trim();
    const nextEmail = email.trim();

    if (!nextName || !nextPhone || !nextEmail) {
      Alert.alert(t('panic.settings.errorTitle'), t('panic.settings.requiredMessage'));
      return;
    }

    setIsSaving(true);
    try {
      await saveEmergencyContact({ name: nextName, phone: nextPhone, email: nextEmail });
      Alert.alert(t('panic.settings.successTitle'), t('panic.settings.successMessage'));
    } catch {
      Alert.alert(t('panic.settings.errorTitle'), t('panic.settings.saveErrorMessage'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LinearGradient colors={[Palette.bgPeach, Palette.bgCream]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.pageGradient}>
      <SafeAreaView style={[styles.container, { direction }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack} accessibilityRole="button">
              <ArrowLeft size={17} color={Palette.inkSoft} strokeWidth={2.25} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('panic.settings.title')}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.subtitle}>{t('panic.settings.subtitle')}</Text>
            <Text style={styles.label}>{t('panic.settings.nameLabel')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('panic.settings.namePlaceholder')}
              style={styles.input}
              placeholderTextColor={Palette.inkFaint}
            />
            <Text style={styles.label}>{t('panic.settings.phoneLabel')}</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder={t('panic.settings.phonePlaceholder')}
              style={styles.input}
              placeholderTextColor={Palette.inkFaint}
            />
            <Text style={styles.label}>{t('panic.settings.emailLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder={t('panic.settings.emailPlaceholder')}
              style={styles.input}
              placeholderTextColor={Palette.inkFaint}
            />

            <TouchableOpacity
              style={[styles.saveButton, isSaving ? styles.saveButtonDisabled : null]}
              onPress={() => void onSave()}
              disabled={isSaving}
              accessibilityRole="button">
              <Text style={styles.saveButtonText}>
                {isSaving ? t('panic.settings.savingLabel') : t('panic.settings.saveLabel')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.safetySectionTitle}>{t('moodCheckin.settingsSectionTitle')}</Text>
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, rtlText]}>{t('moodCheckin.settingsConsentLabel')}</Text>
              <Switch
                value={safetyCheckinEnabled}
                onValueChange={(v) => void onToggleAutomatedSos(v)}
                trackColor={{ false: Palette.border, true: Palette.sageSoft }}
                thumbColor={safetyCheckinEnabled ? Palette.sage : Palette.surface}
                accessibilityLabel={t('moodCheckin.settingsConsentLabel')}
              />
            </View>
            <Text style={[styles.safetyExplainer, rtlText]}>{t('moodCheckin.settingsConsentExplainer')}</Text>
            <Text style={styles.label}>{t('moodCheckin.presetSosMessageLabel')}</Text>
            <TextInput
              value={presetSosMessage}
              onChangeText={setPresetSosMessage}
              placeholder={t('moodCheckin.presetSosMessagePlaceholder')}
              placeholderTextColor={Palette.inkFaint}
              style={[styles.input, styles.safetyMessageInput, rtlText]}
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveButton, isSavingSafety ? styles.saveButtonDisabled : null]}
              onPress={() => void onSaveSafetyMessage()}
              disabled={isSavingSafety}
              accessibilityRole="button">
              <Text style={styles.saveButtonText}>
                {isSavingSafety ? t('panic.settings.savingLabel') : t('common.save')}
              </Text>
            </TouchableOpacity>
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
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.surface,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  title: {
    flex: 1,
    color: Palette.ink,
    fontSize: 24,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'left',
  },
  card: {
    backgroundColor: Palette.surface,
    borderRadius: Radii.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  subtitle: {
    color: Palette.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  label: {
    color: Palette.inkSoft,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surfaceTinted,
    color: Palette.ink,
    borderRadius: Radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.primaryDeep,
    paddingVertical: 14,
    ...Shadow.lift,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    textAlign: 'center',
    color: Palette.onPrimary,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  safetySectionTitle: {
    color: Palette.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  switchLabel: {
    flex: 1,
    flexShrink: 1,
    color: Palette.inkSoft,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  safetyExplainer: {
    color: Palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  safetyMessageInput: {
    minHeight: 100,
    marginBottom: 8,
  },
});
