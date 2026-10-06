import * as Shared from "../shared.js";
import Logo from "../Logo/Logo.jsx";
import ThemeSwitch from "../ThemeSwitch/ThemeSwitch.jsx";
const {
  useState,
  Activity,
  AlertCircle,
  ArrowRight,
  Fingerprint,
  Globe2,
  LoaderCircle,
  Shield,
  ShieldCheck,
  Target,
  UserRound,
  asJSON,
  api,
} = Shared;

function Login({ onLogin, theme, onToggleTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await api("/auth/login", {
        method: "POST",
        body: asJSON({ username, password }),
      });
      onLogin(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <ThemeSwitch
        theme={theme}
        onToggle={onToggleTheme}
        className="login-theme-switch"
      />
      <div className="login-glow" />
      <section className="login-visual">
        <Logo />
        <div className="login-visual-copy">
          <div className="eyebrow">
            <span className="pulse-dot" /> INVESTIGATION INTELLIGENCE
          </div>
          <h1>
            See the signal.
            <br />
            <span>Connect the cases.</span>
          </h1>
          <p>
            One secure workspace for cybercrime casework, operational context
            and AI-assisted leads.
          </p>
          <div className="login-art">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="orbit orbit-three" />
            <div className="core-shield">
              <ShieldCheck size={38} />
            </div>
            <span className="orbit-node n1">
              <Fingerprint size={15} />
            </span>
            <span className="orbit-node n2">
              <Globe2 size={15} />
            </span>
            <span className="orbit-node n3">
              <Activity size={15} />
            </span>
            <span className="orbit-node n4">
              <Target size={15} />
            </span>
            <span className="art-label al1">CASE CORRELATION</span>
            <span className="art-label al2">LIVE INTELLIGENCE</span>
          </div>
        </div>
        <div className="login-footer">
          <span>SECURE INVESTIGATION ENVIRONMENT</span>
          <span>v1.0.0</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-card">
          <div className="mobile-login-brand">
            <Logo />
          </div>
          <div className="login-card-icon">
            <ShieldCheck size={22} />
          </div>
          <p className="eyebrow">AUTHORIZED PERSONNEL</p>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to your investigation workspace.</p>
          <form onSubmit={submit} className="login-form">
            <label>
              Username
              <div className="input-with-icon">
                <UserRound size={17} />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  placeholder="Your username"
                  required
                />
              </div>
            </label>
            <label>
              Password
              <div className="input-with-icon">
                <Fingerprint size={17} />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your password"
                  required
                />
              </div>
            </label>
            {error && (
              <div className="inline-error">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
            <button
              className="button button-primary button-block"
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <span>
                  Sign in securely <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>
          <div className="secure-note">
            <Shield size={14} /> Session protected · 8 hour timeout
          </div>
        </div>
        <p className="login-legal">
          Case information should be handled according to your organization’s
          data policies.
        </p>
      </section>
    </main>
  );
}

export default Login;
