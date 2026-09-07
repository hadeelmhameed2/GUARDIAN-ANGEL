import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  I18nManager,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff, Heart, Lock, User, X } from 'lucide-react-native';
import { unlockSecureDataWithPin } from '@/src/risk-status';
import { Fonts, Palette, Shadow } from '@/constants/theme';
import { apiFetch, isApiConfigured } from '@/src/api';
import { refreshAuthSession } from '@/src/auth-session';
import {
  AUTH_TOKEN_KEY,
  AUTH_CALCULATOR_CODE_KEY,
  AUTH_USERNAME_KEY,
  hasAuthToken,
  loadAuthCredentials,
  type AuthCredentials,
  writeSecureItem,
} from '@/src/secure-storage';
import { useVoiceDrafts } from '@/src/voice-draft-context';
import { useVoiceEmergencyTrigger } from '@/src/voice-trigger';

/** Production: real Cloudflare `/api/auth` login & registration. Set `true` only for offline dev. */
const BYPASS_SERVER_AUTH = false;

const FOUR_DIGIT_PIN = /^\d{4}$/;

// I18nManager remaps `row` → `row-reverse` when the app is RTL. Write the
// opposite so the keypad stays a standard LTR calculator on native.
const LTR_ROW = I18nManager.isRTL ? 'row-reverse' : 'row';
const webLtrDir = Platform.OS === 'web' ? ({ dir: 'ltr' } as const) : null;

// Hidden setup/login trigger: a rapid triple-tap on the display, rather than
// a long-press. `onLongPress` is unreliable with mouse input on
// react-native-web; a plain `onPress` tap counter fires identically on
// touch, mouse click, and Android/iOS taps.
const HIDDEN_TRIGGER_TAP_COUNT = 3;
const HIDDEN_TRIGGER_WINDOW_MS = 600;

function isFourDigitPin(value: string): boolean {
  return FOUR_DIGIT_PIN.test(value);
}

function getPinValidationError(pin: string): string | null {
  if (!pin) return 'Please enter your 4-digit PIN.';
  if (!/^\d+$/.test(pin)) return 'Please enter a valid 4-digit number.';
  if (pin.length < 4) return 'PIN must be exactly 4 digits.';
  if (pin.length > 4) return 'PIN must be exactly 4 digits.';
  return null;
}

const BUTTONS: Array<Array<string>> = [
  ['AC', '+/-', '%', '/'],
  ['7', '8', '9', '*'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

function isOperator(char: string) {
  return ['+', '-', '*', '/'].includes(char);
}

function evaluateExpression(expr: string): number {
  const trimmed = expr.replace(/\s+/g, '');
  if (!trimmed) return 0;
  if (!/^[0-9+\-*/.]+$/.test(trimmed)) throw new Error('Invalid expression');

  const tokens: string[] = [];
  let current = '';
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    const prev = trimmed[i - 1];
    const unaryMinus = ch === '-' && (i === 0 || isOperator(prev));
    if (isOperator(ch) && !unaryMinus) {
      if (!current) throw new Error('Malformed');
      tokens.push(current, ch);
      current = '';
    } else {
      current += ch;
    }
  }
  if (!current) throw new Error('Malformed');
  tokens.push(current);

  const pass1: string[] = [];
  let idx = 0;
  while (idx < tokens.length) {
    const tk = tokens[idx];
    if ((tk === '*' || tk === '/') && pass1.length > 0) {
      const left = Number(pass1.pop());
      const right = Number(tokens[idx + 1]);
      if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error('Number');
      if (tk === '/' && right === 0) throw new Error('Division');
      pass1.push(String(tk === '*' ? left * right : left / right));
      idx += 2;
    } else {
      pass1.push(tk);
      idx += 1;
    }
  }

  let result = Number(pass1[0]);
  for (let i = 1; i < pass1.length; i += 2) {
    const op = pass1[i];
    const next = Number(pass1[i + 1]);
    if (op === '+') result += next;
    else if (op === '-') result -= next;
  }
  return result;
}

export default function CalculatorMaskScreen() {
  const router = useRouter();
  const [expression, setExpression] = useState('');
  const [display, setDisplay] = useState('0');
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Stealth voice trigger: silently arms in the background if the user
  // enabled it from the Drafts screen. No UI here — anything visible would
  // blow the calculator disguise. See src/voice-trigger.ts.
  const { addDraft } = useVoiceDrafts();
  useVoiceEmergencyTrigger(addDraft);

  const authHeaderTitle = authMode === 'register' ? 'Welcome to Guardian Angel' : 'Welcome Back';
  const authHeaderSubtitle =
    authMode === 'register'
      ? 'Choose a 4-digit numeric code as your secret PIN.'
      : 'Sign in with your username and 4-digit PIN.';

  const handleUsernameChange = (text: string) => {
    setErrorMessage('');
    setUsername(text);
  };

  const handlePasswordChange = (text: string) => {
    setErrorMessage('');
    setPassword(text.replace(/\D/g, '').slice(0, 4));
  };

  const closeAuthPanel = () => {
    setErrorMessage('');
    setShowAuthPanel(false);
  };

  const toggleAuthMode = () => {
    setErrorMessage('');
    setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'));
  };

  const refreshAuthFromStorage = useCallback(async (): Promise<AuthCredentials> => {
    return loadAuthCredentials();
  }, []);

  useEffect(() => {
    void refreshAuthFromStorage();
  }, [refreshAuthFromStorage]);

  useFocusEffect(
    useCallback(() => {
      void refreshAuthFromStorage();
    }, [refreshAuthFromStorage]),
  );

  const saveSession = async (token: string, calculatorCode: string) => {
    await Promise.all([
      writeSecureItem(AUTH_TOKEN_KEY, token),
      writeSecureItem(AUTH_CALCULATOR_CODE_KEY, calculatorCode),
    ]);
  };

  const submitAuth = async (mode: 'login' | 'register') => {
    const nextUsername = username.trim();
    const nextPassword = password.trim();

    if (!nextUsername || !nextPassword) {
      setErrorMessage('Please enter both username and PIN.');
      return;
    }

    const pinError = getPinValidationError(nextPassword);
    if (pinError) {
      setErrorMessage(pinError);
      return;
    }

    if (mode === 'register' && nextUsername.length < 3) {
      setErrorMessage('Username must be at least 3 characters.');
      return;
    }

    if (!isApiConfigured()) {
      setErrorMessage('Server URL is not configured. Set EXPO_PUBLIC_API_BASE_URL and restart the app.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      if (BYPASS_SERVER_AUTH) {
        const localToken = `local-dev-${Date.now()}`;
        await saveSession(localToken, nextPassword);
        await writeSecureItem(AUTH_USERNAME_KEY, nextUsername);
        const unlocked = await unlockSecureDataWithPin(nextPassword);
        if (unlocked) {
          setShowAuthPanel(false);
          router.replace('/home');
        } else {
          setErrorMessage('Something went wrong. Please try again.');
        }
        return;
      }

      const response = await apiFetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: nextUsername, password: nextPassword }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setErrorMessage(
          String(payload?.error ?? (mode === 'register' ? 'Registration failed.' : 'Login failed.')),
        );
        return;
      }

      const token = String(payload?.token ?? '');
      if (!token) {
        setErrorMessage('Something went wrong. Please try again.');
        return;
      }

      await saveSession(token, nextPassword);
      await writeSecureItem(AUTH_USERNAME_KEY, nextUsername);
      const unlocked = await unlockSecureDataWithPin(nextPassword);
      if (unlocked) {
        setShowAuthPanel(false);
        router.replace('/home');
      } else {
        setErrorMessage('Something went wrong. Please try again.');
      }
    } catch {
      setErrorMessage('Could not connect. Check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEqualsPress = async (currentExpression: string) => {
    if (!currentExpression) return;

    const { token, calculatorCode } = await refreshAuthFromStorage();
    const hasToken = hasAuthToken(token);
    const personalCode = calculatorCode;

    if (!hasToken && currentExpression === '1234') {
      setShowAuthPanel(true);
      setExpression('');
      setDisplay('0');
      return;
    }

    if (hasToken && personalCode && isFourDigitPin(currentExpression)) {
      if (currentExpression === personalCode) {
        // Unlock and navigate on the local PIN match first — this must never
        // be blocked (or undone) by the network. The server token refresh
        // runs afterward, in the background, purely to keep API calls
        // authenticated; its failure must not affect local access.
        const unlocked = await unlockSecureDataWithPin(currentExpression);
        if (unlocked) {
          setExpression('');
          setDisplay('0');
          router.replace('/home');
          if (isApiConfigured() && !BYPASS_SERVER_AUTH) {
            void refreshAuthSession();
          }
        }
        return;
      }
      setExpression('');
      setDisplay('0');
      return;
    }

    try {
      const result = evaluateExpression(currentExpression);
      const resultText = Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
      setExpression(resultText);
      setDisplay(resultText.slice(0, 12));
    } catch {
      setExpression('');
      setDisplay('0');
    }
  };

  /**
   * Setup/login is reached by a deliberate rapid triple-tap on the display,
   * not a typeable digit sequence — "1234=" is the single most likely thing
   * anyone would try on a calculator, so it must behave like plain math
   * (see handleEqualsPress) instead of revealing the app.
   */
  const openSetupPanelIfNoAccount = async () => {
    const { token } = await refreshAuthFromStorage();
    if (hasAuthToken(token)) return;
    setShowAuthPanel(true);
    setExpression('');
    setDisplay('0');
  };

  const tapCountRef = useRef(0);
  const tapResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetDisplayTapTracking = useCallback(() => {
    tapCountRef.current = 0;
    if (tapResetTimerRef.current) {
      clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }
  }, []);

  useEffect(() => resetDisplayTapTracking, [resetDisplayTapTracking]);

  const handleDisplayPress = () => {
    tapCountRef.current += 1;
    if (tapResetTimerRef.current) {
      clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }
    if (tapCountRef.current >= HIDDEN_TRIGGER_TAP_COUNT) {
      resetDisplayTapTracking();
      void openSetupPanelIfNoAccount();
      return;
    }
    tapResetTimerRef.current = setTimeout(resetDisplayTapTracking, HIDDEN_TRIGGER_WINDOW_MS);
  };

  const onPressKey = (key: string) => {
    if (key === 'AC') {
      setExpression('');
      setDisplay('0');
      return;
    }

    if (key === '=') {
      if (!expression) return;
      void handleEqualsPress(expression);
      return;
    }

    if (key === '+/-') {
      if (!expression) {
        setExpression('-');
        setDisplay('-');
      } else {
        const next = expression.startsWith('-') ? expression.slice(1) : `-${expression}`;
        setExpression(next);
        setDisplay(next.slice(0, 12) || '0');
      }
      return;
    }

    if (key === '%') {
      const n = Number(expression);
      if (!Number.isFinite(n)) return;
      const next = String(n / 100);
      setExpression(next);
      setDisplay(next.slice(0, 12));
      return;
    }

    if (isOperator(key)) {
      if (!expression) {
        if (key === '-') {
          setExpression('-');
          setDisplay('-');
        }
        return;
      }
      const last = expression[expression.length - 1];
      const next = isOperator(last) ? `${expression.slice(0, -1)}${key}` : `${expression}${key}`;
      setExpression(next);
      setDisplay(next.slice(0, 12));
      return;
    }

    if (key === '.') {
      const lastOpIndex = Math.max(
        expression.lastIndexOf('+'),
        expression.lastIndexOf('-'),
        expression.lastIndexOf('*'),
        expression.lastIndexOf('/'),
      );
      const chunk = expression.slice(lastOpIndex + 1);
      if (chunk.includes('.')) return;
      const next = !expression || isOperator(expression[expression.length - 1]) ? `${expression}0.` : `${expression}.`;
      setExpression(next);
      setDisplay(next.slice(0, 12));
      return;
    }

    if (/^\d$/.test(key)) {
      const next = `${expression}${key}`;
      setExpression(next);
      setDisplay(next.slice(0, 12));
    }
  };

  const submitLabel = isSubmitting ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Sign up';

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={showAuthPanel}
        animationType="slide"
        transparent={false}
        onRequestClose={closeAuthPanel}>
        <LinearGradient
          colors={['#FBF1EC', '#FAE1D8', '#FBF1EC']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.authGradient}>
          <SafeAreaView style={styles.authSafe}>
            <View style={styles.authTopBar}>
              <TouchableOpacity
                style={styles.authCloseButton}
                onPress={closeAuthPanel}
                accessibilityLabel="Close">
                <X size={18} color={Palette.inkSoft} strokeWidth={2.25} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.authScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.authHeader}>
                <View style={styles.authBrandIcon}>
                  <Heart size={28} color={Palette.primary} fill={Palette.primary} strokeWidth={0} />
                </View>
                <Text style={styles.authHeaderTitle}>{authHeaderTitle}</Text>
                <Text style={styles.authHeaderSubtitle}>{authHeaderSubtitle}</Text>
              </View>

              <View style={styles.authForm}>
                <View style={styles.authFieldWrap}>
                  <User size={17} color={Palette.inkMuted} strokeWidth={2} style={styles.authFieldIcon} />
                  <TextInput
                    style={styles.authField}
                    placeholder="Username"
                    placeholderTextColor={Palette.inkFaint}
                    value={username}
                    onChangeText={handleUsernameChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.authPinFieldGroup}>
                  <View style={[styles.authFieldWrap, errorMessage ? styles.authFieldWrapError : null]}>
                    <Lock size={17} color={Palette.inkMuted} strokeWidth={2} style={styles.authFieldIcon} />
                    <TextInput
                      style={styles.authField}
                      placeholder="Enter 4-digit PIN"
                      placeholderTextColor={Palette.inkFaint}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={handlePasswordChange}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((prev) => !prev)}
                      accessibilityLabel={showPassword ? 'Hide PIN' : 'Show PIN'}
                      style={styles.authEyeButton}>
                      {showPassword ? (
                        <EyeOff size={18} color={Palette.inkMuted} strokeWidth={2} />
                      ) : (
                        <Eye size={18} color={Palette.inkMuted} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {errorMessage ? <Text style={styles.authErrorText}>{errorMessage}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.authPrimaryButton, isSubmitting && styles.authPrimaryButtonDisabled]}
                  onPress={() => void submitAuth(authMode)}
                  disabled={isSubmitting}>
                  <Text style={styles.authPrimaryButtonText}>{submitLabel}</Text>
                </TouchableOpacity>

                <View style={styles.authDivider}>
                  <View style={styles.authDividerLine} />
                  <Text style={styles.authDividerText}>OR</Text>
                  <View style={styles.authDividerLine} />
                </View>

                <TouchableOpacity style={styles.authToggleButton} onPress={toggleAuthMode}>
                  <Text style={styles.authToggleText}>
                    {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <Text style={styles.authToggleAccent}>
                      {authMode === 'login' ? 'Sign up' : 'Log in'}
                    </Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.authFooter}>
              <Text style={styles.authFooterText}>Guardian Angel</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </Modal>

      <View style={styles.calculatorLtr} {...webLtrDir}>
        <Pressable
          style={styles.displayWrap}
          onPress={handleDisplayPress}>
          <Text style={styles.display}>{display}</Text>
        </Pressable>
        <View style={styles.keypad}>
          {BUTTONS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((key) => {
                const isZero = key === '0' && row.length === 3;
                const isTop = ['AC', '+/-', '%'].includes(key);
                const isOperatorKey = ['/', '*', '-', '+', '='].includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => onPressKey(key)}
                    style={[
                      styles.key,
                      isZero ? styles.zeroKey : null,
                      isTop ? styles.topKey : null,
                      isOperatorKey ? styles.operatorKey : null,
                    ]}>
                    <Text style={[styles.keyText, isTop ? styles.topKeyText : null]}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  authGradient: {
    flex: 1,
  },
  authSafe: {
    flex: 1,
  },
  authTopBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  authCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: Palette.border,
  },
  authScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 32,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  authBrandIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Shadow.lift,
  },
  authHeaderTitle: {
    fontSize: 26,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontWeight: '600',
    color: Palette.ink,
    letterSpacing: -0.3,
    textAlign: 'center',
    lineHeight: 32,
  },
  authHeaderSubtitle: {
    marginTop: 10,
    fontSize: 14,
    color: Palette.inkMuted,
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  authForm: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  authFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  authFieldWrapError: {
    borderColor: Palette.rose,
    backgroundColor: 'rgba(255,252,249,0.95)',
  },
  authPinFieldGroup: {
    marginBottom: 6,
  },
  authFieldIcon: {
    marginRight: 12,
  },
  authField: {
    flex: 1,
    paddingVertical: 16,
    color: Palette.ink,
    fontSize: 15,
  },
  authErrorText: {
    color: Palette.rose,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  authEyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  authPrimaryButton: {
    marginTop: 12,
    backgroundColor: Palette.primary,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
    ...Shadow.soft,
  },
  authPrimaryButtonDisabled: {
    opacity: 0.6,
  },
  authPrimaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  authDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginVertical: 28,
  },
  authDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Palette.borderStrong,
  },
  authDividerText: {
    color: Palette.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  authToggleButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  authToggleText: {
    color: Palette.inkMuted,
    fontSize: 13,
  },
  authToggleAccent: {
    color: Palette.primaryDeep,
    fontWeight: '700',
  },
  authFooter: {
    paddingBottom: 18,
    alignItems: 'center',
  },
  authFooterText: {
    color: Palette.inkFaint,
    fontSize: 11,
    letterSpacing: 1.4,
    fontStyle: 'italic',
  },
  // LTR is enforced by `webLtrDir` (the dir="ltr" attribute) on web and by
  // LTR_ROW on the keypad rows on native. A `direction` property here is
  // stripped by react-native-web with a console error, and `writingDirection`
  // is Text-only — neither belongs on this container.
  calculatorLtr: {
    flex: 1,
  },
  displayWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingBottom: 24,
  },
  display: {
    color: '#fff',
    fontSize: 72,
    fontWeight: '300',
    writingDirection: 'ltr',
    textAlign: I18nManager.isRTL ? 'left' : 'right',
  },
  keypad: {
    gap: 12,
  },
  row: {
    flexDirection: LTR_ROW,
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zeroKey: {
    flex: 1,
  },
  topKey: {
    backgroundColor: '#a5a5a5',
  },
  operatorKey: {
    backgroundColor: '#ff9f0a',
  },
  keyText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '500',
    writingDirection: 'ltr',
  },
  topKeyText: {
    color: '#000',
  },
});
