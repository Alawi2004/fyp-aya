import { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../api/apiClient";

const SettingsContext = createContext({ currency: "USD", exchangeRate: 1, fmtMoney: (n) => `USD ${Number(n || 0).toFixed(2)}` });

export function SettingsProvider({ children }) {
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);

  const load = useCallback(() => {
    apiClient.get("/settings")
      .then(data => {
        const flat = data?.flat ?? {};
        if (flat["app.currency"]) setCurrency(flat["app.currency"]);
        const rate = parseFloat(flat["app.exchange_rate"]);
        if (rate > 0) setExchangeRate(rate);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const fmtMoney = useCallback((n) => {
    const v = (parseFloat(n) || 0) * exchangeRate;
    const dec = exchangeRate >= 100 ? 0 : 2;
    return `${currency} ${v.toLocaleString("en", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }, [currency, exchangeRate]);

  return (
    <SettingsContext.Provider value={{ currency, exchangeRate, fmtMoney, reloadSettings: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
