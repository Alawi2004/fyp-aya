import { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../api/apiClient";

const SettingsContext = createContext({ currency: "USD" });

export function SettingsProvider({ children }) {
  const [currency, setCurrency] = useState("USD");

  const load = useCallback(() => {
    apiClient.get("/settings")
      .then(data => {
        const cur = data?.flat?.["app.currency"];
        if (cur) setCurrency(cur);
      })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingsContext.Provider value={{ currency, reloadSettings: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
