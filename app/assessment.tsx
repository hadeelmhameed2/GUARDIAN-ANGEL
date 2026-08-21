import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ChevronRight, Diamond, ShieldAlert, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getCurrentStatus, resolveAssessmentStatus, setCurrentStatus } from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';
import { useRtlTextStyle } from '@/hooks/use-rtl-text-style';
import { Fonts, PageGradient, Palette, Shadow } from '@/constants/theme';

type RiskAnswerKey = 'never' | 'rarely' | 'often' | 'always';

type QuestionCategory = 'screening' | 'critical';

type Question = {
  id: string;
  category: QuestionCategory;
  textKey: string;
};

const QUESTIONS: Question[] = [
  { id: 'q1', category: 'screening', textKey: 'assessment.questions.q1' },
  { id: 'q2', category: 'screening', textKey: 'assessment.questions.q2' },
  { id: 'q3', category: 'screening', textKey: 'assessment.questions.q3' },
  { id: 'q4', category: 'screening', textKey: 'assessment.questions.q4' },
  { id: 'q5', category: 'screening', textKey: 'assessment.questions.q5' },
  { id: 'q6', category: 'screening', textKey: 'assessment.questions.q6' },
  { id: 'q7', category: 'screening', textKey: 'assessment.questions.q7' },
  { id: 'q8', category: 'screening', textKey: 'assessment.questions.q8' },
  { id: 'q9', category: 'screening', textKey: 'assessment.questions.q9' },
  { id: 'q10', category: 'screening', textKey: 'assessment.questions.q10' },
  { id: 'c1', category: 'critical', textKey: 'assessment.questions.critical1' },
  { id: 'c2', category: 'critical', textKey: 'assessment.questions.critical2' },
  { id: 'c3', category: 'critical', textKey: 'assessment.questions.critical3' },
];

const OPTIONS: { key: RiskAnswerKey; points: number }[] = [
  { key: 'never', points: 0 },
  { key: 'rarely', points: 1 },
  { key: 'often', points: 2 },
  { key: 'always', points: 3 },
];

const CATEGORY_THEME = {
  screening: { bg: Palette.goldSoft, color: Palette.statusYellowInk, Icon: Diamond },
  critical: { bg: Palette.roseSoft, color: Palette.statusRedInk, Icon: ShieldAlert },
} as const;

const PAGE_GRADIENTS = PageGradient;

/** Critical items: anything except Never escalates to red (zero-tolerance). */
function criticalEscalates(key: RiskAnswerKey): boolean {
  return key !== 'never';
}

export default function AssessmentScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const direction = typeof i18n.dir === 'function' ? i18n.dir() : 'ltr';
  const { rtlText, rtlWriting } = useRtlTextStyle();
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [mainScore, setMainScore] = useState(0);
  const [criticalHighRisk, setCriticalHighRisk] = useState(false);
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  const currentQuestion = QUESTIONS[questionIndex];
  const currentStatus = getCurrentStatus();
  const totalSteps = QUESTIONS.length;
  const progressLabel = useMemo(() => `${questionIndex + 1} / ${totalSteps}`, [questionIndex, totalSteps]);
  const progressPercent = useMemo(() => ((questionIndex + 1) / totalSteps) * 100, [questionIndex, totalSteps]);
  const categoryTheme = CATEGORY_THEME[currentQuestion.category];

  const handleAnswer = async (key: RiskAnswerKey) => {
    const option = OPTIONS.find((o) => o.key === key);
    const points = option?.points ?? 0;
    const isLast = questionIndex === QUESTIONS.length - 1;

    let nextMain = mainScore;
    let nextCritical = criticalHighRisk;

    if (currentQuestion.category === 'screening') {
      nextMain = mainScore + points;
    } else {
      nextCritical = criticalHighRisk || criticalEscalates(key);
    }

    if (isLast) {
      try {
        await setCurrentStatus(resolveAssessmentStatus(nextMain, nextCritical));
      } catch {
        // Continue navigation even if persistence fails.
      }
      router.replace('/home');
      return;
    }

    setMainScore(nextMain);
    setCriticalHighRisk(nextCritical);
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
          <ArrowLeft size={18} color={Palette.inkSoft} strokeWidth={2.25} />
        </TouchableOpacity>
        <Text style={[styles.title, rtlWriting]}>{t('assessment.title')}</Text>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.replace('/(tabs)')}
          accessibilityLabel="Exit">
          <X size={17} color={Palette.inkSoft} strokeWidth={2.25} />
        </TouchableOpacity>
      </View>

      <View style={styles.progressBarWrap}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.card}>
        <View style={styles.questionHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryTheme.bg }]}>
            <categoryTheme.Icon size={13} color={categoryTheme.color} strokeWidth={2.25} />
            <Text style={[styles.categoryText, { color: categoryTheme.color }, rtlText]}>
              {t(`assessment.categories.${currentQuestion.category}`)}
            </Text>
          </View>
          <Text style={[styles.progress, rtlText]}>{t('assessment.questionLabel', { value: progressLabel })}</Text>
        </View>
        <Text style={[styles.body, rtlText]}>{t(currentQuestion.textKey)}</Text>
      </View>

      <View style={styles.optionsWrap}>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={styles.button}
            activeOpacity={0.75}
            onPress={() => void handleAnswer(option.key)}>
            <Text style={[styles.buttonText, rtlText]}>{t(`assessment.options.${option.key}`)}</Text>
            <ChevronRight size={18} color={Palette.primary} strokeWidth={2.25} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footerWrap}>
        <Text style={[styles.footerText, rtlText]}>
          {currentQuestion.category === 'critical' ? t('assessment.footerCritical') : t('assessment.footer')}
        </Text>
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
    fontFamily: Fonts.serif,
    fontWeight: '500',
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
