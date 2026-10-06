import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
const {
  useCallback,
  useEffect,
  useState,
  CheckCircle2,
  ClipboardList,
  Filter,
  LoaderCircle,
  Plus,
  Target,
  Trash2,
  Users,
  X,
  asJSON,
  COLORS,
  BASE_FIELDS,
  api,
} = Shared;

function InspectorsPage({ refreshKey, onNotify }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("All availability");
  const [specialization, setSpecialization] = useState("All specializations");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    specialization: "",
    availability: "Available",
  });
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () => api("/inspectors").then(setRows),
    [refreshKey],
  );
  useEffect(() => {
    load();
  }, [load]);
  const visible = (rows || []).filter(
    (r) =>
      (filter === "All availability" || r.availability === filter) &&
      (specialization === "All specializations" ||
        r.specialization === specialization),
  );
  async function add(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api("/inspectors", { method: "POST", body: asJSON(form) });
      setForm({ name: "", specialization: "", availability: "Available" });
      setShowForm(false);
      await load();
      onNotify("Inspector added");
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(inspector) {
    setBusy(true);
    try {
      await api(`/inspectors/${inspector.id}`, { method: "DELETE" });
      await load();
      onNotify(`${inspector.name} removed from the roster`);
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        kicker="TEAM OPERATIONS"
        title="Inspector roster"
        subtitle="Manage investigator specialties, availability and assigned workload."
        action={
          <button
            className="button button-primary"
            onClick={() => setShowForm((value) => !value)}
          >
            <Plus size={16} /> Add inspector
          </button>
        }
      />
      <div className="inspector-summary">
        <div className="ins-summary-item">
          <span className="ins-summary-icon">
            <Users size={17} />
          </span>
          <div>
            <b>{rows?.length || 0}</b>
            <small>Team members</small>
          </div>
        </div>
        <div className="summary-divider" />
        <div className="ins-summary-item">
          <span className="ins-summary-icon ins-icon-teal">
            <CheckCircle2 size={17} />
          </span>
          <div>
            <b>
              {rows?.filter((r) => r.availability === "Available").length || 0}
            </b>
            <small>Available</small>
          </div>
        </div>
        <div className="summary-divider" />
        <div className="ins-summary-item">
          <span className="ins-summary-icon ins-icon-purple">
            <ClipboardList size={17} />
          </span>
          <div>
            <b>{rows?.reduce((sum, item) => sum + item.workload, 0) || 0}</b>
            <small>Assigned cases</small>
          </div>
        </div>
        <div className="summary-divider" />
        <div className="workload-capacity">
          <span>TEAM WORKLOAD</span>
          <div>
            <i
              style={{
                width: `${Math.min(100, ((rows?.reduce((sum, i) => sum + i.workload, 0) || 0) / Math.max((rows?.length || 1) * 8, 1)) * 100)}%`,
              }}
            />
          </div>
          <small>Case volume across active roster</small>
        </div>
      </div>
      <div className="case-toolbar inspector-filters">
        <div className="filter-group">
          <span>
            <Filter size={14} /> Filter roster
          </span>
          <select
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
          >
            <option>All specializations</option>
            {[...new Set((rows || []).map((item) => item.specialization))].map(
              (value) => (
                <option key={value}>{value}</option>
              ),
            )}
          </select>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option>All availability</option>
            <option>Available</option>
            <option>On leave</option>
            <option>Unavailable</option>
          </select>
        </div>
      </div>
      {showForm && (
        <form className="panel add-inspector-form" onSubmit={add}>
          <div className="panel-heading">
            <div>
              <h3>Add an inspector</h3>
              <p>Set a specialization to enable relevant AI recommendations.</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowForm(false)}
            >
              <X size={16} />
            </button>
          </div>
          <label className="field-label">
            Full name
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Inspector name"
              required
            />
          </label>
          <label className="field-label">
            Specialization
            <input
              className="form-control"
              value={form.specialization}
              onChange={(e) =>
                setForm({ ...form, specialization: e.target.value })
              }
              placeholder="e.g. Digital Forensics"
              required
            />
          </label>
          <label className="field-label">
            Availability
            <select
              className="form-control"
              value={form.availability}
              onChange={(e) =>
                setForm({ ...form, availability: e.target.value })
              }
            >
              <option>Available</option>
              <option>On leave</option>
              <option>Unavailable</option>
            </select>
          </label>
          <button className="button button-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <Plus size={15} />
            )}{" "}
            Save inspector
          </button>
        </form>
      )}
      {!rows ? (
        <Loading />
      ) : visible.length ? (
        <div className="inspector-grid">
          {visible.map((inspector, i) => (
            <div className="panel inspector-card" key={inspector.id}>
              <div className="inspector-card-top">
                <div
                  className="inspector-avatar"
                  style={{
                    background: `${COLORS[i % COLORS.length]}20`,
                    color: COLORS[i % COLORS.length],
                  }}
                >
                  {inspector.name
                    .split(/\s+/)
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
                <span
                  className={`availability-chip ${inspector.availability === "Available" ? "available" : "not-available"}`}
                >
                  <i />
                  {inspector.availability}
                </span>
                <button
                  className="icon-button"
                  type="button"
                  title={`Remove ${inspector.name}`}
                  aria-label={`Remove ${inspector.name}`}
                  disabled={busy}
                  onClick={() => remove(inspector)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <h3>{inspector.name}</h3>
              <p className="specialization-label">
                <Target size={13} /> {inspector.specialization}
              </p>
              <div className="inspector-load-row">
                <span>Current workload</span>
                <b>
                  {inspector.workload}
                  <small> cases</small>
                </b>
              </div>
              <div className="load-track">
                <i
                  style={{
                    width: `${Math.min(100, inspector.workload * 12.5)}%`,
                    background: COLORS[i % COLORS.length],
                  }}
                />
              </div>
              <div className="inspector-counts">
                {[
                  ["Critical", inspector.critical],
                  ["High", inspector.high],
                  ["Medium", inspector.medium],
                  ["Low", inspector.low],
                ].map(([label, count]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <b>{count || 0}</b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={Users}
            title="No inspectors match"
            detail={
              rows.length
                ? "Change the availability or specialty filter."
                : "Add investigators to enable assignment and workload recommendations."
            }
            action={
              !rows.length ? (
                <button
                  className="button button-secondary button-sm"
                  onClick={() => setShowForm(true)}
                >
                  Add first inspector <Plus size={14} />
                </button>
              ) : null
            }
          />
        </div>
      )}
    </>
  );
}

export default InspectorsPage;
