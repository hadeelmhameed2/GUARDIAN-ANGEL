import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  getExitFundData,
  getIsEmergencyActive,
  hasSecureSessionAccess,
  setExitFundData,
  setUserDefinedLimit,
  stopEmergencyMode,
  type ExitFundTransaction,
} from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';

const EMERGENCY_TRANSFER_AMOUNT = 10;
const EMERGENCY_TRANSFER_INTERVAL_MS = 4000;
const LIMIT_PRESETS = [500, 1000, 3000, 5000];
const MOCK_PURCHASES = [
  { id: 'p1', label: 'Bus Ticket', amount: 18.2 },
  { id: 'p2', label: 'Groceries', amount: 74.35 },
  { id: 'p3', label: 'Pharmacy', amount: 53.6 },
  { id: 'p4', label: 'Coffee', amount: 14.9 },
];

export default function ExitFundScreen() {
  const router = useRouter();
  useShakeHide({ onShake: () => router.replace('/(tabs)') });
  const seedData = getExitFundData();
  const [balance, setBalance] = useState(seedData.exitFundBalance);
  const [mainAccountBalance, setMainAccountBalance] = useState(seedData.mainAccountBalance);
  const [targetLimit, setTargetLimit] = useState(seedData.userDefinedLimit);
  const [targetInput, setTargetInput] = useState(String(seedData.userDefinedLimit));
  const [transactionInput, setTransactionInput] = useState('');
  const [transactions, setTransactions] = useState<ExitFundTransaction[]>(seedData.transactions);
  const [isEmergencyActive, setIsEmergencyActive] = useState(getIsEmergencyActive());
  const [roundupsApplied, setRoundupsApplied] = useState(false);
  const [bufferSaved, setBufferSaved] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasSecureSessionAccess()) return;
      const saved = getExitFundData();
      setIsEmergencyActive(getIsEmergencyActive());
      setBalance(saved.exitFundBalance);
      setMainAccountBalance(saved.mainAccountBalance);
      setTargetLimit(saved.userDefinedLimit);
      setTargetInput(String(saved.userDefinedLimit));
      setTransactions(saved.transactions);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!hasSecureSessionAccess() || !isEmergencyActive) return;

      const intervalId = setInterval(() => {
        void (async () => {
          const saved = getExitFundData();
          if (saved.exitFundBalance >= saved.userDefinedLimit || saved.mainAccountBalance <= 0) {
            await stopEmergencyMode();
            setIsEmergencyActive(false);
            return;
          }
          const transferable = Math.min(
            EMERGENCY_TRANSFER_AMOUNT,
            saved.mainAccountBalance,
            saved.userDefinedLimit - saved.exitFundBalance,
          );
          if (transferable <= 0) {
            await stopEmergencyMode();
            setIsEmergencyActive(false);
            return;
          }
          const nextBalance = Number((saved.exitFundBalance + transferable).toFixed(2));
          const nextMainBalance = Number((saved.mainAccountBalance - transferable).toFixed(2));
          const nextTransaction: ExitFundTransaction = {
            id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            amount: transferable,
            createdAt: new Date().toISOString(),
            note: 'Emergency micro-transfer',
          };
          const nextTransactions = [nextTransaction, ...saved.transactions].slice(0, 8);
          setBalance(nextBalance);
          setMainAccountBalance(nextMainBalance);
          setTargetLimit(saved.userDefinedLimit);
          setTransactions(nextTransactions);
          await setExitFundData({
            exitFundBalance: nextBalance,
            mainAccountBalance: nextMainBalance,
            userDefinedLimit: saved.userDefinedLimit,
            transactions: nextTransactions,
          });
        })();
      }, EMERGENCY_TRANSFER_INTERVAL_MS);

      return () => clearInterval(intervalId);
    }, [isEmergencyActive]),
  );

  const balanceLabel = useMemo(() => `${balance.toFixed(2)} ILS`, [balance]);
  const mainBalanceLabel = useMemo(() => `${mainAccountBalance.toFixed(2)} ILS`, [mainAccountBalance]);
  const limitLabel = useMemo(() => `${targetLimit.toFixed(0)} ILS`, [targetLimit]);
  const progressPercent = useMemo(
    () => Math.min(100, Math.round((balance / Math.max(targetLimit, 1)) * 100)),
    [balance, targetLimit],
  );
  const roundupsTotal = useMemo(
    () => Number(MOCK_PURCHASES.reduce((acc, purchase) => acc + (Math.ceil(purchase.amount) - purchase.amount), 0).toFixed(2)),
    [],
  );

  const addSimulatedTransaction = async (amount: number, note: string) => {
    if (!hasSecureSessionAccess()) return;
    const nextTransaction: ExitFundTransaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      amount,
      createdAt: new Date().toISOString(),
      note,
    };
    const nextBalance = Number((balance + amount).toFixed(2));
    const nextTransactions = [nextTransaction, ...transactions].slice(0, 8);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    await setExitFundData({
      exitFundBalance: nextBalance,
      mainAccountBalance,
      userDefinedLimit: targetLimit,
      transactions: nextTransactions,
    });
  };

  const saveTargetLimit = async (rawValue: string) => {
    if (!hasSecureSessionAccess()) return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setTargetInput(String(targetLimit));
      return;
    }
    const clamped = Math.min(5000, Math.max(500, Math.round(parsed)));
    setTargetLimit(clamped);
    setTargetInput(String(clamped));
    await setUserDefinedLimit(clamped);
    await setExitFundData({
      exitFundBalance: balance,
      mainAccountBalance,
      userDefinedLimit: clamped,
      transactions,
    });
    Keyboard.dismiss();
    setBufferSaved(true);
    setTimeout(() => setBufferSaved(false), 1200);
  };

  const applyRoundups = async () => {
    if (!hasSecureSessionAccess() || roundupsApplied) return;
    const nextBalance = Number((balance + roundupsTotal).toFixed(2));
    const nextTransaction: ExitFundTransaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      amount: roundupsTotal,
      createdAt: new Date().toISOString(),
      note: 'Daily purchase round-ups',
    };
    const nextTransactions = [nextTransaction, ...transactions].slice(0, 8);
    setBalance(nextBalance);
    setTransactions(nextTransactions);
    setRoundupsApplied(true);
    await setExitFundData({
      exitFundBalance: nextBalance,
      mainAccountBalance,
      userDefinedLimit: targetLimit,
      transactions: nextTransactions,
    });
  };

  const handleSafeNow = async () => {
    await stopEmergencyMode();
    setIsEmergencyActive(false);
  };

  const applyCustomTransaction = async () => {
    if (!hasSecureSessionAccess()) return;
    const parsed = Number(transactionInput);
    if (!Number.isFinite(parsed) || parsed === 0) return;
    const normalized = Number(parsed.toFixed(2));
    const note = normalized > 0 ? 'Manual deposit' : 'Manual expense';
    await addSimulatedTransaction(normalized, note);
    setTransactionInput('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Exit Fund</Text>
          <TouchableOpacity style={styles.quickExitButton} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.quickExitEmoji}>🧮</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.balanceLabel}>Financial Oxygen</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{balanceLabel}</Text>
            {isEmergencyActive ? (
              <View style={styles.processingWrap}>
                <ActivityIndicator size="small" color="#b45309" />
                <Text style={styles.processingText}>Processing...</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.note}>Estimated Independence Fund</Text>
          <Text style={styles.mainAccountText}>Simulated Main Account: {mainBalanceLabel}</Text>
        </View>

        {isEmergencyActive ? (
          <View style={styles.emergencyBanner}>
            <Text style={styles.emergencyBannerText}>
              Emergency Protocol Active: Automated Withdrawal Simulation Started
            </Text>
            <TouchableOpacity style={styles.safeNowButton} onPress={() => void handleSafeNow()}>
              <Text style={styles.safeNowButtonText}>Safe Now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Target Security Buffer</Text>
          <Text style={styles.helperText}>Set a private goal between 500 and 5,000 ILS.</Text>
          <View style={styles.limitRow}>
            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              style={styles.limitInput}
              placeholder="Enter target limit"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity style={styles.limitSaveButton} onPress={() => void saveTargetLimit(targetInput)}>
              <Text style={styles.limitSaveButtonText}>Save</Text>
            </TouchableOpacity>
          </View>
          {bufferSaved ? <Text style={styles.savedText}>Saved!</Text> : null}
          <View style={styles.presetRow}>
            {LIMIT_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset}
                style={[styles.presetButton, targetLimit === preset ? styles.presetButtonActive : null]}
                onPress={() => void saveTargetLimit(String(preset))}>
                <Text style={[styles.presetText, targetLimit === preset ? styles.presetTextActive : null]}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.progressText}>
            Goal: {limitLabel} ({progressPercent}% funded)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Round-up Transaction History</Text>
          {MOCK_PURCHASES.map((purchase) => {
            const roundup = Number((Math.ceil(purchase.amount) - purchase.amount).toFixed(2));
            return (
              <View key={purchase.id} style={styles.txRow}>
                <Text style={styles.txNote}>
                  {purchase.label} - {purchase.amount.toFixed(2)} ILS
                </Text>
                <Text style={styles.txInflow}>+{roundup.toFixed(2)} ILS</Text>
              </View>
            );
          })}
          <TouchableOpacity style={styles.actionButton} onPress={() => void applyRoundups()}>
            <Text style={styles.actionButtonText}>
              {roundupsApplied ? 'Round-ups Applied' : `Apply Round-ups (+${roundupsTotal.toFixed(2)} ILS)`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Simulated Transactions</Text>
          <View style={styles.customTransactionRow}>
            <TextInput
              value={transactionInput}
              onChangeText={setTransactionInput}
              keyboardType="numeric"
              style={styles.transactionInput}
              placeholder="Enter custom amount"
              placeholderTextColor="#888888"
            />
            <TouchableOpacity style={styles.actionButton} onPress={() => void applyCustomTransaction()}>
              <Text style={styles.actionButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
          {transactions.length === 0 ? (
            <Text style={styles.emptyLabel}>No simulated transactions yet.</Text>
          ) : (
            transactions.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <Text style={styles.txNote}>{tx.note}</Text>
                <Text style={[styles.txAmount, tx.amount < 0 ? styles.txOutflow : styles.txInflow]}>
                  {tx.amount < 0 ? '' : '+'}
                  {tx.amount.toFixed(2)} ILS
                </Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back to Safe Zone</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  card: {
    backgroundColor: '#0e0e0e',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888888',
  },
  balance: {
    marginTop: 6,
    fontSize: 38,
    fontWeight: '700',
    color: '#f5f5f5',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  processingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    marginTop: 4,
    color: '#d4d4d4',
    fontSize: 11,
    fontWeight: '600',
  },
  note: {
    marginTop: 10,
    fontSize: 15,
    color: '#f5f5f5',
  },
  mainAccountText: {
    marginTop: 8,
    fontSize: 13,
    color: '#888888',
    fontWeight: '600',
  },
  emergencyBanner: {
    backgroundColor: '#2b0f12',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  emergencyBannerText: {
    color: '#f5f5f5',
    fontSize: 13,
    fontWeight: '700',
  },
  safeNowButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  safeNowButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f5f5f5',
    marginBottom: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  customTransactionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  helperText: {
    color: '#888888',
    marginBottom: 8,
    fontSize: 13,
  },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#f5f5f5',
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  limitSaveButton: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  limitSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  savedText: {
    color: '#34d399',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 8,
    paddingVertical: 7,
    backgroundColor: '#111111',
  },
  presetButtonActive: {
    backgroundColor: '#1f2937',
    borderColor: '#34d399',
  },
  presetText: {
    color: '#bdbdbd',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#fff',
  },
  progressText: {
    color: '#d4d4d4',
    fontSize: 13,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 10,
    paddingVertical: 10,
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
  },
  transactionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f5f5f5',
    fontSize: 15,
  },
  emptyLabel: {
    color: '#888888',
    fontSize: 14,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  txNote: {
    color: '#f5f5f5',
    fontSize: 14,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txInflow: {
    color: '#34d399',
  },
  txOutflow: {
    color: '#f87171',
  },
  button: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2f2f2f',
    borderRadius: 12,
    paddingVertical: 14,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
