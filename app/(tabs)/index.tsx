import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { unlockSecureDataWithPin } from '../risk-status';
import { Fonts, Palette, Shadow } from '@/constants/theme';
import { apiFetch } from '@/src/api';
import { readSecureItem, writeSecureItem } from '@/src/secure-storage';

/** Set to `false` before production to restore real `/api/auth` login & registration. */
const BYPASS_SERVER_AUTH = true;

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
  const [storedToken, setStoredToken] = useState<string | null>(null);
  const [storedCalculatorCode, setStoredCalculatorCode] = useState<string | null>(null);

  const TOKEN_KEY = 'ga_auth_token';
  const CODE_KEY = 'ga_calculator_code';

  useEffect(() => {
    void (async () => {
      const [token, code] = await Promise.all([
        readSecureItem(TOKEN_KEY),
        readSecureItem(CODE_KEY),
      ]);
      setStoredToken(token);
      setStoredCalculatorCode(code);
    })();
  }, []);

  const saveSession = async (token: string, calculatorCode: string) => {
    await Promise.all([
      writeSecureItem(TOKEN_KEY, token),
      writeSecureItem(CODE_KEY, calculatorCode),
    ]);
    setStoredToken(token);
    setStoredCalculatorCode(calculatorCode);
  };

  const submitAuth = async (mode: 'login' | 'register') => {
    const nextUsername = username.trim();
    const nextPassword = password.trim();
    if (!nextUsername || !nextPassword) {
      Alert.alert('Missing fields', 'Please enter Username and Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (BYPASS_SERVER_AUTH) {
        const localToken = `local-dev-${Date.now()}`;
        await saveSession(localToken, nextPassword);
        await writeSecureItem('ga_auth_username', nextUsername);
        const unlocked = await unlockSecureDataWithPin(nextPassword);
        if (unlocked) {
          setShowAuthPanel(false);
          router.replace('/home');
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
        Alert.alert(mode === 'register' ? 'Registration failed' : 'Login failed', payload?.error ?? 'Request failed.');
        return;
      }

      const token = String(payload?.token ?? '');
      if (!token) {
        Alert.alert('Error', 'Token not returned from server.');
        return;
      }

      await saveSession(token, nextPassword);
      const unlocked = await unlockSecureDataWithPin(nextPassword);
      if (unlocked) {
        router.replace('/home');
      }
    } catch {
      Alert.alert('Network error', 'Could not connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onPressKey = (key: string) => {
    if (key === 'AC') {
      setExpression('');
      setDisplay('0');
      return;
    }

    if (key === '=') {
      if (!expression) return;
      const hasToken = Boolean(storedToken);
      const personalCode = storedCalculatorCode;

      if (!hasToken && expression === '1234') {
        setShowAuthPanel(true);
        setExpression('');
        setDisplay('0');
        return;
      }

      if (hasToken && personalCode && expression === personalCode) {
        void (async () => {
          const unlocked = await unlockSecureDataWithPin(expression);
          if (unlocked) {
            router.replace('/home');
          }
        })();
        return;
      }
      try {
        const result = evaluateExpression(expression);
        const resultText = Number.isInteger(result) ? String(result) : String(Number(result.toFixed(8)));
        setExpression(resultText);
        setDisplay(resultText.slice(0, 12));
      } catch {
        setExpression('');
        setDisplay('0');
      }
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
        onRequestClose={() => setShowAuthPanel(false)}>
        <LinearGradient
          colors={['#FBF1EC', '#FAE1D8', '#FBF1EC']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.authGradient}>
          <SafeAreaView style={styles.authSafe}>
            <View style={styles.authTopBar}>
              <TouchableOpacity
                style={styles.authCloseButton}
                onPress={() => setShowAuthPanel(false)}
                accessibilityLabel="Close">
                <Text style={{ fontSize: 20, color: Palette.inkSoft, lineHeight: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.authScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View style={styles.authBrandWrap}>
                <View style={styles.authBrandIcon}>
                  <Text style={{ fontSize: 28, color: Palette.primary, lineHeight: 28 }}>❤️</Text>
                </View>
                <Text style={styles.authBrandTitle}>Guardian</Text>
                <Text style={styles.authBrandSubtitle}>Your safe, private space.</Text>
              </View>

              <View style={styles.authForm}>
                <View style={styles.authFieldWrap}>
                  <Text style={[styles.authFieldIcon, { fontSize: 16, color: Palette.inkMuted, lineHeight: 16 }]}>👤</Text>
                  <TextInput
                    style={styles.authField}
                    placeholder="Username"
                    placeholderTextColor={Palette.inkFaint}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.authFieldWrap}>
                  <Text style={[styles.authFieldIcon, { fontSize: 16, color: Palette.inkMuted, lineHeight: 16 }]}>🔒</Text>
                  <TextInput
                    style={styles.authField}
                    placeholder="Password"
                    placeholderTextColor={Palette.inkFaint}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                    style={styles.authEyeButton}>
                    <Text style={{ fontSize: 18, color: Palette.inkMuted, lineHeight: 18 }}>
                      {showPassword ? '🙈' : '👁️'}
                    </Text>
                  </TouchableOpacity>
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

                <TouchableOpacity
                  style={styles.authToggleButton}
                  onPress={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}>
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

      <View style={styles.displayWrap}>
        <Text style={styles.display}>{display}</Text>
      </View>
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
    paddingTop: 24,
    paddingBottom: 32,
  },
  authBrandWrap: {
    alignItems: 'center',
    marginBottom: 36,
  },
  authBrandIcon: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: '#FFFCF9',
    borderWidth: 1,
    borderColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    ...Shadow.lift,
  },
  authBrandTitle: {
    fontSize: 38,
    fontFamily: Fonts.serif,
    fontStyle: 'italic',
    fontWeight: '500',
    color: Palette.ink,
    letterSpacing: -0.4,
  },
  authBrandSubtitle: {
    marginTop: 8,
    fontSize: 13,
    color: Palette.inkMuted,
    letterSpacing: 0.4,
  },
  authForm: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  authFieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: Palette.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
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
  authEyeButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  authPrimaryButton: {
    marginTop: 8,
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
  },
  keypad: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
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
  },
  topKeyText: {
    color: '#000',
  },
});
