import { createContext, useContext, useState } from "react";

const SHIFT_KEY       = "staff_active_shift";
const LAST_REPORT_KEY = "staff_last_shift_report";
const ShiftContext    = createContext(null);

export function ShiftProvider({ children }) {
  const [shift, setShift] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SHIFT_KEY)) || null; }
    catch { return null; }
  });

  const [lastReport, setLastReport] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LAST_REPORT_KEY)) || null; }
    catch { return null; }
  });

  const openShift = ({ opening_cash, location }) => {
    const s = {
      shift_id:     `SH-${Date.now()}`,
      opened_at:    new Date().toISOString(),
      opening_cash: parseFloat(opening_cash) || 0,
      location,
      tx_count:     0,
      total_amount: 0,
      cash_amount:  0,
      transactions: [],
    };
    localStorage.setItem(SHIFT_KEY, JSON.stringify(s));
    setShift(s);
    return s;
  };

  // Called from TopUpPage after every successful (or queued) top-up.
  // details = { id, receipt_no, user_name, user_id, user_email, station, reference, time }
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

  const closeShift = (closing_cash) => {
    if (!shift) return null;
    const summary = {
      ...shift,
      closed_at:    new Date().toISOString(),
      closing_cash: parseFloat(closing_cash) || 0,
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
