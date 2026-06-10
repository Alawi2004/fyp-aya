export const COLORS = {
  // Primary Brand — Modern Blue
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  primaryMid: '#DBEAFE',

  // Secondary — Emerald Green
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#ECFDF5',
  secondaryMid: '#D1FAE5',

  // Passenger Theme
  passengerPrimary: '#2563EB',
  passengerSecondary: '#1D4ED8',

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
  info: '#3B82F6',
  accent: '#10B981',
  accentDark: '#059669',

  // Seats
  seatAvailable: '#ECFDF5',
  seatBooked: '#FEF2F2',
  seatSelected: '#2563EB',
  seatUnavailable: '#F8FAFC',

  // Map
  routeLine: '#2563EB',
  busMarker: '#F59E0B',
  stopMarker: '#2563EB',

  // Gradients (arrays for LinearGradient)
  gradientPrimary: ['#2563EB', '#1D4ED8'],
  gradientPassenger: ['#2563EB', '#7C3AED'],
  gradientDriver: ['#F59E0B', '#D97706'],
  gradientSuccess: ['#10B981', '#059669'],
  gradientCard: ['#FFFFFF', '#F8FAFC'],

  // Headers
  headerBg: '#1E3A8A',
  driverHeaderBg: '#78350F',

  // Glow / overlay helpers (60-30-10 accent at opacity)
  // (purple helpers appended after this object — see PURPLE export below)
  primaryGlow: 'rgba(37,99,235,0.12)',
  primaryGlowStrong: 'rgba(37,99,235,0.22)',
  secondaryGlow: 'rgba(16,185,129,0.12)',
  warningGlow: 'rgba(245,158,11,0.12)',
  dangerGlow: 'rgba(239,68,68,0.12)',
  overlayLight: 'rgba(255,255,255,0.85)',
  overlayDark: 'rgba(30,41,59,0.55)',
};

// ── Purple profile theme ──────────────────────────────────────────────────────
// Used by the passenger profile screens (Personal Info, Trip History, My Ratings)
// to give the profile area a distinct, polished violet identity that matches the
// ProfileScreen hero gradient.
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
