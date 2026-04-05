"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

const SAVED_ACCOUNTS_KEY = "betta_saved_accounts";

interface SavedAccount {
  email: string;
  password: string;
  displayName?: string;
  role?: string;
}

function getSavedAccounts(): SavedAccount[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || "[]");
  } catch { return []; }
}

function saveAccount(email: string, password: string, displayName?: string, role?: string) {
  const accounts = getSavedAccounts().filter(a => a.email !== email);
  accounts.unshift({ email, password, displayName, role });
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

const DEV_ACCOUNTS = [
  { email: "owner@sylaslova.com", password: "owner123", label: "Owner", role: "owner" },
  { email: "admin@sylaslova.com", password: "admin123", label: "Administrator", role: "administrator" },
  { email: "revisioner@sylaslova.com", password: "rev123", label: "Revisioner", role: "revisioner" },
  { email: "teacher1@sylaslova.com", password: "teach123", label: "Teacher", role: "teacher" },
  { email: "student1@sylaslova.com", password: "stud123", label: "Student", role: "student" },
];

const ROLE_COLORS: Record<string, string> = {
  owner: "#ffd700", administrator: "#4f7df9", revisioner: "#00c896", teacher: "#ffa500", student: "#aaa",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const router = useRouter();

  // Load saved accounts on mount
  useState(() => {
    setSavedAccounts(getSavedAccounts());
  });

  async function quickLogin(acc: typeof DEV_ACCOUNTS[0]) {
    setEmail(acc.email);
    setPassword(acc.password);
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: acc.email, password: acc.password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login failed"); return; }
      saveAccount(acc.email, acc.password, data.user?.displayName, data.user?.baseRole);
      router.push("/dashboard");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      saveAccount(email, password, data.user?.displayName, data.user?.baseRole);
      setSavedAccounts(getSavedAccounts());
      router.push("/dashboard");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.form} data-testid="login-form">
        <h1 style={styles.title}>SylaSlova Beta</h1>

        <label style={styles.label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            style={styles.input}
            data-testid="login-email"
          />
        </label>

        <label style={styles.label}>
          Password
          <div style={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...styles.input, paddingRight: 48 }}
              data-testid="login-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={styles.toggle}
              data-testid="login-password-toggle"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error && (
          <div style={styles.error} data-testid="login-error">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ ...styles.submit, opacity: loading ? 0.6 : 1 }}
          data-testid="login-submit"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  },
  passwordWrap: {
    position: "relative" as const,
  },
  toggle: {
    position: "absolute" as const,
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "rgba(240,242,245,0.5)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  devSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(240,242,245,0.3)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  devGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 6,
  },
  devBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#f0f2f5",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "background 0.15s",
  },
  devDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  devName: {},
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  dividerText: {
    fontSize: 11,
    color: "rgba(240,242,245,0.2)",
    whiteSpace: "nowrap" as const,
  },
  savedSection: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
  },
  savedLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(240,242,245,0.4)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
  },
  savedList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  savedBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#f0f2f5",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "left" as const,
  },
  savedName: {
    fontWeight: 600,
  },
  savedRole: {
    fontSize: 11,
    fontWeight: 700,
    color: "#4f7df9",
    padding: "2px 8px",
    borderRadius: 999,
    background: "rgba(79,125,249,0.15)",
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
