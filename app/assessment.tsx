import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { setCurrentStatus, statusFromScore } from './risk-status';
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
  const progressLabel = useMemo(() => `${questionIndex + 1} / ${QUESTIONS.length}`, [questionIndex]);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Status Assessment</Text>
        <TouchableOpacity style={styles.quickExit} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.quickExitText}>🧮</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.progress}>Question {progressLabel}</Text>
        <Text style={styles.category}>{currentQuestion.category}</Text>
        <Text style={styles.body}>{currentQuestion.text}</Text>
      </View>

      {OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.label}
          style={styles.button}
          onPress={() => void handleAnswer(option.label)}>
          <Text style={styles.buttonText}>{option.label}</Text>
        </TouchableOpacity>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  quickExit: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickExitText: {
    color: '#fff',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1,
    borderColor: '#242424',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  progress: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 8,
  },
  category: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f5f5f5',
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: '#f5f5f5',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
