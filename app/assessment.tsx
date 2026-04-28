import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { getCurrentStatus, setCurrentStatus, statusFromScore, type RiskState } from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';

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
  green: { bg: '#E8F5E9', color: '#2E7D32', emoji: '🌿' },
  yellow: { bg: '#FEF9E7', color: '#F9A825', emoji: '⚡' },
  red: { bg: '#FDECEC', color: '#C62828', emoji: '🔴' },
} as const;

const PAGE_GRADIENTS: Record<RiskState, [string, string]> = {
  red: ['#FFD6D6', '#FAF3E0'],
  yellow: ['#FFE8D1', '#FAF3E0'],
  green: ['#E8F5E9', '#FAF3E0'],
};
const BRANCH_TINT: Record<RiskState, string> = {
  red: '#9f4b4b',
  yellow: '#a8692e',
  green: '#4d6d52',
};

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
      <View pointerEvents="none" style={styles.branchOverlayWrap}>
        <Image
          source={require('../assets/images/traffic-light-bg.png')}
          style={[styles.branchOverlay, { tintColor: BRANCH_TINT[currentStatus] }]}
        />
      </View>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerIconButton} onPress={handleBack}>
          <Image source={require('../assets/images/turn-back.png')} style={styles.backArrowImage} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('assessment.title')}</Text>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.replace('/(tabs)')}>
          <Image source={require('../assets/images/image_10.png')} style={styles.stealthExitImage} />
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
            activeOpacity={0.7}
            onPress={() => void handleAnswer(option.key)}>
            <Text style={styles.buttonText}>{t(`assessment.options.${option.key}`)}</Text>
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  headerIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  backArrowImage: {
    width: 25,
    height: 25,
    resizeMode: 'contain',
    tintColor: '#374151',
  },
  headerExitEmoji: {
    fontSize: 16,
  },
  stealthExitImage: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  progressBarWrap: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#5F7A61',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 30,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryEmoji: {
    fontSize: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  progress: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  body: {
    fontSize: 18,
    color: '#2D3436',
    lineHeight: 28,
    textAlign: 'left',
    writingDirection: 'ltr',
    fontWeight: '600',
  },
  optionsWrap: {
    gap: 10,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonText: {
    color: '#2D3436',
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '500',
  },
  footerWrap: {
    marginTop: 'auto',
    paddingTop: 16,
    alignItems: 'center',
  },
  footerText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '500',
  },
});
