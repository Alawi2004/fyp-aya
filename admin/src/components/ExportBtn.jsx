import { useState } from "react";
import { downloadCSV, printPDF } from "../utils/export";

export function ExportBtn({ rows = [], columns = [], filename, title, subtitle }) {
  const [open, setOpen] = useState(false);
  const sub = subtitle ?? `Exported ${new Date().toLocaleDateString()} · ${rows.length} record${rows.length !== 1 ? "s" : ""}`;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "8px 14px", background: "#fff", border: "1.5px solid #E2E8F0",
          borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#374151",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}
      >
        ⬇ Export <span style={{ fontSize: 10, color: "#94A3B8" }}>▾</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 4px)",
            background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,.08)", minWidth: 170, zIndex: 50, overflow: "hidden",
          }}>
            {[
              { icon: "📋", label: "Export as CSV", fn: () => downloadCSV(rows, columns, filename || `export-${Date.now()}.csv`) },
              { icon: "📄", label: "Export as PDF", fn: () => printPDF(title || "Export", sub, columns, rows) },
            ].map(({ icon, label, fn }) => (
              <button key={label} onClick={() => { fn(); setOpen(false); }} style={{
                width: "100%", padding: "10px 14px", fontSize: 13, cursor: "pointer",
                background: "none", border: "none", textAlign: "left",
                display: "flex", gap: 8, alignItems: "center", color: "#374151",
              }}>
                {icon} {label}
              </button>
            ))}
            <div style={{ padding: "6px 14px 10px", borderTop: "1px solid #F1F5F9", fontSize: 10, color: "#94A3B8" }}>
              {rows.length} records will be exported
            </div>
          </div>
        </>
      )}
    </div>
  );
}
