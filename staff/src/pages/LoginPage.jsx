import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { C, inputStyle, btnPrimary } from "../styles/themes";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPwd,  setShowPwd]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/shift", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      {/* Decorative blobs */}
      <div style={{ position: "fixed", top: -100, right: -100, width: 400, height: 400, borderRadius: "50%", background: `radial-gradient(circle, rgba(37,99,235,.18) 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: -120, left: -80,  width: 350, height: 350, borderRadius: "50%", background: `radial-gradient(circle, rgba(37,99,235,.12) 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{
        width: "100%", maxWidth: 420,
        background: "#fff",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,.35)",
      }}>
        {/* Header band */}
        <div style={{
          background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`,
          padding: "32px 32px 28px",
          textAlign: "center",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: "rgba(255,255,255,.18)",
            border: "2px solid rgba(255,255,255,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Coins size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.3px" }}>
            Staff Portal
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "rgba(255,255,255,.8)" }}>
            Wallet Top-Up Module
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "28px 32px 32px" }}>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: C.textSecond, textAlign: "center" }}>
            Sign in with your staff credentials
          </p>

          {/* Error */}
          {error && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: C.dangerBg, border: `1px solid #FCA5A5`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
            }}>
              <AlertCircle size={16} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: "#B91C1C", lineHeight: 1.5 }}>{error}</span>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <Mail size={15} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="staff@example.com"
                autoComplete="email"
                style={{ ...inputStyle, paddingLeft: 38 }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={15} color={C.textMuted} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ ...inputStyle, paddingLeft: 38, paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 2 }}
              >
                {showPwd ? <EyeOff size={15} color={C.textMuted} /> : <Eye size={15} color={C.textMuted} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...btnPrimary,
              width: "100%",
              padding: "13px",
              fontSize: 15,
              opacity: loading ? 0.75 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <p style={{ margin: "20px 0 0", fontSize: 12, color: C.textMuted, textAlign: "center", lineHeight: 1.6 }}>
            This portal is restricted to authorised staff members only.<br />
            If you need access, contact your system administrator.
          </p>
        </form>
      </div>
    </div>
  );
}
