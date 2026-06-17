// Staff Portal Theme
// Primary: Purple (#6D28D9) matching mobile app

export const C = {
  // Brand — Purple primary (matches mobile app)
  primary:       "#6D28D9",   // purple-700
  primaryDark:   "#4C1D95",   // purple-900
  primaryLight:  "#F5F3FF",   // purple-50
  primaryBorder: "#DDD6FE",   // purple-200

  // Surfaces
  bg:      "#F8FAFC",
  surface: "#FFFFFF",
  border:  "#E2E8F0",

  // Text
  textPrimary: "#1E293B",
  textSecond:  "#475569",
  textMuted:   "#94A3B8",

  // Semantic
  success:    "#22C55E",   // green-500
  successBg:  "#F0FDF4",   // green-50
  warning:    "#F59E0B",
  warningBg:  "#FFFBEB",
  danger:     "#EF4444",
  dangerBg:   "#FEF2F2",
  info:       "#8B5CF6",
  infoBg:     "#F5F3FF",
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
  boxShadow:      `0 4px 14px rgba(109,40,217,.28)`,
};
