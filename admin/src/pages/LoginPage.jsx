import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

/* ── Global keyframes injected once ─────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .login-form-animate { animation: fadeSlideUp .35s ease both; }
  .login-input:focus  { border-color: #2563EB !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(37,99,235,.12) !important; }
  .login-btn:hover:not(:disabled)  { background: #1D4ED8 !important; box-shadow: 0 6px 20px rgba(37,99,235,.35) !important; transform: translateY(-1px); }
  .login-btn:active:not(:disabled) { transform: translateY(0) !important; }
  .login-btn { transition: background .15s, box-shadow .15s, transform .1s; }
  .otp-box:focus { border-color: #2563EB !important; background: #EFF6FF !important; box-shadow: 0 0 0 3px rgba(37,99,235,.12) !important; }
`;

/* ── Left branding panel ─────────────────────────────────────────────────── */
function BrandPanel() {
  return (
    <div style={{
      width: "44%",
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0F172A 0%, #1E3A8A 55%, #2563EB 100%)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      padding: "48px 52px",
      position: "relative",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "40%", right: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,.03)", pointerEvents: "none" }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: "rgba(255,255,255,.15)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
            <path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/>
            <rect x="2" y="4" width="20" height="16" rx="3"/>
            <circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>
          </svg>
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-.3px" }}>Yalla Transit</div>
          <div style={{ color: "rgba(255,255,255,.5)", fontSize: 11, fontWeight: 500 }}>Admin Portal</div>
        </div>
      </div>

      {/* Main copy */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,255,255,.1)", borderRadius: 20,
          padding: "5px 14px", marginBottom: 24,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
          <span style={{ color: "rgba(255,255,255,.85)", fontSize: 12, fontWeight: 600 }}>System Online</span>
        </div>

        <h1 style={{
          color: "#fff", fontSize: 36, fontWeight: 800,
          lineHeight: 1.15, letterSpacing: "-.6px", marginBottom: 16,
        }}>
          Yalla Transit<br />Management
        </h1>
        <p style={{ color: "rgba(255,255,255,.6)", fontSize: 15, lineHeight: 1.65, maxWidth: 320, marginBottom: 40 }}>
          Monitor your fleet, manage drivers, and track passengers — all in one place.
        </p>

        {/* Feature list */}
        {[
          { icon: "📍", text: "Real-time GPS fleet tracking" },
          { icon: "👁",  text: "AI driver monitoring & alerts" },
          { icon: "🎫", text: "Passenger ticketing & wallets" },
        ].map(({ icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "rgba(255,255,255,.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, flexShrink: 0,
            }}>{icon}</div>
            <span style={{ color: "rgba(255,255,255,.75)", fontSize: 14, fontWeight: 500 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <p style={{ color: "rgba(255,255,255,.3)", fontSize: 12, position: "relative", zIndex: 1 }}>
        © 2026 Yalla Transit · Secure Admin Access
      </p>
    </div>
  );
}

/* ── Spinner ─────────────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div style={{
      width: 16, height: 16, borderRadius: "50%",
      border: "2px solid rgba(255,255,255,.3)",
      borderTopColor: "#fff",
      animation: "spin .7s linear infinite",
      display: "inline-block",
    }} />
  );
}

/* ── Shared input ────────────────────────────────────────────────────────── */
function Input({ label, type = "text", value, onChange, placeholder, autoFocus, autoComplete, suffix }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          className="login-input"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            padding: suffix ? "11px 44px 11px 14px" : "11px 14px",
            border: "1.5px solid #E2E8F0",
            borderRadius: 10,
            fontSize: 14,
            color: "#1E293B",
            background: "#F8FAFC",
            outline: "none",
            transition: "border .15s, background .15s, box-shadow .15s",
            boxSizing: "border-box",
          }}
        />
        {suffix && (
          <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
            {suffix}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Password field with eye toggle ─────────────────────────────────────── */
function PasswordInput({ label, value, onChange, autoFocus, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <Input
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={onChange}
      placeholder="••••••••"
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      suffix={
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94A3B8", lineHeight: 0 }}
          tabIndex={-1}
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

/* ── Primary button ──────────────────────────────────────────────────────── */
function PrimaryBtn({ children, loading, disabled, onClick, type = "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className="login-btn"
      style={{
        width: "100%",
        padding: "12px",
        background: disabled || loading ? "#93C5FD" : "#2563EB",
        color: "#fff",
        border: "none",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        marginTop: 4,
      }}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

/* ── Ghost button ────────────────────────────────────────────────────────── */
function GhostBtn({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "11px",
        background: "none",
        border: "1.5px solid #E2E8F0",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        color: "#374151",
        cursor: "pointer",
        marginTop: 10,
        transition: "border-color .15s, background .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#CBD5E1"; e.currentTarget.style.background = "#F8FAFC"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "none"; }}
    >
      {children}
    </button>
  );
}

/* ── Alert box ───────────────────────────────────────────────────────────── */
function Alert({ type = "error", children }) {
  const styles = {
    error:   { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626" },
    success: { bg: "#ECFDF5", border: "#A7F3D0", color: "#059669" },
    info:    { bg: "#EFF6FF", border: "#BFDBFE", color: "#2563EB" },
  }[type];
  return (
    <div style={{
      background: styles.bg,
      border: `1px solid ${styles.border}`,
      borderRadius: 9,
      padding: "11px 14px",
      fontSize: 13,
      color: styles.color,
      marginBottom: 20,
      lineHeight: 1.5,
    }}>
      {children}
    </div>
  );
}

/* ── Individual OTP boxes ────────────────────────────────────────────────── */
function OTPInput({ value, onChange }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");

  const update = (newDigits) => onChange(newDigits.join(""));

  const handleChange = (i, v) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    update(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        const next = [...digits]; next[i] = ""; update(next);
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || "");
    update(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
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
            flex: 1, height: 58,
            textAlign: "center",
            fontSize: 24, fontWeight: 700,
            border: `2px solid ${d ? "#2563EB" : "#E2E8F0"}`,
            borderRadius: 10,
            background: d ? "#EFF6FF" : "#F8FAFC",
            outline: "none",
            color: "#1E293B",
            transition: "border .15s, background .15s, box-shadow .15s",
          }}
        />
      ))}
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
      background: "#FFF7ED", border: "1px solid #FED7AA",
      borderRadius: 10, padding: "14px 16px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#C2410C" }}>Account temporarily locked</span>
      </div>
      <p style={{ fontSize: 12, color: "#9A3412", lineHeight: 1.5, marginBottom: 8 }}>
        Too many failed attempts. Try again in:
      </p>
      <div style={{
        fontFamily: "monospace", fontSize: 28, fontWeight: 800,
        color: "#EA580C", letterSpacing: 2,
      }}>
        {m}:{s}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Step 1 — Sign in
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
      // 429 lockout — the error message contains retry info from the API
      if (ex.retry_after_seconds) {
        setLockoutSecs(ex.retry_after_seconds);
      } else {
        setErr(ex.message);
      }
    }
  };

  return (
    <form onSubmit={submit} className="login-form-animate">
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0F172A", letterSpacing: "-.5px", marginBottom: 6 }}>
        Welcome back
      </h1>
      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 30 }}>
        Sign in to your admin account to continue.
      </p>

      {lockoutSecs !== null
        ? <LockoutBanner retryAfterSeconds={lockoutSecs} onUnlocked={() => setLockoutSecs(null)} />
        : err && <Alert type="error">{err}</Alert>
      }

      <Input
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoFocus
        autoComplete="email"
      />
      <PasswordInput
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: -10, marginBottom: 22 }}>
        <button
          type="button"
          onClick={onForgot}
          style={{ background: "none", border: "none", color: "#2563EB", fontSize: 13, fontWeight: 500, cursor: "pointer", padding: 0 }}
        >
          Forgot password?
        </button>
      </div>

      <PrimaryBtn loading={loading} disabled={!email || !password}>
        {loading ? "Signing in…" : "Sign in"}
      </PrimaryBtn>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Step 2 — Two-Factor Authentication
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
    <form onSubmit={submit} className="login-form-animate">
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "#EFF6FF", display: "flex", alignItems: "center",
        justifyContent: "center", marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
          <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-.5px", marginBottom: 6 }}>
        Two-factor auth
      </h1>
      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 28 }}>
        Enter the 6-digit code from your authenticator app.
      </p>

      {err && <Alert type="error">{err}</Alert>}

      <OTPInput value={code} onChange={setCode} />

      <PrimaryBtn loading={loading} disabled={code.length !== 6}>
        {loading ? "Verifying…" : "Verify"}
      </PrimaryBtn>
      <GhostBtn onClick={onBack}>← Back to sign in</GhostBtn>
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
    setBusy(true);
    setErr(null);
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
    <div className="login-form-animate">
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: "#EFF6FF", display: "flex", alignItems: "center",
        justifyContent: "center", marginBottom: 20,
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#0F172A", letterSpacing: "-.5px", marginBottom: 6 }}>
        Reset your password
      </h1>
      <p style={{ fontSize: 14, color: "#64748B", marginBottom: 28 }}>
        Enter your admin email and we'll send a reset link valid for 1 hour.
      </p>

      {err  && <Alert type="error">{err}</Alert>}

      {sent ? (
        <Alert type="success">
          Check your inbox — a reset link has been sent to <strong>{email}</strong>.<br />
          The link expires in 1 hour.
        </Alert>
      ) : (
        <form onSubmit={submit}>
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoFocus
          />
          <PrimaryBtn loading={busy} disabled={!email}>
            {busy ? "Sending…" : "Send reset link"}
          </PrimaryBtn>
        </form>
      )}

      <GhostBtn onClick={onBack}>← Back to sign in</GhostBtn>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Main LoginPage
══════════════════════════════════════════════════════════════════════════ */
export default function LoginPage({ onLoginSuccess }) {
  const [step,      setStep]      = useState("signin");
  const [tempToken, setTempToken] = useState(null);

  const handleSignInSuccess = ({ step: next, tempToken: tok }) => {
    if (next === "done") {
      onLoginSuccess?.();
    } else if (next === "2fa") {
      setTempToken(tok);
      setStep("2fa");
    }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>

        {/* Left branding panel (hidden on narrow viewports via CSS would need media query — using a min-width check) */}
        <BrandPanel />

        {/* Right form panel */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          padding: "48px 32px",
          overflowY: "auto",
        }}>
          <div style={{ width: "100%", maxWidth: 400 }}>

            {step === "signin" && (
              <SignInStep
                onSuccess={handleSignInSuccess}
                onForgot={() => setStep("forgot")}
              />
            )}
            {step === "2fa" && (
              <TwoFAStep
                tempToken={tempToken}
                onSuccess={() => onLoginSuccess?.()}
                onBack={() => setStep("signin")}
              />
            )}
            {step === "forgot" && (
              <ForgotStep onBack={() => setStep("signin")} />
            )}

            <p style={{ textAlign: "center", fontSize: 12, color: "#CBD5E1", marginTop: 36 }}>
              Yalla Transit Admin · Secure access only
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
