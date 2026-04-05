"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";

const REMEMBERED_EMAIL_KEY = "betta_remembered_email";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const EyeOpen = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

  const EyeClosed = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    </svg>
  );

  return (
    <div style={S.page}>
      <form onSubmit={handleSubmit} style={S.form} data-testid="login-form">
        <h1 style={S.title}>SylaSlova Beta</h1>

        <label style={S.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            style={S.input}
            data-testid="login-email"
          />
        </label>

        <label style={S.label}>
          Password
          <div style={S.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              style={{ ...S.input, paddingRight: 44 }}
              data-testid="login-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={S.eyeBtn}
              data-testid="login-password-toggle"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeClosed /> : <EyeOpen />}
            </button>
          </div>
        </label>

        <label style={S.rememberRow}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            style={S.checkbox}
            data-testid="login-remember"
          />
          <span>Remember me</span>
        </label>

        {error && (
          <div style={S.error} data-testid="login-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ ...S.submit, opacity: loading ? 0.6 : 1 }}
          data-testid="login-submit"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#0a0e16",
    fontFamily: "Inter, system-ui, sans-serif",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: 360,
    padding: 32,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "#4f7df9",
    textAlign: "center" as const,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(240,242,245,0.6)",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#f0f2f5",
    fontSize: 14,
    outline: "none",
    width: "100%",
  },
  passwordWrap: {
    position: "relative" as const,
  },
  eyeBtn: {
    position: "absolute" as const,
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "rgba(240,242,245,0.4)",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
  },
  rememberRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "rgba(240,242,245,0.5)",
    cursor: "pointer",
  },
  checkbox: {
    width: 16,
    height: 16,
    accentColor: "#4f7df9",
    cursor: "pointer",
  },
  error: {
    padding: "8px 12px",
    borderRadius: 8,
    background: "rgba(200,40,40,0.15)",
    border: "1px solid rgba(200,40,40,0.3)",
    color: "rgba(255,140,120,0.9)",
    fontSize: 13,
  },
  submit: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    background: "#4f7df9",
    color: "white",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
};
