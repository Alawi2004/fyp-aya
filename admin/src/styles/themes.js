// ─────────────────────────────────────────────────────────────
//  theme.js  –  single source of truth for colors & status maps
//  Import from any component: import { STATUS, COLORS } from "../styles/theme";
// ─────────────────────────────────────────────────────────────

export const COLORS = {
  primary:     "#2563EB",
  primaryDark: "#1E40AF",
  primaryLight:"#EFF6FF",
  bg:          "#F1F5F9",
  surface:     "#ffffff",
  border:      "#E2E8F0",
  textPrimary: "#0F172A",
  textSecond:  "#475569",
  textMuted:   "#94A3B8",
  success:     "#10B981",
  successBg:   "#ECFDF5",
  warning:     "#F59E0B",
  warningBg:   "#FFFBEB",
  danger:      "#EF4444",
  dangerBg:    "#FEF2F2",
  info:        "#3B82F6",
  infoBg:      "#EFF6FF",
};

// Trip / ticket / user status → visual style
export const STATUS = {
  Active:    { bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
  Ongoing:   { bg: "#ECFDF5", color: "#059669", dot: "#10B981" },
  Delayed:   { bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B" },
  Scheduled: { bg: "#EFF6FF", color: "#2563EB", dot: "#3B82F6" },
  Completed: { bg: "#F5F3FF", color: "#6D28D9", dot: "#7C3AED" },
  Cancelled: { bg: "#FEF2F2", color: "#B91C1C", dot: "#EF4444" },
  Inactive:  { bg: "#F1F5F9", color: "#64748B", dot: "#94A3B8" },
  Offline:   { bg: "#FEF2F2", color: "#B91C1C", dot: "#EF4444" },
  Suspended: { bg: "#FFFBEB", color: "#D97706", dot: "#F59E0B" },
  Blocked:   { bg: "#FEF2F2", color: "#B91C1C", dot: "#EF4444" },
};

// Alert severity → visual style
export const ALERT = {
  emergency: { dot: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" },
  delay:     { dot: "#F59E0B", bg: "#FFFBEB", text: "#D97706" },
  info:      { dot: "#3B82F6", bg: "#EFF6FF", text: "#1E40AF" },
};

// Vehicle status → visual style
export const VEHICLE_STATUS = {
  Active:      { color: "#059669", bg: "#ECFDF5" },
  Maintenance: { color: "#D97706", bg: "#FFFBEB" },
  Inactive:    { color: "#64748B", bg: "#F1F5F9" },
};

// Shared panel card style (use as: style={{ ...cardStyle }})
export const cardStyle = {
  background:   "#fff",
  border:       "1px solid #E2E8F0",
  borderRadius: 16,
  overflow:     "hidden",
  boxShadow:    "0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04)",
};

// Shared table header cell style
export const thStyle = {
  padding:       "8px 12px",
  textAlign:     "left",
  fontSize:      10,
  fontWeight:    700,
  color:         "#94A3B8",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  borderBottom:  "1px solid #F1F5F9",
  background:    "#F8FAFC",
};

// Shared table body cell style
export const tdStyle = {
  padding:    "11px 12px",
  fontSize:   13,
  color:      "#1E293B",
  borderBottom: "1px solid #F8FAFC",
};
