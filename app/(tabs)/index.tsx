import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { unlockSecureDataWithPin } from '../risk-status';

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

  const onPressKey = (key: string) => {
    if (key === 'AC') {
      setExpression('');
      setDisplay('0');
      return;
    }

    if (key === '=') {
      if (!expression) return;
      if (expression === '1234') {
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

  return (
    <SafeAreaView style={styles.container}>
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
