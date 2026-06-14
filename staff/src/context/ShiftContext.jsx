import { createContext, useContext, useState, useEffect } from "react";
import apiClient from "../api/apiClient";
import { useAuth } from "./AuthContext";

const SHIFT_KEY       = "staff_active_shift";
const LAST_REPORT_KEY = "staff_last_shift_report";
const ShiftContext    = createContext(null);

// Map the backend shift record to the shape the UI components expect.
// Location is stored in opening_notes since the DB has no location column.
function backendToLocal(serverShift, existing = null) {
  return {
    _backend_shift_id: serverShift.shift_id,
    shift_id:          `SH-${serverShift.shift_id}`,
    opened_at:         serverShift.opened_at,
    opening_cash:      parseFloat(serverShift.opening_cash || 0),
    location:          serverShift.opening_notes || "—",
    // Preserve locally-tracked transaction list if we're restoring the same shift
    tx_count:     existing?._backend_shift_id === serverShift.shift_id ? (existing.tx_count     || 0) : 0,
    total_amount: existing?._backend_shift_id === serverShift.shift_id ? (existing.total_amount  || 0) : 0,
    cash_amount:  existing?._backend_shift_id === serverShift.shift_id ? (existing.cash_amount   || 0) : 0,
    transactions: existing?._backend_shift_id === serverShift.shift_id ? (existing.transactions  || []) : [],
  };
}

export function ShiftProvider({ children }) {
  const { isAuthenticated } = useAuth();

  const [shift, setShift] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SHIFT_KEY)) || null; }
    catch { return null; }
  });

  const [lastReport, setLastReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAST_REPORT_KEY)) || null; }
    catch { return null; }
  });

  // ── Sync with backend on auth change ────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;

    apiClient.get("/staff/shift/current")
      .then(serverShift => {
        if (serverShift && serverShift.shift_id) {
          const existing = (() => {
            try { return JSON.parse(localStorage.getItem(SHIFT_KEY)); } catch { return null; }
          })();
          const local = backendToLocal(serverShift, existing);
          localStorage.setItem(SHIFT_KEY, JSON.stringify(local));
          setShift(local);
        } else {
          // No active shift on backend — clear any stale local state
          localStorage.removeItem(SHIFT_KEY);
          setShift(null);
        }
      })
      .catch(() => {
        // Backend unreachable — keep whatever localStorage has
      });
  }, [isAuthenticated]);

  // ── Open shift ─────────────────────────────────────────────────────────
  const openShift = async ({ opening_cash, location }) => {
    const data = await apiClient.post("/staff/shift/open", {
      opening_cash: parseFloat(opening_cash) || 0,
      notes:        location,
    });
    const s = backendToLocal(data.shift);
    // Override location with what the user typed (in case notes got trimmed)
    s.location = location || data.shift.opening_notes || "—";
    localStorage.setItem(SHIFT_KEY, JSON.stringify(s));
    setShift(s);
    return s;
  };

  // ── Record a transaction locally (called from TopUpPage after each top-up) ──
  const recordTransaction = (amount, paymentMethod, details = {}) => {
    setShift(prev => {
      if (!prev) return prev;
      const tx = {
        id:            details.id            ?? Date.now(),
        time:          details.time          ?? new Date().toISOString(),
        amount:        parseFloat(amount),
        paymentMethod,
        userName:      details.user_name     ?? "—",
        userId:        details.user_id,
        userEmail:     details.user_email,
        station:       details.station       ?? prev.location,
        receiptNo:     details.receipt_no    ?? `OFQ-${Date.now()}`,
        reference:     details.reference,
        queued:        details.queued        ?? false,
      };
      const updated = {
        ...prev,
        tx_count:     (prev.tx_count     || 0) + 1,
        total_amount: (prev.total_amount  || 0) + parseFloat(amount),
        cash_amount:  (prev.cash_amount   || 0) + (paymentMethod === "Cash" ? parseFloat(amount) : 0),
        transactions: [...(prev.transactions || []), tx],
      };
      localStorage.setItem(SHIFT_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // ── Close shift ─────────────────────────────────────────────────────────
  const closeShift = async (closing_cash) => {
    if (!shift) return null;

    const data = await apiClient.post("/staff/shift/close", {
      closing_cash: parseFloat(closing_cash) || 0,
    });

    // Prefer backend totals (authoritative) but keep local transactions for the
    // line-item table in CashReportPage.
    const cs = data.cash_summary || {};
    const summary = {
      ...shift,
      closed_at:    data.shift?.closed_at ?? new Date().toISOString(),
      closing_cash: parseFloat(closing_cash) || 0,
      tx_count:     cs.total_transactions ?? shift.tx_count,
      total_amount: parseFloat(cs.total_collected  ?? shift.total_amount),
      cash_amount:  parseFloat(cs.cash_collected   ?? shift.cash_amount),
    };

    localStorage.setItem(LAST_REPORT_KEY, JSON.stringify(summary));
    localStorage.removeItem(SHIFT_KEY);
    setLastReport(summary);
    setShift(null);
    return summary;
  };

  return (
    <ShiftContext.Provider value={{ shift, isShiftOpen: !!shift, openShift, closeShift, recordTransaction, lastReport }}>
      {children}
    </ShiftContext.Provider>
  );
}

export const useShift = () => {
  const ctx = useContext(ShiftContext);
  if (!ctx) throw new Error("useShift must be inside ShiftProvider");
  return ctx;
};
