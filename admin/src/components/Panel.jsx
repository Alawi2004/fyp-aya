/* Panel — fleet dashboard section card */

export function Panel({ title, action, onAction, children, style, icon, accent, noPad, extra }) {
  return (
    <div
      className="panel-card"
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.04)",
        border: "1px solid #F1F5F9",
        ...style,
      }}
    >
      {/* Header */}
      <div style={{
        padding: "9px 14px",
        borderBottom: "1px solid #F1F5F9",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        {icon && (
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: accent ? `${accent}15` : "#EFF6FF",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <span style={{
          fontSize: 13, fontWeight: 700, color: "#0F172A",
          flex: 1, letterSpacing: "-.1px",
        }}>
          {title}
        </span>
        {extra}
        {action && (
          <span
            onClick={onAction}
            style={{
              fontSize: 11, fontWeight: 600, color: "#2563EB",
              cursor: "pointer", padding: "4px 10px",
              borderRadius: 7, background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              transition: "background .14s", whiteSpace: "nowrap",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#DBEAFE"}
            onMouseLeave={e => e.currentTarget.style.background = "#EFF6FF"}
          >
            {action}
          </span>
        )}
      </div>

      {/* Body */}
      <div style={noPad ? {} : { padding: "10px 14px" }}>
        {children}
      </div>
    </div>
  );
}
