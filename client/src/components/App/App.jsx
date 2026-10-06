import * as Shared from "../shared.js";
import darkThemeUrl from "../../dark.css?url";
import lightThemeUrl from "../../light.css?url";
import Logo from "../Logo/Logo.jsx";
import ThemeSwitch from "../ThemeSwitch/ThemeSwitch.jsx";
import Login from "../Login/Login.jsx";
import Page from "../Page/Page.jsx";
import CaseDetail from "../CaseDetail/CaseDetail.jsx";
const {
  Fragment,
  useCallback,
  useEffect,
  useState,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LogOut,
  Menu,
  Shield,
  ShieldCheck,
  X,
  NAV,
  api,
} = Shared;

function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("Dashboard");
  const [caseFilters, setCaseFilters] = useState(null);
  const [detail, setDetail] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState(() =>
    localStorage.getItem("caseintel-theme") === "dark" ? "dark" : "light",
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("caseintel-theme", theme);
    let stylesheet = document.getElementById("caseintel-theme-stylesheet");
    if (!stylesheet) {
      stylesheet = document.createElement("link");
      stylesheet.id = "caseintel-theme-stylesheet";
      stylesheet.rel = "stylesheet";
      document.head.appendChild(stylesheet);
    }
    stylesheet.href = theme === "dark" ? darkThemeUrl : lightThemeUrl;
  }, [theme]);
  useEffect(() => {
    api("/auth/session")
      .then(setUser)
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    const handler = (event) => {
      const destination =
        typeof event.detail === "string" ? event.detail : event.detail?.page;
      setPage(destination);
      setCaseFilters(
        destination === "Cases" ? event.detail?.filters || null : null,
      );
      setDetail(null);
    };
    window.addEventListener("caseintel-nav", handler);
    return () => window.removeEventListener("caseintel-nav", handler);
  }, []);
  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);
  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
  async function logout() {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setDetail(null);
  }
  if (checking)
    return (
      <div className="boot-screen">
        <Logo />
        <LoaderCircle className="spin" />
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={setUser}
        theme={theme}
        onToggleTheme={(dark) => setTheme(dark ? "dark" : "light")}
      />
    );
  const current = detail ? "Case details" : page;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <Logo />
          <button
            onClick={() => setMobileOpen(false)}
            className="icon-button mobile-close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="workspace-switch">
          <span className="workspace-symbol">
            <Shield size={16} />
          </span>
          <span>
            <b>Investigation Unit</b>
            <small>CYBER CRIME CELL</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <nav className="side-nav">
          {NAV.map((item, index) => (
            <Fragment key={item.id}>
              {(index === 0 || item.section !== NAV[index - 1].section) && (
                <div className="nav-section">{item.section}</div>
              )}
              <button
                className={`nav-item ${page === item.id && !detail ? "active" : ""}`}
                onClick={() => {
                  setPage(item.id);
                  setCaseFilters(null);
                  setDetail(null);
                  setMobileOpen(false);
                }}
              >
                <item.icon size={17} strokeWidth={1.8} />
                <span>{item.id}</span>
                {item.badge && <span className="nav-ai">{item.badge}</span>}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-status">
            <span className="secure-icon">
              <ShieldCheck size={15} />
            </span>
            <span>
              <b>Secure workspace</b>
              <small>Encrypted session active</small>
            </span>
            <span className="status-light" />
          </div>
          <div className="user-mini">
            <div className="user-avatar">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <span>
              <b>{user.username}</b>
              <small>Investigator</small>
            </span>
            <button className="icon-button" title="Sign out" onClick={logout}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobileOpen && (
        <button
          className="mobile-scrim"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        />
      )}
      <main className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumb">
            <span>CaseIntel</span>
            <ChevronRight size={14} />
            <b>{current}</b>
          </div>
          <div className="topbar-actions">
            <div className="live-status">
              <span className="pulse-dot" /> SYSTEM OPERATIONAL
            </div>
            <ThemeSwitch
              theme={theme}
              onToggle={(dark) => setTheme(dark ? "dark" : "light")}
            />
            <button className="top-icon" title="Notifications">
              <Bell size={17} />
              <span />
            </button>
            <div className="top-divider" />
            <div className="top-user">
              <div className="user-avatar avatar-small">
                {user.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <b>{user.username}</b>
                <small>Investigator</small>
              </div>
            </div>
          </div>
        </header>
        <div className="content-scroll">
          <div className="content-wrap">
            {detail ? (
              <CaseDetail
                caseId={detail}
                onBack={() => setDetail(null)}
                onNotify={notify}
                onRefresh={refresh}
              />
            ) : (
              <Page
                page={page}
                refreshKey={refreshKey}
                caseFilters={caseFilters}
                onNavigate={(destination, filters = null) => {
                  setPage(destination);
                  setCaseFilters(destination === "Cases" ? filters : null);
                  setDetail(null);
                  setMobileOpen(false);
                }}
                onOpenCase={(id) => setDetail(id)}
                onNotify={notify}
                onRefresh={refresh}
              />
            )}
          </div>
          <footer className="page-footer">
            <span>
              CaseIntel <span className="footer-dot">·</span> AI-assisted
              intelligence for human-led investigations
            </span>
            <span>
              <Shield size={12} /> INTERNAL USE
            </span>
          </footer>
        </div>
      </main>
      {toast && (
        <div className="toast">
          <CheckCircle2 size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
