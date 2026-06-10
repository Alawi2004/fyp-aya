// Staff Portal Theme
// Emerald green primary to visually distinguish from admin blue (#2563EB).

export const C = {
  // Brand
  primary:      "#059669",   // emerald-600
  primaryDark:  "#047857",   // emerald-700
  primaryLight: "#ECFDF5",   // emerald-50
  primaryBorder:"#A7F3D0",   // emerald-200

  // Surfaces
  bg:      "#F1F5F9",
  surface: "#FFFFFF",
  border:  "#E2E8F0",

  // Text
  textPrimary: "#0F172A",
  textSecond:  "#475569",
  textMuted:   "#94A3B8",

  // Semantic
  success:   "#10B981",
  successBg: "#ECFDF5",
  warning:   "#F59E0B",
  warningBg: "#FFFBEB",
  danger:    "#EF4444",
  dangerBg:  "#FEF2F2",
  info:      "#3B82F6",
  infoBg:    "#EFF6FF",
};

export const cardStyle = {
  background:   "#fff",
  border:       `1px solid ${C.border}`,
  borderRadius: 16,
  overflow:     "hidden",
  boxShadow:    "0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04)",
};

export const inputStyle = {
  width:        "100%",
  padding:      "10px 14px",
  fontSize:     14,
  borderRadius: 10,
  border:       `1.5px solid ${C.border}`,
  outline:      "none",
  color:        C.textPrimary,
  background:   "#FAFBFC",
  boxSizing:    "border-box",
  fontFamily:   "Inter, system-ui, sans-serif",
};

export const labelStyle = {
  display:      "block",
  fontSize:     12,
  fontWeight:   600,
  color:        "#374151",
  marginBottom: 6,
};

export const btnPrimary = {
  display:        "flex",
  alignItems:     "center",
  justifyContent: "center",
  gap:            8,
  background:     `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
  color:          "#fff",
  border:         "none",
  borderRadius:   10,
  padding:        "11px 20px",
  fontSize:       14,
  fontWeight:     700,
  cursor:         "pointer",
  boxShadow:      `0 4px 14px rgba(5,150,105,.28)`,
};
