/* StatCard — fleet dashboard KPI card */

export function StatCard({ label, value, delta, up, icon, accent, gradient, onClick }) {
  const isUp   = up === true;
  const isDown = up === false;

  const accentColor = accent || "#2563EB";
  const iconBg      = gradient || `linear-gradient(135deg, ${accentColor}30, ${accentColor}18)`;
  const deltaColor  = isUp ? "#059669" : isDown ? "#DC2626" : accentColor;
  const deltaBg     = isUp ? "#D1FAE5" : isDown ? "#FEE2E2" : `${accentColor}18`;
  const deltaPrefix = isUp ? "↑ " : isDown ? "↓ " : "";

  return (
    <div
      className="kpi-card"
      onClick={onClick}
      style={{
        background: `linear-gradient(145deg, ${accentColor}12 0%, ${accentColor}06 60%, #ffffff 100%)`,
        borderRadius: 14,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: `0 2px 8px ${accentColor}18, 0 4px 20px rgba(0,0,0,.07)`,
        border: `1px solid ${accentColor}30`,
        position: "relative",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {/* Accent stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}70)`,
        borderRadius: "14px 14px 0 0",
      }} />

      {/* Subtle background circle decoration */}
      <div style={{
        position: "absolute", right: -18, top: -18,
        width: 80, height: 80, borderRadius: "50%",
        background: `${accentColor}10`,
        pointerEvents: "none",
      }} />

      {/* Label + icon */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 2 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 10, color: accentColor, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 6,
            opacity: 0.85,
          }}>
            {label}
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, color: "#0F172A",
            lineHeight: 1, letterSpacing: "-.5px",
            animation: "countUp .4s ease both",
          }}>
            {value}
          </div>
        </div>
        {icon && (
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: iconBg,
            border: `1.5px solid ${accentColor}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: `0 2px 8px ${accentColor}20`,
          }}>
            {icon}
          </div>
        )}
      </div>

      {/* Delta */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        paddingTop: 6, borderTop: `1px solid ${accentColor}20`,
      }}>
        {(isUp || isDown) && (
          <span style={{
            padding: "2px 7px", borderRadius: 6,
            background: deltaBg, fontSize: 10, fontWeight: 700, color: deltaColor,
          }}>
            {deltaPrefix.trim()}
          </span>
        )}
        <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
          {delta}
        </span>
      </div>
    </div>
  );
}
