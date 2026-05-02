import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getCurrentStatus, setCurrentStatus, statusFromScore, type RiskState } from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';
import { BranchTint, Fonts, PageGradient, Palette, Shadow } from '@/constants/theme';

type AnswerOption = {
  key: 'never' | 'rarely' | 'sometimes' | 'often' | 'always';
  points: number;
};

type Question = {
  id: string;
  category: 'green' | 'yellow' | 'red';
  textKey: string;
  isPositive: boolean;
};

const QUESTIONS: Question[] = [
  { id: 'g1', category: 'green', textKey: 'assessment.questions.g1', isPositive: true },
  { id: 'g2', category: 'green', textKey: 'assessment.questions.g2', isPositive: true },
  { id: 'g3', category: 'green', textKey: 'assessment.questions.g3', isPositive: true },
  { id: 'y1', category: 'yellow', textKey: 'assessment.questions.y1', isPositive: false },
  { id: 'y2', category: 'yellow', textKey: 'assessment.questions.y2', isPositive: false },
  { id: 'y3', category: 'yellow', textKey: 'assessment.questions.y3', isPositive: false },
  { id: 'r1', category: 'red', textKey: 'assessment.questions.r1', isPositive: false },
  { id: 'r2', category: 'red', textKey: 'assessment.questions.r2', isPositive: false },
  { id: 'r3', category: 'red', textKey: 'assessment.questions.r3', isPositive: false },
  { id: 'r4', category: 'red', textKey: 'assessment.questions.r4', isPositive: false },
];

const OPTIONS: AnswerOption[] = [
  { key: 'never', points: 0 },
  { key: 'rarely', points: 1 },
  { key: 'sometimes', points: 2 },
  { key: 'often', points: 3 },
  { key: 'always', points: 4 },
];

const CATEGORY_THEME = {
  green: { bg: Palette.sageSoft, color: Palette.statusGreenInk, emoji: '✿' },
  yellow: { bg: Palette.goldSoft, color: Palette.statusYellowInk, emoji: '✧' },
  red: { bg: Palette.roseSoft, color: Palette.statusRedInk, emoji: '❀' },
} as const;

const PAGE_GRADIENTS = PageGradient;
const BRANCH_TINT: Record<RiskState, string> = BranchTint;

function scoreAnswer(key: AnswerOption['key'], isPositive: boolean) {
  const basePoints = OPTIONS.find((option) => option.key === key)?.points ?? 0;
  return isPositive ? 4 - basePoints : basePoints;
}

export default function AssessmentScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const direction = typeof i18n.dir === 'function' ? i18n.dir() : 'ltr';
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const currentQuestion = QUESTIONS[questionIndex];
  const currentStatus = getCurrentStatus();
  const progressLabel = useMemo(() => `${questionIndex + 1} / ${QUESTIONS.length}`, [questionIndex]);
  const progressPercent = useMemo(() => ((questionIndex + 1) / QUESTIONS.length) * 100, [questionIndex]);
  const categoryTheme = CATEGORY_THEME[currentQuestion.category];

  const handleAnswer = async (key: AnswerOption['key']) => {
    const points = scoreAnswer(key, currentQuestion.isPositive);
    const nextScore = totalScore + points;
    const isFinal = questionIndex === QUESTIONS.length - 1;

    if (isFinal) {
      try {
        await setCurrentStatus(statusFromScore(nextScore));
      } catch {
        // Continue navigation even if persistence fails.
      }
      router.replace('/home');
      return;
    }

    setTotalScore(nextScore);
    setQuestionIndex((prev) => prev + 1);
  };

  return (
    <LinearGradient
      colors={PAGE_GRADIENTS[currentStatus]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.pageGradient}>
    <SafeAreaView style={[styles.container, { direction }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerIconButton} onPress={handleBack} accessibilityLabel="Back">
          <Text style={{ fontSize: 22, color: Palette.inkSoft, lineHeight: 22 }}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('assessment.title')}</Text>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.replace('/(tabs)')}
          accessibilityLabel="Exit">
          <Text style={{ fontSize: 18, color: Palette.inkSoft, lineHeight: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.card}>
        <View style={styles.questionHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryTheme.bg }]}>
            <Text style={styles.categoryEmoji}>{categoryTheme.emoji}</Text>
            <Text style={[styles.categoryText, { color: categoryTheme.color }]}>
              {t(`assessment.categories.${currentQuestion.category}`)}
            </Text>
          </View>
          <Text style={styles.progress}>{t('assessment.questionLabel', { value: progressLabel })}</Text>
        </View>
        <Text style={styles.body}>{t(currentQuestion.textKey)}</Text>
      </View>

      <View style={styles.optionsWrap}>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={styles.button}
            activeOpacity={0.75}
            onPress={() => void handleAnswer(option.key)}>
            <Text style={styles.buttonText}>{t(`assessment.options.${option.key}`)}</Text>
            <Text style={{ fontSize: 18, color: Palette.primary, lineHeight: 18 }}>▶</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>{t('assessment.footer')}</Text>
      </View>
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
    padding: 20,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    color: Palette.ink,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 12,
  },
  headerIconButton: {
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
  progressBarWrap: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1E4DA',
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  card: {
    backgroundColor: '#FFFCF9',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 28,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.lift,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  progress: {
    fontSize: 12,
    color: Palette.inkMuted,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 20,
    color: Palette.ink,
    lineHeight: 30,
    textAlign: 'left',
    fontFamily: Fonts.serif,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  optionsWrap: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 16,
    ...Shadow.soft,
  },
  buttonText: {
    color: Palette.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footerWrap: {
    marginTop: 'auto',
    paddingTop: 18,
    alignItems: 'center',
  },
  footerText: {
    color: Palette.inkMuted,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
    fontStyle: 'italic',
  },
});
