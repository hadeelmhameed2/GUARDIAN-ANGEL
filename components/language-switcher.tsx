import { Globe } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type View as RNView,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { Palette, Radii, Shadow } from '@/constants/theme';
import { getSupportedLanguages, setAppLanguage, type AppLanguage } from '@/src/i18n';

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 56, left: 16 });
  const triggerRef = useRef<RNView | null>(null);

  const options: { code: AppLanguage; label: string }[] = [
    { code: 'en', label: t('language.english') },
    { code: 'he', label: t('language.hebrew') },
    { code: 'ar', label: t('language.arabic') },
  ];

  const changeLanguage = async (language: AppLanguage) => {
    if (language === i18n.language || isSaving) return;
    setIsSaving(true);
    try {
      await setAppLanguage(language);
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMenu = () => {
    if (isOpen) {
      setIsOpen(false);
      return;
    }

    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = 170;
      const screenWidth = Dimensions.get('window').width;
      const left = Math.max(8, Math.min(x + width - menuWidth, screenWidth - menuWidth - 8));
      const top = y + height + 6;
      setMenuPosition({ top, left });
      setIsOpen(true);
    });
  };

  return (
    <View ref={triggerRef} style={styles.container}>
      <TouchableOpacity style={styles.iconButton} onPress={toggleMenu} accessibilityRole="button">
        <Globe size={16} color={Palette.inkSoft} strokeWidth={2} />
      </TouchableOpacity>
      <Modal visible={isOpen} transparent animationType="none" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View style={[styles.dropdown, { top: menuPosition.top, left: menuPosition.left }]}>
            {getSupportedLanguages().map((languageCode) => {
              const option = options.find((item) => item.code === languageCode);
              const isActive = i18n.language === languageCode;
              return (
                <TouchableOpacity
                  key={languageCode}
                  style={[styles.optionButton, isActive ? styles.optionButtonActive : null]}
                  onPress={() => void changeLanguage(languageCode)}>
                  <Text style={[styles.optionText, isActive ? styles.optionTextActive : null]}>{option?.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
      {isSaving ? <Text style={styles.savingText}>{t('common.processing')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    position: 'relative',
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,249,0.82)',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  dropdown: {
    position: 'absolute',
    width: 170,
    backgroundColor: Palette.surface,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 6,
    ...Shadow.lift,
  },
  optionButton: {
    borderRadius: Radii.xs,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionButtonActive: {
    backgroundColor: Palette.primarySoft,
  },
  optionText: {
    color: Palette.inkSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  optionTextActive: {
    color: Palette.primaryDeep,
  },
  savingText: {
    marginTop: 4,
    fontSize: 11,
    color: Palette.inkMuted,
    textAlign: 'center',
  },
});
