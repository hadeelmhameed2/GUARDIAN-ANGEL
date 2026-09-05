import { useRouter } from 'expo-router';
import { useFocusEffect } from "expo-router/react-navigation";
import React, { useCallback, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { HouseHeart, PiggyBank, Receipt, RefreshCw, ShieldAlert, Target, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
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
  awaitSessionReady,
  getExitFundData,
  getCurrentStatus,
  getIsEmergencyActive,
  hasSecureSessionAccess,
  setExitFundData,
  setUserDefinedLimit,
  stopEmergencyMode,
  type ExitFundTransaction,
} from './risk-status';
import { useShakeHide } from '../hooks/use-shake-hide';
import { Fonts, PageGradient, Palette, Shadow } from '@/constants/theme';

const EMERGENCY_TRANSFER_AMOUNT = 10;
const EMERGENCY_TRANSFER_INTERVAL_MS = 4000;
const LIMIT_PRESETS = [1000, 5000, 10000, 50000];
const MOCK_PURCHASES = [
  { id: 'p1', labelKey: 'exitFund.mockPurchases.busTicket', amount: 18.2 },
  { id: 'p2', labelKey: 'exitFund.mockPurchases.groceries', amount: 74.35 },
  { id: 'p3', labelKey: 'exitFund.mockPurchases.pharmacy', amount: 53.6 },
  { id: 'p4', labelKey: 'exitFund.mockPurchases.coffee', amount: 14.9 },
];

const PAGE_GRADIENTS = PageGradient;

export default function ExitFundScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const direction = typeof i18n.dir === 'function' ? i18n.dir() : 'ltr';
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
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  };

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await awaitSessionReady();
        if (!hasSecureSessionAccess()) return;
        const saved = getExitFundData();
        setIsEmergencyActive(getIsEmergencyActive());
        setBalance(saved.exitFundBalance);
        setMainAccountBalance(saved.mainAccountBalance);
        setTargetLimit(saved.userDefinedLimit);
        setTargetInput(String(saved.userDefinedLimit));
        setTransactions(saved.transactions);
      })();
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
            note: t('exitFund.notes.emergencyTransfer'),
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
    }, [isEmergencyActive, t]),
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
    await awaitSessionReady();
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
    await awaitSessionReady();
    if (!hasSecureSessionAccess()) return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setTargetInput(String(targetLimit));
      return;
    }
    const sanitized = Math.max(0, Math.round(parsed));
    setTargetLimit(sanitized);
    setTargetInput(String(sanitized));
    await setUserDefinedLimit(sanitized);
    await setExitFundData({
      exitFundBalance: balance,
      mainAccountBalance,
      userDefinedLimit: sanitized,
      transactions,
    });
    Keyboard.dismiss();
    setBufferSaved(true);
    setTimeout(() => setBufferSaved(false), 1200);
  };

  const applyRoundups = async () => {
    await awaitSessionReady();
    if (!hasSecureSessionAccess() || roundupsApplied) return;
    const nextBalance = Number((balance + roundupsTotal).toFixed(2));
    const nextTransaction: ExitFundTransaction = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      amount: roundupsTotal,
      createdAt: new Date().toISOString(),
      note: t('exitFund.notes.dailyRoundups'),
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
    await awaitSessionReady();
    if (!hasSecureSessionAccess()) return;
    const parsed = Number(transactionInput);
    if (!Number.isFinite(parsed) || parsed === 0) return;
    const normalized = Number(parsed.toFixed(2));
    const note = normalized > 0 ? t('exitFund.notes.manualDeposit') : t('exitFund.notes.manualExpense');
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
    <SafeAreaView style={[styles.container, { direction }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerIconButton} onPress={handleBack} accessibilityLabel="Back">
            <Text style={{ fontSize: 22, color: Palette.inkSoft, lineHeight: 22 }}>◀</Text>
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>Vault</Text>
            <Text style={styles.title}>{t('exitFund.title')}</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => router.replace('/(tabs)')}
            accessibilityLabel="Exit">
            <X size={17} color={Palette.inkSoft} strokeWidth={2.25} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceCardHeader}>
            <PiggyBank size={20} color={Palette.primaryDeep} strokeWidth={2} />
            <Text style={styles.balanceLabel}>{t('exitFund.financialOxygen')}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balance}>{balanceLabel}</Text>
            {isEmergencyActive ? (
              <View style={styles.processingWrap}>
                <ActivityIndicator size="small" color={Palette.gold} />
                <Text style={styles.processingText}>{t('common.processing')}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.note}>{t('exitFund.independenceFund')}</Text>
          <View style={styles.progressBarWrap}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <Text style={styles.progressPercent}>{t('exitFund.goalProgress', { value: progressPercent })}</Text>
          <Text style={styles.mainAccountText}>{t('exitFund.mainAccount', { value: mainBalanceLabel })}</Text>
        </View>

        {isEmergencyActive ? (
          <View style={styles.emergencyBanner}>
            <View style={styles.emergencyBannerRow}>
              <ShieldAlert size={19} color={Palette.statusRedInk} strokeWidth={2.25} />
              <Text style={styles.emergencyBannerText}>
                {t('exitFund.emergencyActive')}
              </Text>
            </View>
            <TouchableOpacity style={styles.safeNowButton} onPress={() => void handleSafeNow()}>
              <Text style={styles.safeNowButtonText}>{t('exitFund.safeNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Target size={17} color={Palette.primaryDeep} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('exitFund.targetBuffer')}</Text>
          </View>
          <Text style={styles.helperText}>{t('exitFund.targetHint')}</Text>
          <View style={styles.limitRow}>
            <TextInput
              value={targetInput}
              onChangeText={setTargetInput}
              keyboardType="number-pad"
              style={styles.limitInput}
              placeholder={t('exitFund.targetPlaceholder')}
              placeholderTextColor={Palette.inkFaint}
            />
            <TouchableOpacity style={styles.limitSaveButton} onPress={() => void saveTargetLimit(targetInput)}>
              <Text style={styles.limitSaveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
          {bufferSaved ? <Text style={styles.savedText}>✓ {t('exitFund.saved')}</Text> : null}
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
            {t('exitFund.goalLine', { limit: limitLabel, percent: progressPercent })}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <RefreshCw size={16} color={Palette.primaryDeep} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('exitFund.roundupHistory')}</Text>
          </View>
          {MOCK_PURCHASES.map((purchase) => {
            const roundup = Number((Math.ceil(purchase.amount) - purchase.amount).toFixed(2));
            return (
              <View key={purchase.id} style={styles.txRow}>
                <Text style={styles.txNote}>
                  {t(purchase.labelKey)} - {purchase.amount.toFixed(2)} ILS
                </Text>
                <Text style={styles.txInflow}>+{roundup.toFixed(2)} ILS</Text>
              </View>
            );
          })}
          <TouchableOpacity
            style={[styles.actionButton, roundupsApplied ? styles.actionButtonDisabled : null]}
            onPress={() => void applyRoundups()}>
            <Text style={styles.actionButtonText}>
              {roundupsApplied
                ? `✓ ${t('exitFund.roundupsApplied')}`
                : t('exitFund.applyRoundups', { amount: roundupsTotal.toFixed(2) })}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Receipt size={16} color={Palette.primaryDeep} strokeWidth={2} />
            <Text style={styles.sectionTitle}>{t('exitFund.simulatedTransactions')}</Text>
          </View>
          <View style={styles.customTransactionRow}>
            <TextInput
              value={transactionInput}
              onChangeText={setTransactionInput}
              keyboardType="numeric"
              style={styles.transactionInput}
              placeholder={t('exitFund.customAmountPlaceholder')}
              placeholderTextColor={Palette.inkFaint}
            />
            <TouchableOpacity style={styles.actionButton} onPress={() => void applyCustomTransaction()}>
              <Text style={styles.actionButtonText}>{t('common.apply')}</Text>
            </TouchableOpacity>
          </View>
          {transactions.length === 0 ? (
            <Text style={styles.emptyLabel}>{t('exitFund.noTransactions')}</Text>
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

        <TouchableOpacity style={styles.backToZoneButton} onPress={handleBack}>
          <HouseHeart size={18} color="#FFFFFF" strokeWidth={2} />
          <Text style={styles.backToZoneText}>{t('exitFund.backSafeZone')}</Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  eyebrow: {
    color: Palette.inkMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    color: Palette.ink,
    textAlign: 'center',
    letterSpacing: -0.2,
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
  balanceCard: {
    backgroundColor: '#FFFCF9',
    borderRadius: 32,
    padding: 26,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.lift,
  },
  balanceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  balanceLabel: {
    fontSize: 11,
    color: Palette.inkMuted,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  balance: {
    marginTop: 6,
    fontSize: 38,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    color: Palette.ink,
    letterSpacing: -0.5,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  processingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
  },
  processingText: {
    marginTop: 4,
    color: Palette.statusYellowInk,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    color: Palette.inkMuted,
    fontWeight: '500',
  },
  progressBarWrap: {
    marginTop: 16,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1E4DA',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Palette.primary,
  },
  progressPercent: {
    marginTop: 8,
    fontSize: 12,
    color: Palette.primaryDeep,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  mainAccountText: {
    marginTop: 10,
    fontSize: 12,
    color: Palette.inkMuted,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  emergencyBanner: {
    backgroundColor: Palette.statusRedBg,
    borderWidth: 1,
    borderColor: Palette.primarySoft,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 22,
  },
  emergencyBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emergencyBannerText: {
    flex: 1,
    color: Palette.emergencyDeep,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  safeNowButton: {
    marginTop: 14,
    alignSelf: 'flex-end',
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  safeNowButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFCF9',
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Palette.border,
    ...Shadow.soft,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.serif,
    color: Palette.ink,
    textAlign: 'left',
    writingDirection: 'ltr',
    flex: 1,
  },
  helperText: {
    color: Palette.inkMuted,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  limitInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 14,
    backgroundColor: '#FDF8F2',
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    color: Palette.ink,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  limitSaveButton: {
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  limitSaveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  savedText: {
    color: Palette.primaryDeep,
    fontWeight: '700',
    marginBottom: 10,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  presetButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 999,
    paddingVertical: 10,
    backgroundColor: '#FDF8F2',
  },
  presetButtonActive: {
    backgroundColor: Palette.primarySoft,
    borderColor: Palette.primary,
  },
  presetText: {
    color: Palette.inkMuted,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
  },
  presetTextActive: {
    color: Palette.primaryDeep,
  },
  progressText: {
    color: Palette.inkMuted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  actionButton: {
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  actionButtonDisabled: {
    backgroundColor: Palette.inkFaint,
  },
  actionButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    borderColor: Palette.border,
    borderRadius: 14,
    backgroundColor: '#FDF8F2',
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: Palette.ink,
    fontSize: 15,
  },
  emptyLabel: {
    color: Palette.inkMuted,
    fontSize: 14,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Palette.divider,
  },
  txNote: {
    color: Palette.ink,
    fontSize: 14,
    flex: 1,
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  txInflow: {
    color: Palette.primaryDeep,
  },
  txOutflow: {
    color: Palette.statusRedInk,
  },
  backToZoneButton: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingVertical: 16,
    ...Shadow.lift,
  },
  backToZoneText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
