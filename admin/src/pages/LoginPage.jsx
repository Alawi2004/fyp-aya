import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/* ── Global styles ───────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: #0F172A; }

  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes blobA  {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(40px, 60px) scale(1.15); }
    66%     { transform: translate(-30px, 30px) scale(0.95); }
  }
  @keyframes blobB  {
    0%,100% { transform: translate(0,0) scale(1.1); }
    33%     { transform: translate(-50px,-40px) scale(0.9); }
    66%     { transform: translate(30px,-20px) scale(1.2); }
  }
  @keyframes blobC  {
    0%,100% { transform: translate(0,0) scale(1); opacity: .06; }
    50%     { transform: translate(20px,30px) scale(1.1); opacity: .1; }
  }

  .blob-a { animation: blobA 9s ease-in-out infinite; }
  .blob-b { animation: blobB 12s ease-in-out infinite; }
  .blob-c { animation: blobC 7s ease-in-out infinite; }
  .form-anim { animation: fadeUp .38s cubic-bezier(.22,1,.36,1) both; }

  .lp-input { transition: border-color .15s, box-shadow .15s; }
  .lp-input:focus { outline: none; border-color: #7C3AED !important; box-shadow: 0 0 0 3px rgba(124,58,237,.14) !important; }
  .lp-input:focus + .lp-float,
  .lp-input:not(:placeholder-shown) + .lp-float {
    top: 9px !important; transform: none !important;
    font-size: 10px !important; color: #7C3AED !important; font-weight: 700 !important;
    letter-spacing: .04em !important; text-transform: uppercase !important;
  }

  .lp-btn { transition: transform .12s, box-shadow .15s, opacity .15s; }
  .lp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(109,40,217,.45) !important; }
  .lp-btn:active:not(:disabled) { transform: translateY(0); }

  .ghost-btn { transition: border-color .15s, background .15s, color .15s; }
  .ghost-btn:hover { border-color: #DDD6FE !important; background: #F5F3FF !important; color: #6D28D9 !important; }

  .eye-btn { transition: color .12s; }
  .eye-btn:hover { color: #7C3AED !important; }

  .otp-box { transition: border-color .15s, background .15s, box-shadow .15s; }
  .otp-box:focus { outline: none; border-color: #7C3AED !important; background: #F5F3FF !important; box-shadow: 0 0 0 3px rgba(124,58,237,.14) !important; }

  .feature-item { transition: background .15s; }
  .feature-item:hover { background: rgba(255,255,255,.08) !important; }
`;

/* ── Colour tokens ───────────────────────────────────────────────────────── */
const P = {
  grad0: "#4C1D95",
  grad1: "#6D28D9",
  grad2: "#8B5CF6",
  primary: "#7C3AED",
  primaryDark: "#6D28D9",
  primaryLight: "#F5F3FF",
  primaryMid: "#EDE9FE",
  primaryBorder: "#DDD6FE",
  glow: "rgba(124,58,237,0.32)",
};

/* ── Bus logo (matches mobile app) ──────────────────────────────────────── */
function BusLogo({ size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="logoG" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E5EDFF" />
        </linearGradient>
      </defs>
      {/* Badge */}
      <rect x="6" y="6" width="88" height="88" rx="26" fill="url(#logoG)" />
      {/* Bus body */}
      <rect x="28" y="26" width="44" height="40" rx="11" fill={P.primary} />
      {/* Windows */}
      <rect x="34" y="33" width="13" height="11" rx="3.5" fill="#FFFFFF" />
      <rect x="53" y="33" width="13" height="11" rx="3.5" fill="#FFFFFF" />
      {/* Lower band */}
      <rect x="34" y="50" width="32" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
      {/* Wheels */}
      <circle cx="38" cy="70" r="6" fill="#1E293B" />
      <circle cx="62" cy="70" r="6" fill="#1E293B" />
      {/* Motion lines */}
      <path d="M14 40 H24" stroke={P.primary} strokeWidth="4" strokeLinecap="round" />
      <path d="M16 52 H24" stroke={P.primary} strokeWidth="4" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

/* ── Left branding panel ─────────────────────────────────────────────────── */
function BrandPanel() {
  const features = [
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5.25-8 12-8 12S4 15.25 4 10a8 8 0 0 1 8-8z"/>
        </svg>
      ),
      text: "Real-time GPS fleet tracking",
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      text: "AI driver monitoring & alerts",
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
        </svg>
      ),
      text: "Passenger ticketing & wallets",
    },
    {
      icon: (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      text: "Analytics & demand forecasting",
    },
  ];

  return (
    <div style={{
      width: 460,
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${P.grad0} 0%, ${P.grad1} 52%, ${P.grad2} 100%)`,
      display: "flex",
      flexDirection: "column",
      padding: "48px 52px",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Animated blobs */}
      <div className="blob-a" style={{
        position: "absolute", top: -100, right: -100, width: 340, height: 340, borderRadius: "50%",
        background: "rgba(124,58,237,0.45)", pointerEvents: "none",
      }} />
      <div className="blob-b" style={{
        position: "absolute", bottom: -80, left: -80, width: 280, height: 280, borderRadius: "50%",
        background: "rgba(109,40,217,0.38)", pointerEvents: "none",
      }} />
      <div className="blob-c" style={{
        position: "absolute", top: "38%", right: -50, width: 200, height: 200, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)", pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
        <div style={{
          borderRadius: 18,
          boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          flexShrink: 0,
        }}>
          <BusLogo size={52} />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 19, letterSpacing: "-.4px" }}>Yalla Transit</div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5, marginTop: 3,
            background: "rgba(255,255,255,.12)", borderRadius: 20, padding: "3px 10px",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
            <span style={{ color: "rgba(255,255,255,.85)", fontSize: 11, fontWeight: 600 }}>Admin Portal</span>
          </div>
        </div>
      </div>

      {/* Main copy */}
      <div style={{ position: "relative", zIndex: 1, marginTop: "auto", paddingBottom: 8 }}>
        <h1 style={{
          color: "#fff", fontSize: 38, fontWeight: 900,
          lineHeight: 1.12, letterSpacing: "-.7px", marginBottom: 14,
        }}>
          Manage your<br />transit network
        </h1>
        <p style={{ color: "rgba(255,255,255,.62)", fontSize: 15, lineHeight: 1.7, maxWidth: 330, marginBottom: 40 }}>
          One dashboard to oversee your fleet, routes, passengers, and operations in real time.
        </p>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {features.map(({ icon, text }) => (
            <div
              key={text}
              className="feature-item"
              style={{
                display: "flex", alignItems: "center", gap: 13,
                padding: "11px 14px", borderRadius: 12,
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.1)",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,.13)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,.9)", flexShrink: 0,
              }}>{icon}</div>
              <span style={{ color: "rgba(255,255,255,.82)", fontSize: 13.5, fontWeight: 500 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p style={{ color: "rgba(255,255,255,.28)", fontSize: 12, position: "relative", zIndex: 1, marginTop: 40 }}>
        © 2026 Yalla Transit · Secure administrative access
      </p>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{
      width: 17, height: 17, borderRadius: "50%",
      border: "2.5px solid rgba(255,255,255,.3)",
      borderTopColor: "#fff",
      animation: "spin .65s linear infinite",
      display: "inline-block",
      flexShrink: 0,
    }} />
  );
}

/* ── Field with floating label + left icon ───────────────────────────────── */
function Field({ label, type = "text", value, onChange, autoFocus, autoComplete, icon, suffix }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ position: "relative" }}>
        {/* Left icon */}
        <div style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          color: "#94A3B8", display: "flex", pointerEvents: "none", zIndex: 1,
        }}>
          {icon}
        </div>

        <input
          className="lp-input"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder=" "
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            height: 58,
            padding: "22px 44px 8px 44px",
            border: "1.5px solid #E2E8F0",
            borderRadius: 14,
            fontSize: 14.5,
            fontWeight: 600,
            color: "#1E293B",
            background: "#F8FAFC",
            boxSizing: "border-box",
          }}
        />
        {/* Floating label — must immediately follow input for the + CSS selector */}
        <label
          className="lp-float"
          style={{
            position: "absolute", left: 44, top: "50%", transform: "translateY(-50%)",
            fontSize: 14, fontWeight: 500, color: "#94A3B8",
            pointerEvents: "none", transition: "top .15s, font-size .15s, color .15s, font-weight .15s",
          }}
        >
          {label}
        </label>
        {suffix && (
          <div style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", zIndex: 1 }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Password field ──────────────────────────────────────────────────────── */
function PasswordField({ label, value, onChange, autoFocus, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <Field
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={onChange}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      icon={
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
        </svg>
      }
      suffix={
        <button
          type="button"
          className="eye-btn"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94A3B8", lineHeight: 0, display: "flex" }}
        >
          {show
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      }
    />
  );
}

/* ── Primary gradient button (matches app's sign-in button) ──────────────── */
function PrimaryBtn({ children, loading, disabled, type = "submit" }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className="lp-btn"
      style={{
        width: "100%",
        height: 56,
        background: disabled || loading
          ? "#C4B5FD"
          : `linear-gradient(135deg, ${P.grad1} 0%, ${P.grad2} 100%)`,
        color: "#fff",
        border: "none",
        borderRadius: 14,
        fontSize: 15,
        fontWeight: 800,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 8,
        letterSpacing: "0.3px",
        boxShadow: disabled || loading ? "none" : `0 8px 20px ${P.glow}`,
      }}
    >
      {loading ? <Spinner /> : (
        <>
          {children}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </>
      )}
    </button>
  );
}

/* ── Ghost / outline button ──────────────────────────────────────────────── */
function GhostBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ghost-btn"
      style={{
        width: "100%",
        height: 52,
        background: "none",
        border: `1.5px solid #E2E8F0`,
        borderRadius: 14,
        fontSize: 14,
        fontWeight: 600,
        color: "#64748B",
        cursor: "pointer",
        marginTop: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

/* ── Alert ───────────────────────────────────────────────────────────────── */
function Alert({ type = "error", children }) {
  const s = {
    error:   { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: "⚠" },
    success: { bg: "#ECFDF5", border: "#A7F3D0", color: "#059669", icon: "✓" },
    info:    { bg: "#F5F3FF", border: "#DDD6FE", color: "#7C3AED", icon: "ℹ" },
  }[type];
  return (
    <div style={{
      background: s.bg,
      border: `1px solid ${s.border}`,
      borderRadius: 12,
      padding: "12px 14px",
      fontSize: 13,
      color: s.color,
      marginBottom: 20,
      lineHeight: 1.55,
      display: "flex",
      gap: 8,
      alignItems: "flex-start",
      fontWeight: 500,
    }}>
      <span style={{ fontWeight: 700, flexShrink: 0 }}>{s.icon}</span>
      <span>{children}</span>
    </div>
  );
}

/* ── Lockout countdown ───────────────────────────────────────────────────── */
function LockoutBanner({ retryAfterSeconds, onUnlocked }) {
  const [secs, setSecs] = useState(retryAfterSeconds);
  useEffect(() => {
    if (secs <= 0) { onUnlocked(); return; }
    const t = setTimeout(() => setSecs(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs, onUnlocked]);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return (
    <div style={{
      background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12, padding: "14px 16px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#C2410C" }}>Account temporarily locked</span>
      </div>
      <p style={{ fontSize: 12, color: "#9A3412", lineHeight: 1.5, marginBottom: 8 }}>
        Too many failed attempts. Please try again in:
      </p>
      <div style={{ fontFamily: "monospace", fontSize: 26, fontWeight: 800, color: "#EA580C", letterSpacing: 2 }}>
        {m}:{s}
      </div>
    </div>
  );
}

/* ── OTP boxes ───────────────────────────────────────────────────────────── */
function OTPInput({ value, onChange }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const update = (d) => onChange(d.join(""));

  const handleChange = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits]; next[i] = d; update(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };
  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) { const n = [...digits]; n[i] = ""; update(n); }
      else if (i > 0) refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft"  && i > 0) refs.current[i - 1]?.focus();
    else if   (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
  };
  const handlePaste = (e) => {
    e.preventDefault();
    const p = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    update(Array.from({ length: 6 }, (_, i) => p[i] || ""));
    refs.current[Math.min(p.length, 5)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 9, marginBottom: 24 }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => refs.current[i] = el}
          className="otp-box"
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          autoFocus={i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            flex: 1, height: 60,
            textAlign: "center",
            fontSize: 24, fontWeight: 800,
            border: `2px solid ${d ? P.primaryBorder : "#E2E8F0"}`,
            borderRadius: 12,
            background: d ? P.primaryLight : "#F8FAFC",
            color: "#1E293B",
          }}
        />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Step 1 — Sign In
══════════════════════════════════════════════════════════════════════════ */
function SignInStep({ onSuccess, onForgot }) {
  const { login, loading } = useAuth();
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [err,         setErr]         = useState(null);
  const [lockoutSecs, setLockoutSecs] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const result = await login(email, password);
      if (result.requires_2fa) {
        onSuccess({ step: "2fa", tempToken: result.temp_token });
      } else {
        onSuccess({ step: "done" });
      }
    } catch (ex) {
      if (ex.retry_after_seconds) setLockoutSecs(ex.retry_after_seconds);
      else setErr(ex.message);
    }
  };

  return (
    <form onSubmit={submit} className="form-anim">
      {/* Section header */}
      <div style={{ marginBottom: 30 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", letterSpacing: "-.6px", marginBottom: 6 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>
          Sign in to your admin account to continue
        </p>
      </div>

      {lockoutSecs !== null
        ? <LockoutBanner retryAfterSeconds={lockoutSecs} onUnlocked={() => setLockoutSecs(null)} />
        : err && <Alert type="error">{err}</Alert>
      }

      <Field
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        autoFocus
        autoComplete="email"
        icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
        }
      />
      <PasswordField
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -6, marginBottom: 22 }}>
        <button
          type="button"
          onClick={onForgot}
          style={{
            background: "none", border: "none", color: P.primary,
            fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0,
          }}
        >
          Forgot password?
        </button>
      </div>

      <PrimaryBtn loading={loading} disabled={!email || !password}>
        {loading ? "Signing in…" : "Sign in"}
      </PrimaryBtn>

      {/* Security note */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 20 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 500 }}>Protected with end-to-end encryption</span>
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Step 2 — Two-Factor Auth
══════════════════════════════════════════════════════════════════════════ */
function TwoFAStep({ tempToken, onSuccess, onBack }) {
  const { verify2fa, loading } = useAuth();
  const [code, setCode] = useState("");
  const [err,  setErr]  = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setErr(null);
    try {
      await verify2fa(tempToken, code);
      onSuccess();
    } catch (ex) {
      setErr(ex.message);
      setCode("");
    }
  };

  return (
    <form onSubmit={submit} className="form-anim">
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: P.primaryLight, border: `1.5px solid ${P.primaryBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
        </svg>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-.5px", marginBottom: 6 }}>
        Two-factor auth
      </h1>
      <p style={{ fontSize: 14, color: "#64748B", fontWeight: 500, marginBottom: 28 }}>
        Enter the 6-digit code from your authenticator app.
      </p>

      {err && <Alert type="error">{err}</Alert>}
      <OTPInput value={code} onChange={setCode} />

      <PrimaryBtn loading={loading} disabled={code.length !== 6}>
        {loading ? "Verifying…" : "Verify"}
      </PrimaryBtn>
      <GhostBtn onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to sign in
      </GhostBtn>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Step 3 — Forgot Password
══════════════════════════════════════════════════════════════════════════ */
function ForgotStep({ onBack }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent,  setSent]  = useState(false);
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="form-anim">
      <div style={{
        width: 52, height: 52, borderRadius: 14,
        background: P.primaryLight, border: `1.5px solid ${P.primaryBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={P.primary} strokeWidth="2" strokeLinecap="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0F172A", letterSpacing: "-.5px", marginBottom: 6 }}>
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: "#64748B", fontWeight: 500, marginBottom: 28 }}>
        Enter your admin email and we'll send you a secure reset link.
      </p>

      {err  && <Alert type="error">{err}</Alert>}
      {sent && (
        <Alert type="success">
          A reset link has been sent to <strong>{email}</strong>. The link expires in 1 hour.
        </Alert>
      )}

      {!sent && (
        <form onSubmit={submit}>
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            autoFocus
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            }
          />
          <PrimaryBtn loading={busy} disabled={!email}>
            {busy ? "Sending…" : "Send reset link"}
          </PrimaryBtn>
        </form>
      )}

      <GhostBtn onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Back to sign in
      </GhostBtn>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Root
══════════════════════════════════════════════════════════════════════════ */
export default function LoginPage({ onLoginSuccess }) {
  const [step,      setStep]      = useState("signin");
  const [tempToken, setTempToken] = useState(null);

  const handleSignInSuccess = ({ step: next, tempToken: tok }) => {
    if (next === "done") onLoginSuccess?.();
    else if (next === "2fa") { setTempToken(tok); setStep("2fa"); }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* Left branding */}
        <BrandPanel />

        {/* Right form panel */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          padding: "48px 40px",
          overflowY: "auto",
          position: "relative",
        }}>
          {/* Subtle top-right decoration */}
          <div style={{
            position: "absolute", top: -60, right: -60, width: 220, height: 220,
            borderRadius: "50%", background: P.primaryLight, opacity: 0.6, pointerEvents: "none",
          }} />

          <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
            {step === "signin" && (
              <SignInStep onSuccess={handleSignInSuccess} onForgot={() => setStep("forgot")} />
            )}
            {step === "2fa" && (
              <TwoFAStep tempToken={tempToken} onSuccess={() => onLoginSuccess?.()} onBack={() => setStep("signin")} />
            )}
            {step === "forgot" && (
              <ForgotStep onBack={() => setStep("signin")} />
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: "#CBD5E1", marginTop: 36, fontWeight: 500 }}>
              Yalla Transit Admin · v2026
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

