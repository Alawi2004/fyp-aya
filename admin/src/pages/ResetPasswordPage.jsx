import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; }
  @keyframes fadeSlideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .rp-input:focus { border-color: #2563EB !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(37,99,235,.12) !important; }
  .rp-btn:hover:not(:disabled) { background: #1D4ED8 !important; box-shadow: 0 6px 20px rgba(37,99,235,.35) !important; transform: translateY(-1px); }
  .rp-btn:active:not(:disabled) { transform: translateY(0) !important; }
  .rp-btn { transition: background .15s, box-shadow .15s, transform .1s; }
  .rp-card { animation: fadeSlideUp .35s ease both; }
`;

function Spinner() {
  return <div style={{ width:16, height:16, borderRadius:"50%", border:"2px solid rgba(255,255,255,.3)", borderTopColor:"#fff", animation:"spin .7s linear infinite", display:"inline-block" }} />;
}

function PasswordInput({ label, value, onChange, autoFocus, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#374151", marginBottom:6 }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input
          className="rp-input"
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "••••••••"}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          style={{
            width:"100%", padding:"11px 44px 11px 14px",
            border:"1.5px solid #E2E8F0", borderRadius:10,
            fontSize:14, color:"#1E293B", background:"#F8FAFC",
            outline:"none", transition:"border .15s, background .15s, box-shadow .15s",
          }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          tabIndex={-1}
          style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#94A3B8", lineHeight:0, padding:0 }}
        >
          {show
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );
}

function strengthLabel(p) {
  if (p.length === 0) return null;
  if (p.length < 8)   return { label: "Too short",  color: "#EF4444", pct: 20 };
  const score = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  if (score <= 1) return { label: "Weak",   color: "#F59E0B", pct: 40 };
  if (score === 2) return { label: "Fair",   color: "#F59E0B", pct: 60 };
  if (score === 3) return { label: "Good",   color: "#10B981", pct: 80 };
  return               { label: "Strong", color: "#10B981", pct: 100 };
}

export default function ResetPasswordPage({ token, onDone }) {
  const { resetPassword } = useAuth();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [busy,      setBusy]      = useState(false);
  const [err,       setErr]       = useState(null);
  const [done,      setDone]      = useState(false);

  const strength = strengthLabel(password);
  const mismatch = confirm && confirm !== password;
  const canSubmit = password.length >= 8 && password === confirm && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setErr(null);
    try {
      await resetPassword(token, password);
      setDone(true);
      // Clear token from URL without reload
      window.history.replaceState({}, "", window.location.pathname);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 60%, #F1F5F9 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div className="rp-card" style={{
          background: "#fff", borderRadius: 18,
          boxShadow: "0 8px 48px rgba(0,0,0,.10)",
          padding: "44px 48px", width: "100%", maxWidth: 420,
        }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:32 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:"#2563EB", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
                <path d="M8 6v6"/><path d="M16 6v6"/><path d="M2 12h20"/>
                <rect x="2" y="4" width="20" height="16" rx="3"/>
                <circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:"#0F172A" }}>Yalla Transit</div>
              <div style={{ fontSize:11, color:"#94A3B8", fontWeight:500 }}>Admin Portal</div>
            </div>
          </div>

          {done ? (
            /* Success state */
            <div style={{ textAlign:"center" }}>
              <div style={{
                width:64, height:64, borderRadius:"50%",
                background:"#ECFDF5", display:"flex",
                alignItems:"center", justifyContent:"center",
                margin:"0 auto 20px",
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h2 style={{ fontSize:22, fontWeight:800, color:"#0F172A", marginBottom:8 }}>Password updated!</h2>
              <p style={{ fontSize:14, color:"#64748B", lineHeight:1.6, marginBottom:28 }}>
                Your password has been reset successfully.<br />You can now sign in with your new password.
              </p>
              <button
                onClick={onDone}
                className="rp-btn"
                style={{
                  width:"100%", padding:12,
                  background:"#2563EB", color:"#fff",
                  border:"none", borderRadius:10,
                  fontSize:14, fontWeight:600, cursor:"pointer",
                }}
              >
                Go to sign in
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <div style={{
                width:48, height:48, borderRadius:12,
                background:"#EFF6FF", display:"flex",
                alignItems:"center", justifyContent:"center",
                marginBottom:20,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
                  <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
                </svg>
              </div>

              <h1 style={{ fontSize:24, fontWeight:800, color:"#0F172A", letterSpacing:"-.5px", marginBottom:6 }}>
                Set new password
              </h1>
              <p style={{ fontSize:14, color:"#64748B", marginBottom:28, lineHeight:1.6 }}>
                Choose a strong password with at least 8 characters.
              </p>

              {err && (
                <div style={{
                  background:"#FEF2F2", border:"1px solid #FECACA",
                  borderRadius:9, padding:"11px 14px",
                  fontSize:13, color:"#DC2626", marginBottom:20, lineHeight:1.5,
                }}>
                  {err}
                </div>
              )}

              <form onSubmit={submit}>
                <PasswordInput
                  label="New password"
                  value={password}
                  onChange={setPassword}
                  autoFocus
                  autoComplete="new-password"
                />

                {/* Strength bar */}
                {strength && (
                  <div style={{ marginTop:-10, marginBottom:18 }}>
                    <div style={{ height:4, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${strength.pct}%`, background:strength.color, borderRadius:99, transition:"width .3s, background .3s" }} />
                    </div>
                    <p style={{ fontSize:11, color:strength.color, fontWeight:600, marginTop:5 }}>{strength.label}</p>
                  </div>
                )}

                <PasswordInput
                  label="Confirm new password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                />

                {mismatch && (
                  <p style={{ fontSize:12, color:"#EF4444", marginTop:-10, marginBottom:16 }}>Passwords don't match</p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rp-btn"
                  style={{
                    width:"100%", padding:12, marginTop:4,
                    background: canSubmit ? "#2563EB" : "#93C5FD",
                    color:"#fff", border:"none", borderRadius:10,
                    fontSize:14, fontWeight:600,
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  }}
                >
                  {busy ? <><Spinner /> Resetting…</> : "Reset password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
