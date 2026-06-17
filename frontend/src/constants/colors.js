export const COLORS = {
  // Primary Brand — Purple
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  primaryLight: '#F5F3FF',
  primaryMid: '#EDE9FE',

  // Secondary — Emerald Green
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#ECFDF5',
  secondaryMid: '#D1FAE5',

  // Passenger Theme
  passengerPrimary: '#7C3AED',
  passengerSecondary: '#6D28D9',

  // Driver Theme
  driverPrimary: '#F59E0B',
  driverSecondary: '#D97706',

  // Alert — Amber
  warning: '#F59E0B',
  warningDark: '#D97706',
  warningLight: '#FFFBEB',
  warningMid: '#FEF3C7',

  // Emergency — Soft Red
  danger: '#EF4444',
  dangerDark: '#DC2626',
  dangerLight: '#FEF2F2',
  dangerMid: '#FEE2E2',

  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#E2E8F0',

  // Text — Dark Slate
  textPrimary: '#1E293B',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textOnDark: '#FFFFFF',
  textPlaceholder: '#CBD5E1',

  // Status Aliases
  success: '#10B981',
  info: '#7C3AED',
  accent: '#10B981',
  accentDark: '#059669',

  // Seats
  seatAvailable: '#ECFDF5',
  seatBooked: '#FEF2F2',
  seatSelected: '#7C3AED',
  seatUnavailable: '#F8FAFC',

  // Map
  routeLine: '#7C3AED',
  busMarker: '#F59E0B',
  stopMarker: '#7C3AED',

  // Gradients (arrays for LinearGradient)
  gradientPrimary: ['#7C3AED', '#6D28D9'],
  gradientPassenger: ['#6D28D9', '#7C3AED'],
  gradientDriver: ['#F59E0B', '#D97706'],
  gradientSuccess: ['#10B981', '#059669'],
  gradientCard: ['#FFFFFF', '#F8FAFC'],

  // Headers
  headerBg: '#4C1D95',
  driverHeaderBg: '#78350F',

  // Glow / overlay helpers
  primaryGlow: 'rgba(124,58,237,0.12)',
  primaryGlowStrong: 'rgba(124,58,237,0.22)',
  secondaryGlow: 'rgba(16,185,129,0.12)',
  warningGlow: 'rgba(245,158,11,0.12)',
  dangerGlow: 'rgba(239,68,68,0.12)',
  overlayLight: 'rgba(255,255,255,0.85)',
  overlayDark: 'rgba(30,41,59,0.55)',
};

// ── Purple profile theme ──────────────────────────────────────────────────────
export const PURPLE = {
  primary: '#7C3AED',        // violet-600 (main accent)
  dark: '#6D28D9',           // violet-700
  deep: '#5B21B6',           // violet-800
  light: '#F5F3FF',          // violet-50  (tinted backgrounds)
  mid: '#EDE9FE',            // violet-100 (chips / pills)
  midStrong: '#DDD6FE',      // violet-200 (borders)
  onLight: '#6D28D9',        // text/icon on light violet
  glow: 'rgba(124,58,237,0.12)',
  glowStrong: 'rgba(124,58,237,0.22)',
  // Hero gradient (deep → violet → light violet) — rich and clearly purple
  gradient: ['#4C1D95', '#6D28D9', '#8B5CF6'],
};
