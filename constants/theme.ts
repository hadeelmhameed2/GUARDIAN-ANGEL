import { Platform } from 'react-native';

const tintColorLight = '#C97A8E';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#3D2F2C',
    background: '#FBF1EC',
    tint: tintColorLight,
    icon: '#7A6B68',
    tabIconDefault: '#A8978F',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * Soft & warm design tokens. Cream + blush + dusty rose, with sage and warm gold accents.
 * Use these instead of hex literals to keep the dashboard palette consistent.
 */
export const Palette = {
  // Surfaces
  bgCream: '#FBF1EC',
  bgPeach: '#F8EFE8',
  surface: '#FFFCF9',
  surfaceMuted: '#FAEFE6',
  surfaceTinted: '#FDF1ED',
  border: '#F1E4DA',
  borderStrong: '#E5D1C2',
  divider: '#F4E8DD',

  // Text
  ink: '#3D2F2C',
  inkSoft: '#5A4845',
  inkMuted: '#7A6B68',
  inkFaint: '#A8978F',
  onPrimary: '#FFFFFF',

  // Brand
  primary: '#C97A8E',
  primaryDeep: '#A8576C',
  primarySoft: '#F5C9CC',
  sage: '#7A9A7E',
  sageSoft: '#EAF1E5',
  gold: '#C99863',
  goldSoft: '#FAEFDC',
  rose: '#D26B7A',
  roseSoft: '#FAE1D8',

  // Status (softened, never harsh)
  statusGreenInk: '#5C7A60',
  statusGreenBg: '#EAF1E5',
  statusYellowInk: '#A87838',
  statusYellowBg: '#FAEFDC',
  statusRedInk: '#A8576C',
  statusRedBg: '#FAE1D8',

  // Emergency surfaces (kept distinct but warm, not screaming)
  emergencyDeep: '#7E3A48',
  emergencyMid: '#A85565',
  emergencyOnDark: '#FCE3E3',
} as const;

export const Radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const Shadow = {
  soft: {
    shadowColor: '#7A2E2E',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  lift: {
    shadowColor: '#5A1F2A',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
} as const;

export const PageGradient = {
  red: ['#FBE5DE', '#FBEFE5', '#F8EFE8'],
  yellow: ['#FBEAD2', '#FBEFE5', '#F8EFE8'],
  green: ['#ECF3E5', '#F4EFE0', '#F8EFE8'],
} as const;

export const HeaderGradient = {
  red: ['#FBE5DE', '#FAE1D8', '#FDF1ED'],
  yellow: ['#FBEAD2', '#FAEFDC', '#FDF1ED'],
  green: ['#EFF3E7', '#EAF1E5', '#FDF1ED'],
} as const;

export const BranchTint = {
  red: Palette.rose,
  yellow: Palette.gold,
  green: Palette.sage,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },

});
