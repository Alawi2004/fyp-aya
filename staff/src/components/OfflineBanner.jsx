import { WifiOff, RefreshCw, CheckCircle, CloudOff } from "lucide-react";
import { useOfflineCtx } from "../context/OfflineContext";
import { C } from "../styles/themes";

export default function OfflineBanner() {
  const { isOnline, syncing, pendingCount, lastSyncResult, syncQueue } = useOfflineCtx();

  // Nothing to show when fully online with nothing pending
  if (isOnline && pendingCount === 0 && !lastSyncResult && !syncing) return null;

  if (!isOnline) {
    return (
      <div style={{
        background: "#FEF2F2", borderBottom: "1.5px solid #FCA5A5",
        padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <WifiOff size={14} color={C.danger} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C", flex: 1 }}>
          You're offline — top-ups will be queued locally with a cryptographic signature and synced when reconnected.
        </span>
        {pendingCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#B91C1C",
            background: "#FEE2E2", padding: "2px 9px", borderRadius: 99, flexShrink: 0,
          }}>
            {pendingCount} queued
          </span>
        )}
      </div>
    );
  }

  if (syncing) {
    return (
      <div style={{
        background: "#FFFBEB", borderBottom: "1.5px solid #FDE68A",
        padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <RefreshCw size={14} color={C.warning} style={{ animation: "offlineSpin 1s linear infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E", flex: 1 }}>
          Syncing {pendingCount} queued transaction{pendingCount !== 1 ? "s" : ""}…
        </span>
        <style>{`@keyframes offlineSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Reconnected with pending items (before sync finishes) or sync just completed
  if (isOnline && pendingCount > 0) {
    return (
      <div style={{
        background: "#F5F3FF", borderBottom: "1.5px solid #DDD6FE",
        padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <CloudOff size={14} color={C.info} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#4C1D95", flex: 1 }}>
          Connection restored — {pendingCount} transaction{pendingCount !== 1 ? "s" : ""} pending sync.
        </span>
        <button
          onClick={syncQueue}
          style={{
            padding: "4px 12px", borderRadius: 7, border: "none",
            background: C.info, color: "#fff",
            fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
          }}
        >
          Sync Now
        </button>
      </div>
    );
  }

  if (lastSyncResult && isOnline && pendingCount === 0) {
    return (
      <div style={{
        background: "#F0FDF4", borderBottom: "1.5px solid #BBF7D0",
        padding: "8px 20px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <CheckCircle size={14} color={C.primary} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#064E3B" }}>
          Sync complete — {lastSyncResult.synced} transaction{lastSyncResult.synced !== 1 ? "s" : ""} synced
          {lastSyncResult.failed > 0 ? `, ${lastSyncResult.failed} failed` : ""}.
        </span>
      </div>
    );
  }

  return null;
}

