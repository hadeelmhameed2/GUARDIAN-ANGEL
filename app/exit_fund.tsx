import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Image,
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
  getCurrentStatus,
  getIsEmergencyActive,
  hasSecureSessionAccess,
  setExitFundData,
  setUserDefinedLimit,
  stopEmergencyMode,
  type RiskState,
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

const PAGE_GRADIENTS: Record<RiskState, [string, string, string]> = {
  red: ['#FFD6D6', '#FAF3E0', '#FAF3E0'],
  yellow: ['#FFE8D1', '#FAF3E0', '#FAF3E0'],
  green: ['#E8F5E9', '#FAF3E0', '#FAF3E0'],
};
const BRANCH_TINT: Record<RiskState, string> = {
  red: '#9f4b4b',
  yellow: '#a8692e',
  green: '#4d6d52',
};

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
  const currentStatus = getCurrentStatus();

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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
            <Image source={require('../assets/images/turn-back.png')} style={styles.backArrowImage} />
          </TouchableOpacity>
          <Text style={styles.title}>Exit Fund</Text>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.replace('/(tabs)')}>
            <Image source={require('../assets/images/image_10.png')} style={styles.stealthExitImage} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceCardHeader}>
            <Text style={styles.balanceEmoji}>💰</Text>
            <Text style={styles.balanceLabel}>Financial Oxygen</Text>
          </View>
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
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{progressPercent}% of goal</Text>
          <Text style={styles.mainAccountText}>Simulated Main Account: {mainBalanceLabel}</Text>
        </View>

        {isEmergencyActive ? (
          <View style={styles.emergencyBanner}>
            <View style={styles.emergencyBannerRow}>
              <Text style={styles.emergencyBannerEmoji}>🚨</Text>
              <Text style={styles.emergencyBannerText}>
                Emergency Protocol Active: Automated Withdrawal Simulation Started
              </Text>
            </View>
            <TouchableOpacity style={styles.safeNowButton} onPress={() => void handleSafeNow()}>
              <Text style={styles.safeNowButtonText}>Safe Now</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🎯</Text>
            <Text style={styles.sectionTitle}>Target Security Buffer</Text>
          </View>
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
          {bufferSaved ? <Text style={styles.savedText}>✓ Saved!</Text> : null}
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>🔄</Text>
            <Text style={styles.sectionTitle}>Round-up Transaction History</Text>
          </View>
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
          <TouchableOpacity
            style={[styles.actionButton, roundupsApplied ? styles.actionButtonDisabled : null]}
            onPress={() => void applyRoundups()}>
            <Text style={styles.actionButtonText}>
              {roundupsApplied ? '✓ Round-ups Applied' : `Apply Round-ups (+${roundupsTotal.toFixed(2)} ILS)`}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionEmoji}>📊</Text>
            <Text style={styles.sectionTitle}>Simulated Transactions</Text>
          </View>
          <View style={styles.customTransactionRow}>
            <TextInput
              value={transactionInput}
              onChangeText={setTransactionInput}
              keyboardType="numeric"
              style={styles.transactionInput}
              placeholder="Enter custom amount"
              placeholderTextColor="#9CA3AF"
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

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <View style={styles.backButtonContent}>
            <Text style={styles.backButtonText}>Back to Safe Zone</Text>
            <Text style={styles.backButtonEmoji}>🏠</Text>
          </View>
        </TouchableOpacity>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
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
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  balanceEmoji: {
    fontSize: 18,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  balance: {
    marginTop: 4,
    fontSize: 36,
    fontWeight: '700',
    color: '#2D3436',
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
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600',
  },
  note: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBarWrap: {
    marginTop: 14,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#5F7A61',
  },
  progressPercent: {
    marginTop: 6,
    fontSize: 12,
    color: '#5F7A61',
    fontWeight: '600',
  },
  mainAccountText: {
    marginTop: 8,
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  emergencyBanner: {
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  emergencyBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emergencyBannerEmoji: {
    fontSize: 18,
  },
  emergencyBannerText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  safeNowButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    backgroundColor: '#5F7A61',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  safeNowButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionEmoji: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2D3436',
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  helperText: {
    color: '#9CA3AF',
    marginBottom: 12,
    fontSize: 13,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3436',
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  limitSaveButton: {
    backgroundColor: '#5F7A61',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  limitSaveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  savedText: {
    color: '#5F7A61',
    fontWeight: '700',
    marginBottom: 8,
    fontSize: 13,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  presetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 9,
    backgroundColor: '#FAFAFA',
  },
  presetButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#5F7A61',
  },
  presetText: {
    color: '#6B7280',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  presetTextActive: {
    color: '#2D3436',
  },
  progressText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  actionButton: {
    backgroundColor: '#5F7A61',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  actionButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  actionButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 14,
  },
  customTransactionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  transactionInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#2D3436',
    fontSize: 15,
  },
  emptyLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  txNote: {
    color: '#2D3436',
    fontSize: 14,
    flex: 1,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txInflow: {
    color: '#5F7A61',
  },
  txOutflow: {
    color: '#DC2626',
  },
  backButton: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    height: 60,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  backButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  backButtonText: {
    color: '#2D3436',
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '500',
    writingDirection: 'ltr',
    flex: 1,
  },
  backButtonEmoji: {
    fontSize: 18,
  },
});
