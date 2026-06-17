import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ShiftProvider } from "./context/ShiftContext";
import { OfflineProvider } from "./context/OfflineContext";
import { SettingsProvider } from "./context/SettingsContext";
import Sidebar       from "./components/Sidebar";
import Topbar        from "./components/Topbar";
import OfflineBanner from "./components/OfflineBanner";
import LoginPage        from "./pages/LoginPage";
import TopUpPage        from "./pages/TopUpPage";
import HistoryPage      from "./pages/HistoryPage";
import ShiftPage        from "./pages/ShiftPage";
import ShiftHistoryPage from "./pages/ShiftHistoryPage";
import CashReportPage   from "./pages/CashReportPage";

// ─── Page titles ───────────────────────────────────────────────────────────
const PAGE_TITLES = {
  "/topup":         "Wallet Top-Up",
  "/history":       "My Top-Up History",
  "/shift":         "Shift Management",
  "/shift-history": "Shift History",
  "/report":        "Cash Collection Report",
};

// ─── Protected route wrapper ────────────────────────────────────────────────
function RequireStaff({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

// ─── Inner app (has Router context) ─────────────────────────────────────────
function InnerApp() {
  const [collapsed, setCollapsed] = useState(false);
  const { isAuthenticated } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const showShell = isAuthenticated && location.pathname !== "/login";
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Staff Portal";
  const activePage = location.pathname.replace("/", "") || "shift";

  const handleNavigate = (page) => navigate(`/${page}`);

  return (
    <>
      {/* Global styles */}
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Inter', system-ui, sans-serif;
          background: #F1F5F9;
          color: #1E293B;
          -webkit-font-smoothing: antialiased;
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        select { cursor: pointer; }
        button:focus-visible { outline: 2px solid #6D28D9; outline-offset: 2px; }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #6D28D9 !important;
          box-shadow: 0 0 0 3px rgba(109,40,217,.12);
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {showShell && (
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            collapsed={collapsed}
            onToggle={() => setCollapsed(c => !c)}
          />
        )}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {showShell && (
            <Topbar
              onMenuToggle={() => setCollapsed(c => !c)}
              pageTitle={pageTitle}
            />
          )}
          {showShell && <OfflineBanner />}

          <main style={{ flex: 1, overflowY: "auto", background: "#F1F5F9" }}>
            <Routes>
              <Route path="/login" element={<LoginWithRedirect />} />

              <Route path="/topup" element={
                <RequireStaff><TopUpPage /></RequireStaff>
              } />

              <Route path="/history" element={
                <RequireStaff><HistoryPage /></RequireStaff>
              } />

              <Route path="/shift" element={
                <RequireStaff><ShiftPage /></RequireStaff>
              } />

              <Route path="/shift-history" element={
                <RequireStaff><ShiftHistoryPage /></RequireStaff>
              } />

              <Route path="/report" element={
                <RequireStaff><CashReportPage /></RequireStaff>
              } />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/shift" replace />} />
              <Route path="*" element={<Navigate to="/shift" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
}

// Redirect already-logged-in staff away from login page
function LoginWithRedirect() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/shift" replace />;
  return <LoginPage />;
}

// ─── Root ─────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ShiftProvider>
          <OfflineProvider>
            <BrowserRouter>
              <InnerApp />
            </BrowserRouter>
          </OfflineProvider>
        </ShiftProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

