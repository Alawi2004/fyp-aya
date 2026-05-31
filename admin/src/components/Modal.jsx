export function Modal({ title, onClose, onSave, saving, children }) {
  return (
    // backdrop
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "fadeIn .15s ease",
      }}
    >
      {/* modal box — stop click from bubbling to backdrop */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.08)",
          animation: "fadeInUp .2s ease both",
        }}
      >
        {/* header — fixed */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", flex: 1, letterSpacing: "-.2px" }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "#F1F5F9",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              color: "#64748B",
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#E2E8F0"}
            onMouseLeave={e => e.currentTarget.style.background = "#F1F5F9"}
          >
            ✕
          </button>
        </div>

        {/* body — scrollable */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>{children}</div>

        {/* footer — fixed */}
        {onSave && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #F1F5F9",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              background: "#F8FAFC",
              flexShrink: 0,
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #E2E8F0",
                background: "#fff",
                fontSize: 13,
                cursor: "pointer",
                color: "#475569",
                fontWeight: 500,
                transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="btn-primary"
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                border: "none",
                background: "#2563EB",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
