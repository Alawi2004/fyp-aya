import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { offlineQueue } from "../utils/offlineQueue";
import apiClient from "../api/apiClient";

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline,       setIsOnline]       = useState(navigator.onLine);
  const [syncing,        setSyncing]        = useState(false);
  const [pendingCount,   setPendingCount]   = useState(() => offlineQueue.getPending().length);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const syncRef = useRef(false);

  // Track online / offline events
  useEffect(() => {
    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const refreshCount = useCallback(() => {
    setPendingCount(offlineQueue.getPending().length);
  }, []);

  // Drain the queue — runs one item at a time to avoid flooding the backend
  const syncQueue = useCallback(async () => {
    if (syncRef.current || !navigator.onLine) return;
    const pending = offlineQueue.getPending();
    if (pending.length === 0) return;

    syncRef.current = true;
    setSyncing(true);
    let synced = 0, failed = 0;

    for (const item of pending) {
      try {
        const data = await apiClient.post("/staff/wallet/topup", item.payload);
        offlineQueue.markSynced(item.id, data);
        synced++;
      } catch (err) {
        offlineQueue.markFailed(item.id, err.message);
        failed++;
      }
    }

    refreshCount();
    setLastSyncResult({ synced, failed, time: new Date().toISOString() });
    setSyncing(false);
    syncRef.current = false;
  }, [refreshCount]);

  // Auto-sync the moment connection is restored
  useEffect(() => {
    if (isOnline) syncQueue();
  }, [isOnline, syncQueue]);

  // Enqueue a transaction payload when offline
  const enqueue = useCallback(async (payload) => {
    const item = await offlineQueue.enqueue(payload);
    refreshCount();
    return item;
  }, [refreshCount]);

  return (
    <OfflineContext.Provider value={{ isOnline, syncing, pendingCount, lastSyncResult, enqueue, syncQueue, refreshCount }}>
      {children}
    </OfflineContext.Provider>
  );
}

export const useOfflineCtx = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOfflineCtx must be inside OfflineProvider");
  return ctx;
};
