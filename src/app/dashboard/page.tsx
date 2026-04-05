"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Session {
  user: { id: string; displayName: string; baseRole: string; email: string };
  activeRoleMode: string;
}

interface Lesson {
  lessonId: string;
  title: Record<string, string>;
  supportedLangs: string[];
  sceneCount: number;
  stepCount: number;
  thumbnailPath: string | null;
}

const ROLE_OPTIONS: Record<string, string[]> = {
  owner: ["owner", "administrator", "revisioner", "teacher", "student"],
  administrator: ["administrator", "revisioner", "teacher", "student"],
  revisioner: ["revisioner", "teacher", "student"],
  teacher: ["teacher", "student"],
  student: ["student"],
};

const NAV_ITEMS: Record<string, string[]> = {
  owner: ["Lessons", "Review", "Admin"],
  administrator: ["Lessons", "Review", "Admin"],
  revisioner: ["Lessons"],
  teacher: ["Lessons"],
  student: ["Lessons"],
};

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Lessons");
  const [lang, setLang] = useState("en");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/session").then(r => r.ok ? r.json() : null),
      fetch("/api/lessons").then(r => r.ok ? r.json() : null),
    ]).then(([sess, lessonsData]) => {
      if (!sess || sess.error) { router.push("/login"); return; }
      setSession(sess);
      setLessons(lessonsData?.lessons || []);
    }).finally(() => setLoading(false));
  }, [router]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function switchRole(role: string) {
    await fetch("/api/auth/switch-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const sess = await fetch("/api/auth/session").then(r => r.json());
    setSession(sess);
    setRoleDropdownOpen(false);
  }

  function t(obj: Record<string, string> | undefined) {
    if (!obj) return "";
    return obj[lang] || obj.en || obj.ru || "";
  }

  if (loading) return <div style={S.page}><div style={S.loading}>Loading...</div></div>;
  if (!session) return null;

  const navItems = NAV_ITEMS[session.activeRoleMode] || ["Lessons"];
  const roleOptions = ROLE_OPTIONS[session.user.baseRole] || [];

  return (
    <div style={S.page}>
      {/* ═══ TOPBAR ═══ */}
      <header style={S.topbar}>
        <div style={S.topLeft}>
          <span style={S.logo}>SylaSlova</span>
          <nav style={S.nav}>
            {navItems.map(tab => (
              <button key={tab} style={activeTab === tab ? S.navActive : S.navBtn}
                onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </nav>
        </div>
        <div style={S.topRight}>
          {/* Lang */}
          <div style={S.langGroup}>
            {["en", "ru", "uk"].map(l => (
              <button key={l} style={lang === l ? S.langActive : S.langBtn}
                onClick={() => setLang(l)}>{l.toUpperCase()}</button>
            ))}
          </div>
          {/* Role Switcher */}
          <div style={S.roleWrap}>
            <button style={S.roleChip} onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              data-testid="role-switch">
              {session.activeRoleMode !== session.user.baseRole && (
                <span style={S.roleBaseHint}>{session.user.baseRole} →</span>
              )}
              <span style={S.roleActiveLabel}>{session.activeRoleMode}</span>
              <span style={S.roleArrow}>▾</span>
            </button>
            {roleDropdownOpen && (
              <div style={S.roleDropdown}>
                <div style={S.roleDropdownHeader}>
                  Switch view mode
                </div>
                {roleOptions.map(r => {
                  const isActive = r === session.activeRoleMode;
                  const isBase = r === session.user.baseRole;
                  return (
                    <button key={r} style={isActive ? S.roleOptionActive : S.roleOption}
                      onClick={() => switchRole(r)} data-testid={`role-option-${r}`}>
                      <span>{r}</span>
                      {isBase && <span style={S.roleBaseBadge}>base</span>}
                      {isActive && <span style={S.roleCheckmark}>✓</span>}
                    </button>
                  );
                })}
                {session.activeRoleMode !== session.user.baseRole && (
                  <div style={S.roleDropdownFooter}>
                    <button style={S.roleReturnBtn}
                      onClick={() => switchRole(session.user.baseRole)}
                      data-testid="role-return">
                      ↩ Return to {session.user.baseRole}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* User */}
          <span style={S.userName}>{session.user.displayName}</span>
          <button style={S.logoutBtn} onClick={handleLogout} data-testid="logout-btn">Logout</button>
        </div>
      </header>

      {/* ═══ ROLE BANNER (when impersonating) ═══ */}
      {session.activeRoleMode !== session.user.baseRole && (
        <div style={S.roleBanner} data-testid="role-banner">
          <span>Viewing as <strong>{session.activeRoleMode}</strong></span>
          <button style={S.roleBannerBtn}
            onClick={() => switchRole(session.user.baseRole)}>
            ↩ Back to {session.user.baseRole}
          </button>
        </div>
      )}

      {/* ═══ CONTENT ═══ */}
      {activeTab === "Lessons" && (
        <main style={S.main}>
          <h1 style={S.pageTitle}>Lessons</h1>
          <div style={S.grid}>
            {lessons.map(lesson => {
              const canEditLesson = ["owner", "administrator", "revisioner"].includes(session.activeRoleMode);
              return (
                <div key={lesson.lessonId} style={S.card} data-testid={`lesson-card-${lesson.lessonId}`}
                  onClick={() => router.push(`/lessons/${lesson.lessonId}`)}>
                  <div style={{
                    ...S.cardThumb,
                    backgroundImage: lesson.thumbnailPath ? `url(${lesson.thumbnailPath})` : undefined,
                  }}>
                    <span style={S.cardId}>{lesson.lessonId}</span>
                    {canEditLesson && <span style={S.cardEditBadge}>Edit</span>}
                  </div>
                  <div style={S.cardBody}>
                    <div style={S.cardTitle}>{t(lesson.title)}</div>
                    <div style={S.cardMeta}>
                      {lesson.sceneCount} scenes · {lesson.stepCount} steps
                    </div>
                    <div style={S.cardLangs}>
                      {lesson.supportedLangs.map(l => (
                        <span key={l} style={S.langTag}>{l.toUpperCase()}</span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {activeTab === "Review" && <ReviewPanel />}
      {activeTab === "Admin" && <AdminPanel session={session} />}
    </div>
  );
}

/* ═══════════ ADMIN PANEL ═══════════ */

function AdminPanel({ session }: { session: Session }) {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ email: "", displayName: "", password: "", role: "teacher" });
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then(d => setUsers(d.users || []));
  }, []);

  const creatableRoles: Record<string, string[]> = {
    owner: ["administrator", "revisioner", "teacher", "student"],
    administrator: ["revisioner", "teacher", "student"],
  };
  const roles = creatableRoles[session.activeRoleMode] || [];

  async function handleCreate() {
    setError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setUsers(prev => [...prev, data.user]);
    setShowCreate(false);
    setForm({ email: "", displayName: "", password: "", role: "teacher" });
  }

  const roleBg: Record<string, string> = {
    owner: "rgba(255,215,0,0.15)", administrator: "rgba(79,125,249,0.15)",
    revisioner: "rgba(0,200,150,0.15)", teacher: "rgba(255,165,0,0.15)",
    student: "rgba(200,200,200,0.1)",
  };
  const roleColor: Record<string, string> = {
    owner: "#ffd700", administrator: "#4f7df9",
    revisioner: "#00c896", teacher: "#ffa500", student: "#aaa",
  };

  return (
    <main style={S.main}>
      <div style={S.adminHeader}>
        <h1 style={S.pageTitle}>Users</h1>
        {roles.length > 0 && (
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>+ Create User</button>
        )}
      </div>

      {showCreate && (
        <div style={S.modal}>
          <div style={S.modalContent}>
            <h2 style={{ margin: 0, color: "#f0f2f5" }}>Create User</h2>
            <input style={S.input} placeholder="Email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} />
            <input style={S.input} placeholder="Display Name" value={form.displayName}
              onChange={e => setForm({ ...form, displayName: e.target.value })} />
            <input style={S.input} placeholder="Password" type="password" value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })} />
            <select style={S.input} value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value })}>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {error && <div style={S.errorMsg}>{error}</div>}
            <div style={S.modalActions}>
              <button style={S.ghostBtn} onClick={() => setShowCreate(false)}>Cancel</button>
              <button style={S.primaryBtn} onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.table}>
        <div style={S.tableHeader}>
          <span style={S.colName}>Name</span>
          <span style={S.colEmail}>Email</span>
          <span style={S.colRole}>Role</span>
          <span style={S.colStatus}>Status</span>
        </div>
        {users.map(u => (
          <div key={u.id} style={S.tableRow} data-testid={`user-row-${u.id}`}>
            <span style={S.colName}>{u.displayName}</span>
            <span style={{ ...S.colEmail, color: "rgba(240,242,245,0.5)" }}>{u.email}</span>
            <span style={S.colRole}>
              <span style={{ ...S.roleTag, background: roleBg[u.baseRole], color: roleColor[u.baseRole] }}>
                {u.baseRole}
              </span>
            </span>
            <span style={S.colStatus}>
              <span style={{ color: u.status === "active" ? "#4caf50" : "#888" }}>
                {u.status === "active" ? "●" : "○"} {u.status}
              </span>
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}

/* ═══════════ REVIEW PANEL ═══════════ */

function ReviewPanel() {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCandidates();
  }, [filterStatus]);

  async function loadCandidates() {
    const res = await fetch(`/api/candidates?status=${filterStatus}`);
    if (res.ok) {
      const data = await res.json();
      setCandidates(data.candidates || []);
    }
  }

  async function handleAction(candidateId: string, action: string, note?: string) {
    setActionLoading(candidateId);
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    if (res.ok) {
      await loadCandidates();
    }
    setActionLoading(null);
  }

  const statusFilters = ["pending", "accepted", "rejected", "withdrawn"];

  return (
    <main style={S.main}>
      <h1 style={S.pageTitle}>Review Revisions</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {statusFilters.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={filterStatus === s ? S.navActive : S.navBtn}
            data-testid={`review-filter-${s}`}>{s} </button>
        ))}
      </div>

      {candidates.length === 0 && (
        <div style={{ padding: 20, color: "rgba(240,242,245,0.3)", fontSize: 14 }}>
          No {filterStatus} revisions.
        </div>
      )}

      {candidates.map(c => (
        <div key={c.id} style={S2.reviewCard} data-testid={`review-card-${c.id}`}>
          <div style={S2.reviewHeader}>
            <div>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.field}</span>
              <span style={{ color: "rgba(240,242,245,0.4)", fontSize: 12, marginLeft: 8 }}>
                {c.candidateType} · Lesson {c.lessonId} · {c.sceneId || "—"}
              </span>
            </div>
            <span style={{
              padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: c.status === "pending" ? "rgba(255,165,0,0.15)" : c.status === "accepted" ? "rgba(46,125,50,0.15)" : c.status === "rejected" ? "rgba(200,40,40,0.15)" : "rgba(120,120,120,0.15)",
              color: c.status === "pending" ? "#ffa500" : c.status === "accepted" ? "#66bb6a" : c.status === "rejected" ? "#ef5350" : "#888",
            }} data-testid={`review-status-${c.id}`}>{c.status}</span>
          </div>

          <div style={{ fontSize: 12, color: "rgba(240,242,245,0.4)", marginBottom: 8 }}>
            By <strong>{c.author?.displayName || "Unknown"}</strong> · {new Date(c.createdAt).toLocaleString()}
            {c.languageCode && <span> · lang: {c.languageCode}</span>}
          </div>

          {c.originalValue && (
            <div style={S2.diffOld}>
              <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: "rgba(255,140,120,0.6)" }}>ORIGINAL</div>
              {c.originalValue}
            </div>
          )}
          <div style={S2.diffNew}>
            <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, color: "rgba(102,187,106,0.6)" }}>PROPOSED</div>
            {c.proposedValue}
          </div>

          {c.reviewNote && (
            <div style={{ fontSize: 12, color: "#ef5350", marginTop: 6, padding: "6px 10px", background: "rgba(200,40,40,0.1)", borderRadius: 8 }}>
              Review note: {c.reviewNote}
            </div>
          )}

          {c.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
              <button style={S2.approveBtn} disabled={actionLoading === c.id}
                onClick={() => handleAction(c.id, "approve")}
                data-testid={`approve-btn-${c.id}`}>
                {actionLoading === c.id ? "..." : "✓ Approve"}
              </button>
              <input style={S2.noteInput} placeholder="Rejection reason..."
                value={rejectNote[c.id] || ""}
                onChange={e => setRejectNote(prev => ({ ...prev, [c.id]: e.target.value }))}
                data-testid={`reject-note-${c.id}`} />
              <button style={S2.rejectBtn} disabled={actionLoading === c.id || !rejectNote[c.id]}
                onClick={() => handleAction(c.id, "reject", rejectNote[c.id])}
                data-testid={`reject-btn-${c.id}`}>
                {actionLoading === c.id ? "..." : "✗ Reject"}
              </button>
            </div>
          )}
        </div>
      ))}
    </main>
  );
}

const S2: Record<string, React.CSSProperties> = {
  reviewCard: { padding: 16, marginBottom: 12, borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" },
  reviewHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  diffOld: { padding: "8px 12px", borderRadius: 8, background: "rgba(200,60,40,0.1)", border: "1px solid rgba(200,60,40,0.2)", fontSize: 13, color: "rgba(255,160,140,0.8)", marginBottom: 6, textDecoration: "line-through" },
  diffNew: { padding: "8px 12px", borderRadius: 8, background: "rgba(46,125,50,0.1)", border: "1px solid rgba(46,125,50,0.2)", fontSize: 13, color: "rgba(140,220,140,0.9)" },
  approveBtn: { padding: "6px 14px", borderRadius: 8, border: "none", background: "rgba(46,125,50,0.8)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rejectBtn: { padding: "6px 14px", borderRadius: 8, border: "none", background: "rgba(200,40,40,0.8)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  noteInput: { flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#f0f2f5", fontSize: 12, outline: "none" },
};

/* ═══════════ STYLES ═══════════ */

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0a0e16", fontFamily: "Inter, system-ui, sans-serif", color: "#f0f2f5" },
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#667" },

  // Topbar
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 20px", height: 52, background: "rgba(15,20,30,0.9)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky" as const, top: 0, zIndex: 100 },
  topLeft: { display: "flex", alignItems: "center", gap: 20 },
  topRight: { display: "flex", alignItems: "center", gap: 12 },
  logo: { fontSize: 16, fontWeight: 800, color: "#4f7df9" },
  nav: { display: "flex", gap: 4 },
  navBtn: { padding: "6px 12px", borderRadius: 8, border: "none", background: "transparent", color: "rgba(240,242,245,0.5)", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  navActive: { padding: "6px 12px", borderRadius: 8, border: "none", background: "rgba(79,125,249,0.12)", color: "#4f7df9", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  langGroup: { display: "flex", gap: 2 },
  langBtn: { padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(240,242,245,0.4)", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  langActive: { padding: "4px 8px", borderRadius: 6, border: "1px solid #4f7df9", background: "#4f7df9", color: "white", fontSize: 11, fontWeight: 800, cursor: "pointer" },
  roleWrap: { position: "relative" as const },
  roleChip: { display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(79,125,249,0.3)", background: "rgba(79,125,249,0.08)", color: "#4f7df9", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  roleBaseHint: { fontSize: 10, color: "rgba(240,242,245,0.35)", fontWeight: 500 },
  roleActiveLabel: { fontWeight: 700 },
  roleArrow: { fontSize: 9, color: "rgba(240,242,245,0.3)" },
  roleDropdown: { position: "absolute" as const, top: "calc(100% + 6px)", right: 0, background: "rgba(16,22,36,0.98)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, overflow: "hidden", minWidth: 200, zIndex: 200, boxShadow: "0 12px 40px rgba(0,0,0,0.4)" },
  roleDropdownHeader: { padding: "8px 14px", fontSize: 10, fontWeight: 700, color: "rgba(240,242,245,0.3)", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)" },
  roleOption: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "#f0f2f5", fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left" as const },
  roleOptionActive: { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "9px 14px", border: "none", background: "rgba(79,125,249,0.12)", color: "#4f7df9", fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left" as const },
  roleBaseBadge: { fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "rgba(255,255,255,0.06)", color: "rgba(240,242,245,0.35)", fontWeight: 600 },
  roleCheckmark: { color: "#4f7df9", fontSize: 14, fontWeight: 700 },
  roleDropdownFooter: { padding: "6px 10px", borderTop: "1px solid rgba(255,255,255,0.06)" },
  roleReturnBtn: { display: "block", width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: "rgba(79,125,249,0.1)", color: "#4f7df9", fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" as const },
  userName: { fontSize: 12, color: "rgba(240,242,245,0.5)", fontWeight: 500 },
  logoutBtn: { padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(240,242,245,0.5)", fontSize: 11, fontWeight: 600, cursor: "pointer" },

  // Role banner
  roleBanner: { display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "8px 20px", background: "rgba(255,165,0,0.1)", borderBottom: "1px solid rgba(255,165,0,0.2)", fontSize: 13, color: "#ffa500" },
  roleBannerBtn: { padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,165,0,0.3)", background: "transparent", color: "#ffa500", fontSize: 12, fontWeight: 700, cursor: "pointer" },

  // Main
  main: { padding: "24px 20px", maxWidth: 1200, margin: "0 auto" },
  pageTitle: { margin: "0 0 20px", fontSize: 20, fontWeight: 700 },

  // Lesson Grid
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 },
  card: { borderRadius: 12, overflow: "hidden", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s" },
  cardThumb: { height: 140, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "#1a2030", position: "relative" as const },
  cardId: { position: "absolute" as const, top: 8, left: 8, padding: "2px 8px", borderRadius: 6, background: "rgba(0,0,0,0.6)", color: "white", fontSize: 12, fontWeight: 800 },
  cardEditBadge: { position: "absolute" as const, top: 8, right: 8, padding: "2px 8px", borderRadius: 6, background: "rgba(79,125,249,0.8)", color: "white", fontSize: 10, fontWeight: 700 },
  cardBody: { padding: "10px 12px" },
  cardTitle: { fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  cardMeta: { fontSize: 11, color: "rgba(240,242,245,0.4)", marginBottom: 6 },
  cardLangs: { display: "flex", gap: 4 },
  langTag: { padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: "rgba(240,242,245,0.4)" },

  // Admin
  adminHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  createBtn: { padding: "8px 16px", borderRadius: 8, border: "none", background: "#4f7df9", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" },
  table: { borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" },
  tableHeader: { display: "grid", gridTemplateColumns: "1fr 1.5fr 120px 100px", padding: "10px 16px", background: "rgba(255,255,255,0.04)", fontSize: 11, fontWeight: 700, color: "rgba(240,242,245,0.4)", textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1.5fr 120px 100px", padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 13, alignItems: "center" },
  colName: { fontWeight: 600 },
  colEmail: {},
  colRole: {},
  colStatus: {},
  roleTag: { padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 },

  // Modal
  modal: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 },
  modalContent: { background: "rgba(20,26,40,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 24, width: 380, display: "flex", flexDirection: "column" as const, gap: 12 },
  modalActions: { display: "flex", gap: 8, justifyContent: "flex-end" },
  input: { padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "#f0f2f5", fontSize: 14, outline: "none", width: "100%" },
  errorMsg: { padding: "6px 10px", borderRadius: 6, background: "rgba(200,40,40,0.15)", color: "rgba(255,140,120,0.9)", fontSize: 12 },
  ghostBtn: { padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#f0f2f5", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  primaryBtn: { padding: "8px 14px", borderRadius: 8, border: "none", background: "#4f7df9", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
