import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import DashboardPage    from "./pages/DashboardPage";
import LiveTrackingPage from "./pages/LiveTrackingPage";
import CameraPage       from "./pages/CameraPage";
import UsersPage        from "./pages/UsersPage";
import DriversPage      from "./pages/DriversPage";
import VehiclesPage     from "./pages/VehiclesPage";
import RoutesPage       from "./pages/RoutesPage";
import TripsPage        from "./pages/TripsPage";
import AnalyticsPage    from "./pages/AnalyticsPage";
import TicketsPage      from "./pages/TicketsPage";
import NotificationsPage from "./pages/NotificationPage";
import RatingsPage      from "./pages/RatingsPage";
import WalletPage       from "./pages/WalletPage";
import StaffPage        from "./pages/StaffPage";
import ComplaintsPage   from "./pages/ComplaintsPage";
import PassengersPage   from "./pages/PassengersPage";
import AuditLogPage        from "./pages/AuditLogPage";
import SystemSettingsPage  from "./pages/SystemSettingsPage";
import IssuesPage          from "./pages/IssuesPage";

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  const [activePage,       setActivePage]       = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Handle password-reset link: ?token=... in URL
  const urlToken = new URLSearchParams(window.location.search).get("token");
  if (urlToken) {
    return (
      <ResetPasswordPage
        token={urlToken}
        onDone={() => window.history.replaceState({}, "", window.location.pathname)}
      />
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setActivePage("dashboard")} />;
  }

  const PAGES = {
    dashboard:     <DashboardPage onNavigate={setActivePage} />,
    live:          <LiveTrackingPage />,
    camera:        <CameraPage />,
    users:         <UsersPage />,
    passengers:    <PassengersPage />,
    drivers:       <DriversPage />,
    vehicles:      <VehiclesPage />,
    routes:        <RoutesPage />,
    trips:         <TripsPage />,
    analytics:     <AnalyticsPage />,
    tickets:       <TicketsPage />,
    notifications: <NotificationsPage />,
    ratings:       <RatingsPage />,
    wallet:        <WalletPage />,
    auditlog:      <AuditLogPage />,
    settings:      <SystemSettingsPage />,
    staff:         <StaffPage />,
    complaints:    <ComplaintsPage />,
    issues:        <IssuesPage />,
  };

  return (
    <>
      {/* ── Global styles ─────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        body {
          margin: 0;
          font-family: 'Inter', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          background: #F8FAFC;
          color: #1E293B;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

        /* ── Animations ── */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideInDown {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.9; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: scale(.88); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: .35; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-3px); }
        }

        /* ── KPI Cards ── */
        .kpi-card {
          animation: fadeInUp .5s ease both;
          transition: transform .22s ease, box-shadow .22s ease;
          cursor: default;
        }
        .kpi-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,.10) !important;
        }

        /* ── Panel cards ── */
        .panel-card {
          animation: fadeInUp .42s ease both;
          transition: box-shadow .2s ease;
        }
        .panel-card:hover {
          box-shadow: 0 8px 30px rgba(0,0,0,.09) !important;
        }

        /* ── Sidebar nav items ── */
        .nav-item {
          transition: background .14s ease, color .14s ease;
        }

        /* ── Primary button ── */
        .btn-primary {
          transition: background .14s ease, box-shadow .14s ease, transform .1s ease;
        }
        .btn-primary:hover {
          background: #1D4ED8 !important;
          box-shadow: 0 4px 18px rgba(37,99,235,.3) !important;
          transform: translateY(-1px);
        }
        .btn-primary:active { transform: translateY(0); }

        /* ── Table rows ── */
        .table-row { transition: background .12s ease; }
        .table-row:hover { background: #F8FAFC !important; }

        /* ── Status badges ── */
        .status-active    { color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; }
        .status-ongoing   { color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; }
        .status-delayed   { color: #B45309; background: #FFFBEB; border: 1px solid #FDE68A; }
        .status-idle      { color: #64748B; background: #F1F5F9; border: 1px solid #E2E8F0; }
        .status-alert     { color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; }
        .status-offline   { color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; }
        .status-scheduled { color: #2563EB; background: #EFF6FF; border: 1px solid #BFDBFE; }

        /* ── Live pulsing dot ── */
        .live-dot {
          position: relative;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10B981;
          display: inline-block;
        }
        .live-dot::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: #10B981;
          animation: pulse-ring 1.6s ease-out infinite;
        }

        /* ── Skeleton shimmer ── */
        .skeleton {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 8px;
        }

        /* ── Sidebar section labels ── */
        .sidebar-section {
          font-size: 9px;
          font-weight: 700;
          color: #94A3B8;
          letter-spacing: .1em;
          text-transform: uppercase;
          padding: 18px 18px 5px;
        }

        /* ── Search focus ── */
        input:focus, textarea:focus, select:focus { outline: none; }

        /* ── Glass card effect ── */
        .glass-card {
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        /* ── Tooltip ── */
        [data-tooltip] { position: relative; }
        [data-tooltip]:hover::after {
          content: attr(data-tooltip);
          position: absolute;
          left: 50%; top: calc(100% + 6px);
          transform: translateX(-50%);
          background: #1E293B;
          color: #fff;
          font-size: 11px;
          white-space: nowrap;
          padding: 4px 8px;
          border-radius: 6px;
          pointer-events: none;
          animation: fadeIn .1s ease;
          z-index: 9999;
        }
      `}</style>

      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#F8FAFC",
      }}>
        <Topbar
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          collapsed={sidebarCollapsed}
          activePage={activePage}
          onNavigate={setActivePage}
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar
            activePage={activePage}
            onNavigate={setActivePage}
            collapsed={sidebarCollapsed}
          />

          <main style={{
            flex: 1,
            overflowY: "auto",
            padding: "28px 32px 40px",
            background: "#F8FAFC",
          }}>
            {PAGES[activePage] ?? <DashboardPage onNavigate={setActivePage} />}
          </main>
        </div>
      </div>
    </>
  );
}
