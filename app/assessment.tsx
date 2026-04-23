import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getCurrentStatus, setCurrentStatus, statusFromScore, type RiskState } from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';

type AnswerOption = {
  label: 'Never' | 'Rarely' | 'Sometimes' | 'Often' | 'Always';
  points: number;
};

type Question = {
  id: string;
  category: 'Green' | 'Yellow' | 'Red';
  text: string;
  isPositive: boolean;
};

const QUESTIONS: Question[] = [
  { id: 'g1', category: 'Green', text: 'Do you feel free to see friends/family without fear?', isPositive: true },
  { id: 'g2', category: 'Green', text: 'Does your partner support your success?', isPositive: true },
  { id: 'g3', category: 'Green', text: 'Do you have an equal voice in decisions?', isPositive: true },
  { id: 'y1', category: 'Yellow', text: 'Does your partner monitor your phone/messages?', isPositive: false },
  { id: 'y2', category: 'Yellow', text: 'Do you experience constant criticism or humiliation?', isPositive: false },
  { id: 'y3', category: 'Yellow', text: 'Is there a Love Bombing cycle?', isPositive: false },
  { id: 'r1', category: 'Red', text: 'Do you live in constant fear/alertness at home?', isPositive: false },
  { id: 'r2', category: 'Red', text: 'Has your partner threatened harm to you or others?', isPositive: false },
  { id: 'r3', category: 'Red', text: 'Are you denied access to your own money?', isPositive: false },
  { id: 'r4', category: 'Red', text: 'Are you prevented from work, school, or medical care?', isPositive: false },
];

const OPTIONS: AnswerOption[] = [
  { label: 'Never', points: 0 },
  { label: 'Rarely', points: 1 },
  { label: 'Sometimes', points: 2 },
  { label: 'Often', points: 3 },
  { label: 'Always', points: 4 },
];

const CATEGORY_THEME = {
  Green: { bg: '#E8F5E9', color: '#2E7D32', emoji: '🌿' },
  Yellow: { bg: '#FEF9E7', color: '#F9A825', emoji: '⚡' },
  Red: { bg: '#FDECEC', color: '#C62828', emoji: '🔴' },
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

function scoreAnswer(label: AnswerOption['label'], isPositive: boolean) {
  const basePoints = OPTIONS.find((option) => option.label === label)?.points ?? 0;
  return isPositive ? 4 - basePoints : basePoints;
}

export default function AssessmentScreen() {
  const router = useRouter();
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const currentQuestion = QUESTIONS[questionIndex];
  const currentStatus = getCurrentStatus();
  const progressLabel = useMemo(() => `${questionIndex + 1} / ${QUESTIONS.length}`, [questionIndex]);
  const progressPercent = useMemo(() => ((questionIndex + 1) / QUESTIONS.length) * 100, [questionIndex]);
  const categoryTheme = CATEGORY_THEME[currentQuestion.category];

  const handleAnswer = async (label: AnswerOption['label']) => {
    const points = scoreAnswer(label, currentQuestion.isPositive);
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
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.branchOverlayWrap}>
        <Image
          source={require('../assets/images/traffic-light-bg.png')}
          style={[styles.branchOverlay, { tintColor: BRANCH_TINT[currentStatus] }]}
        />
      </View>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
          <Image source={require('../assets/images/turn-back.png')} style={styles.backArrowImage} />
        </TouchableOpacity>
        <Text style={styles.title}>Status Assessment</Text>
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
            <Text style={[styles.categoryText, { color: categoryTheme.color }]}>{currentQuestion.category}</Text>
          </View>
          <Text style={styles.progress}>Question {progressLabel}</Text>
        </View>
        <Text style={styles.body}>{currentQuestion.text}</Text>
      </View>

      <View style={styles.optionsWrap}>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.label}
            style={styles.button}
            activeOpacity={0.7}
            onPress={() => void handleAnswer(option.label)}>
            <Text style={styles.buttonText}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerWrap}>
        <Text style={styles.footerText}>Your answers are private and secure</Text>
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
