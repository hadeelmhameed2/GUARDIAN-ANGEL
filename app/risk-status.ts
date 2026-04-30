import * as SecureStore from 'expo-secure-store';
export type RiskState = 'green' | 'yellow' | 'red';

export type ExitFundTransaction = {
  id: string;
  amount: number;
  createdAt: string;
  note: string;
};

export type TrustedContact = {
  name: string;
  phone: string;
};

type ExitFundSnapshot = {
  exitFundBalance: number;
  mainAccountBalance: number;
  userDefinedLimit: number;
  transactions: ExitFundTransaction[];
};

const RISK_STATUS_KEY_SAFE = 'user_risk_status';
const EXIT_FUND_BALANCE_KEY = 'exit_fund_balance';
const MAIN_ACCOUNT_BALANCE_KEY = 'main_account_balance';
const USER_DEFINED_LIMIT_KEY = 'user_defined_limit';
const EXIT_FUND_TRANSACTIONS_KEY = 'exit_fund_transactions';
const EMERGENCY_ACTIVE_KEY = 'is_emergency_active';
const TRUSTED_CONTACTS_KEY = 'trusted_contacts';

let currentStatus: RiskState = 'yellow';
let isSecureSessionUnlocked = false;
let exitFundBalance = 1240.8;
let mainAccountBalance = 12500;
let userDefinedLimit = 3000;
let exitFundTransactions: ExitFundTransaction[] = [];
let isEmergencyActive = false;
let trustedContacts: TrustedContact[] = [];

function isRiskState(value: string): value is RiskState {
  return value === 'green' || value === 'yellow' || value === 'red';
}

async function persistRiskStatus(status: RiskState) {
  await safeSetItem(RISK_STATUS_KEY_SAFE, status);
}

async function persistEmergencyState() {
  await safeSetItem(EMERGENCY_ACTIVE_KEY, isEmergencyActive ? '1' : '0');
}

async function persistExitFundData() {
  await safeSetItem(EXIT_FUND_BALANCE_KEY, String(exitFundBalance));
  await safeSetItem(MAIN_ACCOUNT_BALANCE_KEY, String(mainAccountBalance));
  await safeSetItem(USER_DEFINED_LIMIT_KEY, String(userDefinedLimit));
  await safeSetItem(EXIT_FUND_TRANSACTIONS_KEY, JSON.stringify(exitFundTransactions));
}

async function persistTrustedContacts() {
  await safeSetItem(TRUSTED_CONTACTS_KEY, JSON.stringify(trustedContacts));
}

function isValidStorageKey(key: string | null | undefined): key is string {
  if (!key || typeof key !== 'string') return false;
  return /^[A-Za-z0-9_]+$/.test(key);
}

async function safeGetItem(key: string | null | undefined) {
  if (!isValidStorageKey(key)) return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string | null | undefined, value: string) {
  if (!isValidStorageKey(key)) return;
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Storage failures should never crash the app.
  }
}

export function getCurrentStatus(): RiskState {
  return currentStatus;
}

export async function setCurrentStatus(next: RiskState) {
  currentStatus = next;
  isEmergencyActive = next === 'red';
  if (isSecureSessionUnlocked) {
    await Promise.all([persistRiskStatus(next), persistEmergencyState()]);
  }
}

export function statusFromScore(score: number): RiskState {
  if (score <= 7) return 'green';
  if (score <= 22) return 'yellow';
  return 'red';
}

export function hasSecureSessionAccess() {
  return isSecureSessionUnlocked;
}

export function getIsEmergencyActive() {
  return isEmergencyActive;
}

export function getExitFundData(): ExitFundSnapshot {
  return {
    exitFundBalance,
    mainAccountBalance,
    userDefinedLimit,
    transactions: [...exitFundTransactions],
  };
}

export function getTrustedContacts(): TrustedContact[] {
  return trustedContacts.map((contact) => ({ ...contact }));
}

export async function addTrustedContact(next: TrustedContact) {
  const sanitized: TrustedContact = {
    name: next.name.trim().slice(0, 80),
    phone: next.phone.replace(/[^\d+]/g, '').slice(0, 20),
  };
  if (!sanitized.phone) return;
  trustedContacts = [...trustedContacts, sanitized].slice(0, 2);
  if (isSecureSessionUnlocked) {
    await persistTrustedContacts();
  }
}

export async function setTrustedContacts(next: TrustedContact[]) {
  trustedContacts = next
    .map((contact) => ({
      name: contact.name.trim().slice(0, 80),
      phone: contact.phone.replace(/[^\d+]/g, '').slice(0, 20),
    }))
    .filter((contact) => Boolean(contact.phone))
    .slice(0, 2);
  if (isSecureSessionUnlocked) {
    await persistTrustedContacts();
  }
}

export async function setExitFundData(next: ExitFundSnapshot) {
  exitFundBalance = next.exitFundBalance;
  mainAccountBalance = next.mainAccountBalance;
  userDefinedLimit = next.userDefinedLimit;
  exitFundTransactions = next.transactions;
  if (isSecureSessionUnlocked) {
    await persistExitFundData();
  }
}

export async function setUserDefinedLimit(nextLimit: number) {
  const clamped = Math.min(5000, Math.max(500, Math.round(nextLimit)));
  userDefinedLimit = clamped;
  if (isSecureSessionUnlocked) {
    await safeSetItem(USER_DEFINED_LIMIT_KEY, String(clamped));
  }
}

export async function stopEmergencyMode() {
  isEmergencyActive = false;
  if (currentStatus === 'red') {
    currentStatus = 'yellow';
  }
  if (isSecureSessionUnlocked) {
    await Promise.all([persistRiskStatus(currentStatus), persistEmergencyState()]);
  }
}

export async function hydrateSecureData() {
  if (!isSecureSessionUnlocked) return;

  const [
    statusStored,
    balanceStored,
    mainBalanceStored,
    limitStored,
    transactionsStored,
    emergencyStored,
    trustedContactsStored,
  ] =
    await Promise.all([
    safeGetItem(RISK_STATUS_KEY_SAFE),
    safeGetItem(EXIT_FUND_BALANCE_KEY),
    safeGetItem(MAIN_ACCOUNT_BALANCE_KEY),
    safeGetItem(USER_DEFINED_LIMIT_KEY),
    safeGetItem(EXIT_FUND_TRANSACTIONS_KEY),
    safeGetItem(EMERGENCY_ACTIVE_KEY),
    safeGetItem(TRUSTED_CONTACTS_KEY),
    ]);

  if (statusStored && isRiskState(statusStored)) {
    currentStatus = statusStored;
  }
  isEmergencyActive = emergencyStored === '1';

  if (balanceStored) {
    const parsedBalance = Number(balanceStored);
    if (Number.isFinite(parsedBalance)) {
      exitFundBalance = parsedBalance;
    }
  }
  if (mainBalanceStored) {
    const parsedMainBalance = Number(mainBalanceStored);
    if (Number.isFinite(parsedMainBalance)) {
      mainAccountBalance = parsedMainBalance;
    }
  }
  if (limitStored) {
    const parsedLimit = Number(limitStored);
    if (Number.isFinite(parsedLimit)) {
      userDefinedLimit = Math.min(5000, Math.max(500, Math.round(parsedLimit)));
    }
  }

  if (transactionsStored) {
    try {
      const parsed = JSON.parse(transactionsStored) as ExitFundSnapshot['transactions'];
      if (Array.isArray(parsed)) {
        exitFundTransactions = parsed.filter(
          (tx) =>
            typeof tx?.id === 'string' &&
            typeof tx?.amount === 'number' &&
            Number.isFinite(tx.amount) &&
            typeof tx?.createdAt === 'string' &&
            typeof tx?.note === 'string',
        );
      }
    } catch {
      // Ignore malformed storage payloads and keep in-memory defaults.
    }
  }

  if (trustedContactsStored) {
    try {
      const parsed = JSON.parse(trustedContactsStored) as TrustedContact[];
      if (Array.isArray(parsed)) {
        trustedContacts = parsed
          .map((contact) => ({
            name: String(contact?.name ?? '').trim().slice(0, 80),
            phone: String(contact?.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20),
          }))
          .filter((contact) => Boolean(contact.phone))
          .slice(0, 2);
      }
    } catch {
      trustedContacts = [];
    }
  } else {
    trustedContacts = [];
  }
}

export async function unlockSecureDataWithPin(pin: string) {
  let expectedPin = '1234';
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('ga_calculator_code');
    if (stored) {
      expectedPin = stored;
    }
  }
  if (pin !== expectedPin) return false;
  isSecureSessionUnlocked = true;
  await hydrateSecureData();
  return true;
}
