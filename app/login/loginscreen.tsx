import { useState } from "react";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState("");

  const handleLogin = () => {
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setError("");
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  const inputStyle = (name) => ({
    width: "100%",
    padding: "13px 14px",
    border: `1.5px solid ${focused === name ? "#ff6600" : "rgba(255,255,255,0.15)"}`,
    borderRadius: "10px",
    fontSize: "14px",
    color: "#fff",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
    background: "rgba(255,255,255,0.07)",
  });

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Left Panel */}
      <div style={{
        flex: 1,
        background: "linear-gradient(160deg, #ff6600 0%, #cc4400 60%, #0d1b3e 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position: "absolute", top: "-80px", left: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: "-60px", right: "-60px", width: "250px", height: "250px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", top: "40%", left: "60%", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />

        <div style={{ position: "relative", textAlign: "center", color: "#fff" }}>
          <div style={{
            width: "72px", height: "72px",
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.3)",
            borderRadius: "20px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontWeight: 900,
            fontFamily: "Georgia, serif",
            marginBottom: "28px",
          }}>SU</div>

          <h1 style={{ margin: "0 0 12px", fontSize: "32px", fontWeight: 800, lineHeight: 1.2 }}>
            Syracuse<br />University
          </h1>
          <p style={{ margin: 0, fontSize: "15px", opacity: 0.75, maxWidth: "240px", lineHeight: 1.6 }}>
            Your gateway to academics, resources, and campus life.
          </p>

          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
            {["Access course materials & grades", "Connect with faculty & staff", "Manage your student portal"].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", opacity: 0.85 }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: "460px",
        background: "#0d1b3e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 48px",
      }}>
        <div style={{ width: "100%", maxWidth: "340px" }}>
          <h2 style={{ margin: "0 0 6px", fontSize: "24px", fontWeight: 700, color: "#fff" }}>Welcome back</h2>
          <p style={{ margin: "0 0 32px", color: "#64748b", fontSize: "14px" }}>Sign in to your SU account</p>

          {/* Outlook */}
          <button style={{
            width: "100%", padding: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            fontSize: "14px", fontWeight: 600,
            color: "#fff", cursor: "pointer",
            marginBottom: "24px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
            transition: "border-color 0.2s, background 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#ff6600"; e.currentTarget.style.background = "rgba(255,102,0,0.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
          >
            <span style={{ fontSize: "18px" }}>🪟</span> Continue with Outlook
          </button>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
            <span style={{ color: "#475569", fontSize: "12px" }}>or sign in with email</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.25)",
              borderRadius: "10px", padding: "10px 14px", marginBottom: "16px",
              color: "#fca5a5", fontSize: "13px",
            }}>{error}</div>
          )}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>Email</label>
          <input
            type="email"
            placeholder="netid@syr.edu"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ ...inputStyle("email"), marginBottom: "16px" }}
            onFocus={() => setFocused("email")}
            onBlur={() => setFocused("")}
          />

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#94a3b8", marginBottom: "6px" }}>Password</label>
          <div style={{ position: "relative", marginBottom: "8px" }}>
            <input
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle("password"), paddingRight: "44px" }}
              onFocus={() => setFocused("password")}
              onBlur={() => setFocused("")}
            />
            <button onClick={() => setShowPass(!showPass)} style={{
              position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: "#475569",
              cursor: "pointer", fontSize: "16px", padding: 0,
            }}>{showPass ? "🙈" : "👁️"}</button>
          </div>

          <div style={{ textAlign: "right", marginBottom: "28px" }}>
            <a href="#" style={{ color: "#ff6600", fontSize: "13px", textDecoration: "none", fontWeight: 500 }}>Forgot password?</a>
          </div>

          <button onClick={handleLogin} style={{
            width: "100%", padding: "13px",
            background: loading ? "rgba(255,102,0,0.5)" : "#ff6600",
            border: "none", borderRadius: "10px",
            color: "#fff", fontSize: "15px", fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "background 0.2s",
            boxShadow: "0 4px 20px rgba(255,102,0,0.3)",
          }}
            onMouseEnter={e => { if (!loading) e.target.style.background = "#e55a00"; }}
            onMouseLeave={e => { if (!loading) e.target.style.background = "#ff6600"; }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p style={{ textAlign: "center", marginTop: "24px", color: "#475569", fontSize: "13px" }}>
            Don't have an account?{" "}
            <a href="#" style={{ color: "#ff6600", textDecoration: "none", fontWeight: 600 }}>Sign up</a>
          </p>
        </div>
      </div>
    </div>
  );
}
