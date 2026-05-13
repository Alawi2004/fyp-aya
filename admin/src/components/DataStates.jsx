// Shared loading / error / empty state components.
// Used consistently across every page that fetches remote data.

// ── Spinner ────────────────────────────────────────────────────────────────────
export function PageLoading({ message = "Loading…", minHeight = 320 }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 16, minHeight, color: "#94A3B8",
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "3px solid #E2E8F0",
        borderTopColor: "#2563EB",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 13, fontWeight: 500 }}>{message}</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Error banner with retry ────────────────────────────────────────────────────
export function PageError({ message, onRetry, minHeight = 280 }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 14, minHeight,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "#FEF2F2", border: "1px solid #FECACA",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24,
      }}>⚠️</div>
      <div style={{ textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>
          Something went wrong
        </div>
        {message && (
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 14 }}>
            {message}
          </div>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: "8px 20px", borderRadius: 9, border: "none",
              background: "#2563EB", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
export function PageEmpty({ message = "No data found", hint, icon = "📋", action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: 12, padding: "60px 20px",
      color: "#94A3B8",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 16,
        background: "#F8FAFC", border: "1px solid #E2E8F0",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 30,
      }}>{icon}</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: hint ? 4 : 0 }}>
          {message}
        </div>
        {hint && <div style={{ fontSize: 12, color: "#94A3B8" }}>{hint}</div>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 4, padding: "8px 18px", borderRadius: 9, border: "none",
            background: "#2563EB", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── Inline error banner (for within a panel, not full-page) ───────────────────
export function InlineError({ message, onRetry }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 16px", background: "#FEF2F2",
      border: "1px solid #FECACA", borderRadius: 10, margin: "8px 0",
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
      <span style={{ fontSize: 13, color: "#DC2626", flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: "4px 12px", borderRadius: 7, border: "1px solid #FECACA",
            background: "#fff", color: "#DC2626", fontSize: 12, fontWeight: 600,
            cursor: "pointer", flexShrink: 0,
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
