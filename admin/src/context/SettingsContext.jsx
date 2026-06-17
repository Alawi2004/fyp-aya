import { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient from "../api/apiClient";

const SettingsContext = createContext({
  currency:       "USD",
  appName:        "Yalla Transit",
  settings:       {},
  reloadSettings: () => {},
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({});

  const load = useCallback(() => {
    apiClient.get("/settings")
      .then(data => setSettings(data?.flat ?? {}))
      .catch(() => {}); // use defaults silently
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SettingsContext.Provider value={{
      currency:       settings["app.currency"] || "USD",
      appName:        settings["app.name"]     || "Yalla Transit",
      settings,
      reloadSettings: load,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
