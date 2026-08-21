import { SymbolWeight } from 'expo-symbols';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { OpaqueColorValue } from 'react-native';

type IconSymbolName = keyof typeof EMOJI_BY_NAME;

const EMOJI_BY_NAME = {
  'house.fill': '🏠',
} as const;

/** Same emoji implementation as non-iOS for consistent UI across platforms and web. */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight: _weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const emoji = EMOJI_BY_NAME[name];
  return (
    <Text
      style={[
        {
          fontSize: size,
          color: color as string,
          lineHeight: size,
          textAlign: 'center',
        },
        style,
      ]}>
      {emoji}
    </Text>
  );
}
