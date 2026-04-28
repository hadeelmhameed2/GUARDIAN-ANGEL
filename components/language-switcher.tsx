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
        <Text style={styles.iconText}>🌐</Text>
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
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,250,252,0.82)',
    borderWidth: 1,
    borderColor: '#dbe4ec',
  },
  iconText: {
    fontSize: 15,
    opacity: 0.84,
  },
  dropdown: {
    position: 'absolute',
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 6,
    shadowColor: '#0f172a',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  optionButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  optionButtonActive: {
    backgroundColor: '#e5f0ff',
  },
  optionText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#1d4ed8',
  },
  savingText: {
    marginTop: 4,
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
});
