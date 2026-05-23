import { Platform } from 'react-native'

// iOS Human Interface Guidelines (HIG) colors
// Adapted with Identa brand teal/cyan
export const colors = {
  // Identa Brand (extracted from real logo)
  brand: '#14B8A6',          // Identa teal — primary accent
  brandDeep: '#0F2E4C',      // Identa navy — primary text / dark accent
  brandLight: '#E6FAF7',     // Soft teal background
  brandSoft: '#CCF5EF',      // Card tint
  brandSurface: '#F0FAF8',   // Very subtle screen tint

  // iOS System Colors
  systemBlue: '#007AFF',
  systemIndigo: '#5856D6',
  systemGreen: '#34C759',
  systemRed: '#FF3B30',
  systemOrange: '#FF9500',
  systemYellow: '#FFCC00',

  // iOS Backgrounds
  background: '#FFFFFF',           // systemBackground
  backgroundSecondary: '#F2F2F7',  // secondarySystemBackground
  backgroundTertiary: '#FFFFFF',
  groupedBackground: '#F2F2F7',

  // iOS Fills
  fill: 'rgba(120, 120, 128, 0.20)',
  fillSecondary: 'rgba(120, 120, 128, 0.16)',
  fillTertiary: 'rgba(118, 118, 128, 0.12)',
  fillQuaternary: 'rgba(116, 116, 128, 0.08)',

  // iOS Labels (text)
  label: '#000000',                // Primary text
  labelSecondary: 'rgba(60, 60, 67, 0.60)',
  labelTertiary: 'rgba(60, 60, 67, 0.30)',
  labelQuaternary: 'rgba(60, 60, 67, 0.18)',

  // iOS Separators
  separator: 'rgba(60, 60, 67, 0.29)',
  separatorOpaque: '#C6C6C8',

  // iOS Grays
  systemGray:  '#8E8E93',
  systemGray2: '#AEAEB2',
  systemGray3: '#C7C7CC',
  systemGray4: '#D1D1D6',
  systemGray5: '#E5E5EA',
  systemGray6: '#F2F2F7',

  // Status semantic
  success: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  info: '#007AFF',

  // Appointment statuses
  scheduled: '#007AFF',
  completed: '#34C759',
  cancelled: '#8E8E93',
  no_show: '#FF3B30',
} as const

// Dark palette — defined alongside `colors` so a future ThemeProvider can
// swap between them. Components currently import `colors` directly; flipping
// the whole app to dark requires routing every styled component through a
// `useColors()` hook (66 files), which is tracked as a separate effort.
// For now this constant is here so the work can be picked up incrementally
// and so the userInterfaceStyle="automatic" config at the OS level can be
// expanded once the wiring is in place.
export const darkColors = {
  brand: '#2DD4BF',
  brandDeep: '#E2E8F0',
  brandLight: 'rgba(45, 212, 191, 0.16)',
  brandSoft: 'rgba(45, 212, 191, 0.12)',
  brandSurface: '#0B1A2A',

  systemBlue: '#0A84FF',
  systemIndigo: '#5E5CE6',
  systemGreen: '#30D158',
  systemRed: '#FF453A',
  systemOrange: '#FF9F0A',
  systemYellow: '#FFD60A',

  background: '#000000',
  backgroundSecondary: '#1C1C1E',
  backgroundTertiary: '#2C2C2E',
  groupedBackground: '#000000',

  fill: 'rgba(120, 120, 128, 0.36)',
  fillSecondary: 'rgba(120, 120, 128, 0.32)',
  fillTertiary: 'rgba(118, 118, 128, 0.24)',
  fillQuaternary: 'rgba(118, 118, 128, 0.18)',

  label: '#FFFFFF',
  labelSecondary: 'rgba(235, 235, 245, 0.60)',
  labelTertiary: 'rgba(235, 235, 245, 0.30)',
  labelQuaternary: 'rgba(235, 235, 245, 0.18)',

  separator: 'rgba(84, 84, 88, 0.65)',
  separatorOpaque: '#38383A',

  systemGray:  '#8E8E93',
  systemGray2: '#636366',
  systemGray3: '#48484A',
  systemGray4: '#3A3A3C',
  systemGray5: '#2C2C2E',
  systemGray6: '#1C1C1E',

  success: '#30D158',
  warning: '#FF9F0A',
  danger: '#FF453A',
  info: '#0A84FF',

  scheduled: '#0A84FF',
  completed: '#30D158',
  cancelled: '#8E8E93',
  no_show: '#FF453A',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

// iOS standard corner radii
export const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 18,
  pill: 9999,
} as const

// Typography: iOS uses native SF Pro (System font); Android uses Inter
// (bundled Google font) which is visually closest to SF Pro. Each weight is
// a separate font family on Android because RN doesn't auto-pick weights
// from a single family there.

export type FontWeight = '400' | '500' | '600' | '700' | '800'

const ANDROID_INTER: Record<FontWeight, string> = {
  '400': 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
}

export function font(weight: FontWeight): string {
  if (Platform.OS === 'ios') return 'System'
  return ANDROID_INTER[weight]
}

const F400 = font('400')
const F500 = font('500')
const F600 = font('600')
const F700 = font('700')

export const typography = {
  largeTitle:    { fontFamily: F700, fontSize: 34, fontWeight: '700' as const, lineHeight: 41, letterSpacing: 0.37 },
  title1:        { fontFamily: F700, fontSize: 28, fontWeight: '700' as const, lineHeight: 34, letterSpacing: 0.36 },
  title2:        { fontFamily: F700, fontSize: 22, fontWeight: '700' as const, lineHeight: 28, letterSpacing: 0.35 },
  title3:        { fontFamily: F600, fontSize: 20, fontWeight: '600' as const, lineHeight: 25, letterSpacing: 0.38 },
  headline:      { fontFamily: F600, fontSize: 17, fontWeight: '600' as const, lineHeight: 22, letterSpacing: -0.41 },
  body:          { fontFamily: F400, fontSize: 17, fontWeight: '400' as const, lineHeight: 22, letterSpacing: -0.41 },
  bodyEmphasized:{ fontFamily: F600, fontSize: 17, fontWeight: '600' as const, lineHeight: 22, letterSpacing: -0.41 },
  callout:       { fontFamily: F400, fontSize: 16, fontWeight: '400' as const, lineHeight: 21, letterSpacing: -0.32 },
  subhead:       { fontFamily: F400, fontSize: 15, fontWeight: '400' as const, lineHeight: 20, letterSpacing: -0.24 },
  subheadBold:   { fontFamily: F600, fontSize: 15, fontWeight: '600' as const, lineHeight: 20, letterSpacing: -0.24 },
  footnote:      { fontFamily: F400, fontSize: 13, fontWeight: '400' as const, lineHeight: 18, letterSpacing: -0.08 },
  footnoteBold:  { fontFamily: F600, fontSize: 13, fontWeight: '600' as const, lineHeight: 18, letterSpacing: -0.08 },
  caption1:      { fontFamily: F400, fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: 0 },
  caption2:      { fontFamily: F400, fontSize: 11, fontWeight: '400' as const, lineHeight: 13, letterSpacing: 0.07 },
} as const

// Shadows use iOS-only shadow* props. We deliberately omit `elevation`
// because on Android, low elevation values render shadows as a thin dark
// outline around rounded cards (visible gray "border" effect). For the
// big elevated UI elements (FAB, modals, tab bar) we set elevation
// inline where the depth is essential.
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const
