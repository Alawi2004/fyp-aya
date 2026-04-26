/* StatCard — light premium design
   Props: label, value, delta, up, icon (ReactNode), accent (hex), gradient (CSS) */

export function StatCard({ label, value, delta, up, icon, accent, gradient }) {
  const isUp   = up === true;
  const isDown = up === false;

  const accentColor = accent || "#2563EB";
  const iconBg      = gradient || `linear-gradient(135deg, ${accentColor}18, ${accentColor}0A)`;

  const deltaColor  = isUp ? "#059669" : isDown ? "#DC2626" : "#64748B";
  const deltaBg     = isUp ? "#ECFDF5" : isDown ? "#FEF2F2" : "#F1F5F9";
  const deltaPrefix = isUp ? "↑" : isDown ? "↓" : "";

  return (
    <div
      className="kpi-card"
      style={{
        background:   "#FFFFFF",
        borderRadius: 16,
        padding:      "20px",
        display:      "flex",
        flexDirection: "column",
        gap:          16,
        boxShadow:    "0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)",
        border:       "1px solid #F1F5F9",
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {/* Top accent stripe */}
      <div style={{
        position:   "absolute",
        top:        0, left: 0, right: 0,
        height:     3,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}80)`,
        borderRadius: "16px 16px 0 0",
      }} />

      {/* Top row: label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize:      11,
            color:         "#94A3B8",
            fontWeight:    600,
            textTransform: "uppercase",
            letterSpacing: ".06em",
            marginBottom:  8,
          }}>
            {label}
          </div>
          <div style={{
            fontSize:    30,
            fontWeight:  800,
            color:       "#0F172A",
            lineHeight:  1,
            letterSpacing: "-.5px",
            animation:   "countUp .4s ease both",
          }}>
            {value}
          </div>
        </div>

        {icon && (
          <div style={{
            width:        46,
            height:       46,
            borderRadius: 12,
            background:   iconBg,
            border:       `1px solid ${accentColor}20`,
            display:      "flex",
            alignItems:   "center",
            justifyContent: "center",
            flexShrink:   0,
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Delta row */}
      <div style={{
        display:    "flex",
        alignItems: "center",
        gap:        6,
        paddingTop: 6,
        borderTop:  "1px solid #F8FAFC",
      }}>
        {(isUp || isDown) && (
          <span style={{
            display:       "inline-flex",
            alignItems:    "center",
            justifyContent: "center",
            padding:       "2px 7px",
            borderRadius:  6,
            background:    deltaBg,
            fontSize:      10,
            fontWeight:    700,
            color:         deltaColor,
          }}>
            {deltaPrefix} {isUp || isDown ? Math.abs(0) : ""}
          </span>
        )}
        <span style={{ fontSize: 12, color: deltaColor, fontWeight: 500 }}>
          {deltaPrefix}{delta}
        </span>
      </div>
    </div>
  );
}
