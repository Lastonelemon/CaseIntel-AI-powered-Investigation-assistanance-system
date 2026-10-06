import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
import Urgency from "../Urgency/Urgency.jsx";
const {
  useEffect,
  useState,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  GitFork,
  Globe2,
  LoaderCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  asJSON,
  shortDate,
  api,
} = Shared;

function CorrelationPage({
  refreshKey,
  onOpenCase,
  onNotify,
  onNavigate,
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState(null);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState(new Map());
  const [inspectors, setInspectors] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [inspectorId, setInspectorId] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: "25",
      sort: "updated",
      q: query.trim(),
    });
    Promise.all([
      api(`/cases?${params}`),
      api("/inspectors"),
      api("/correlations?limit=6"),
    ])
      .then(([caseData, inspectorData, runs]) => {
        if (!alive) return;
        setRows(caseData.rows);
        setPages(caseData.pages);
        setTotal(caseData.total);
        setInspectors(inspectorData);
        setHistory(runs);
      })
      .catch((error) => {
        if (alive) onNotify(error.message);
      });
    return () => {
      alive = false;
    };
  }, [page, query, refreshKey]);
  function toggle(item) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(item.id)) next.delete(item.id);
      else if (next.size < 15) next.set(item.id, item);
      return next;
    });
  }
  async function run() {
    if (selected.size < 3) return;
    setBusy(true);
    try {
      const result = await api("/correlations", {
        method: "POST",
        body: asJSON({ caseIds: [...selected.keys()] }),
      });
      setActiveRun(result);
      setInspectorId("");
      setHistory((current) =>
        [result, ...current.filter((item) => item.id !== result.id)].slice(
          0,
          6,
        ),
      );
      onNotify(`Correlation review completed for ${result.cases.length} cases`);
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function openRun(id) {
    setBusy(true);
    try {
      const result = await api(`/correlations/${id}`);
      setActiveRun(result);
      setInspectorId("");
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function assign() {
    if (!inspectorId || !activeRun?.cases?.length) return;
    setBusy(true);
    try {
      const result = await api("/cases/bulk-assign", {
        method: "POST",
        body: asJSON({
          caseIds: activeRun.cases.map((item) => item.id),
          inspectorId: Number(inspectorId),
        }),
      });
      setActiveRun((current) =>
        current
          ? {
              ...current,
              cases: current.cases.map((item) => ({
                ...item,
                assigned_inspector_id: Number(inspectorId),
              })),
            }
          : current,
      );
      onNotify(`${result.assigned} cases assigned to ${result.inspector.name}`);
      onRefresh();
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  const selectedLabel = (item) => item.external_id || item.case_key;
  return (
    <>
      <PageHead
        kicker="CROSS-CASE INTELLIGENCE"
        title="Case correlation"
        subtitle="Review up to 15 records together, surface evidence-backed patterns, then assign the group to an inspector."
        action={
          <span className="ai-mode-badge">
            <GitFork size={14} /> 3–15 CASES PER REVIEW
          </span>
        }
      />
      <div className="ai-disclaimer correlation-disclaimer">
        <ShieldCheck size={17} />
        <span>
          <b>Investigative leads only.</b> Similarities are not proof that cases
          share an author or cause. Verify every pattern against source records.
        </span>
      </div>
      <div className="correlation-layout">
        <section className="panel correlation-selector">
          <div className="panel-heading">
            <div>
              <h3>
                <ClipboardList size={16} /> Choose cases
              </h3>
              <p>
                Select at least 3 and up to 15 for a single cross-case review.
              </p>
            </div>
            <span
              className={`selection-count ${selected.size >= 3 ? "selection-ready" : ""}`}
            >
              {selected.size}
              <small> / 15</small>
            </span>
          </div>
          <label className="search-box correlation-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search case ID, summary, category or location…"
            />
            <kbd>⌘ K</kbd>
          </label>
          {!rows ? (
            <Loading />
          ) : rows.length ? (
            <>
              <div className="correlation-case-list">
                {rows.map((item) => {
                  const checked = selected.has(item.id);
                  const blocked = selected.size >= 15 && !checked;
                  return (
                    <label
                      className={`correlation-case-row ${checked ? "correlation-case-selected" : ""} ${blocked ? "correlation-case-blocked" : ""}`}
                      key={item.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={() => toggle(item)}
                      />
                      <span className="correlation-case-copy">
                        <b>
                          {selectedLabel(item)}{" "}
                          <small>· {item.category || "Unclassified"}</small>
                        </b>
                        <span>
                          {item.summary || "No summary in source data"}
                        </span>
                        <small>
                          {item.location || "Location not present"} <i>·</i>{" "}
                          {shortDate(item.reported_at)}
                        </small>
                      </span>
                      <Urgency value={item.urgency} />
                    </label>
                  );
                })}
              </div>
              <div className="correlation-list-footer">
                <span>
                  {total.toLocaleString()} cases · page {page} of {pages}
                </span>
                <div>
                  <button
                    className="icon-button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="icon-button"
                    disabled={page >= pages}
                    onClick={() => setPage((value) => value + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <Empty
              icon={Search}
              title="No cases found"
              detail="Import a dataset in Settings or adjust your search."
              action={
                <button
                  className="button button-secondary button-sm"
                  onClick={() => onNavigate("Settings")}
                >
                  Open data settings <ArrowRight size={13} />
                </button>
              }
            />
          )}
          <div className="correlation-selection-foot">
            <span>
              {selected.size < 3
                ? `Select ${3 - selected.size} more case${selected.size === 2 ? "" : "s"} to start.`
                : `${selected.size} cases ready for review.`}
            </span>
            <button
              className="button button-primary"
              disabled={busy || selected.size < 3}
              onClick={run}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <GitFork size={15} />
              )}{" "}
              Run correlation
            </button>
          </div>
        </section>
        <aside className="correlation-aside">
          {activeRun ? (
            <section className="panel correlation-result">
              <div className="panel-heading">
                <div>
                  <h3>
                    <Sparkles size={16} /> Correlation review #{activeRun.id}
                  </h3>
                  <p>
                    {shortDate(activeRun.created_at)} ·{" "}
                    {activeRun.cases?.length || 0} selected cases
                  </p>
                </div>
                <span className="confidence-pill">
                  {Math.round((activeRun.result?.confidence || 0) * 100)}%
                  confidence
                </span>
              </div>
              <p className="correlation-summary">{activeRun.result?.summary}</p>
              <div className="correlation-meta-grid">
                <div>
                  <span>SHARED THEME</span>
                  <b>
                    {activeRun.result?.urgency_theme ||
                      "No urgency theme identified"}
                  </b>
                </div>
                <div>
                  <span>RECOMMENDED SPECIALTY</span>
                  <b>
                    {activeRun.result?.recommended_inspector_type ||
                      "General Cybercrime"}
                  </b>
                </div>
              </div>
              <div className="correlation-cases-row">
                <span>REVIEWED CASES</span>
                {activeRun.cases?.map((item) => (
                  <button
                    key={item.id}
                    className="case-id-chip"
                    onClick={() => onOpenCase(item.id)}
                  >
                    {selectedLabel(item)} <ArrowUpRight size={11} />
                  </button>
                ))}
              </div>
              <div className="correlation-groups">
                <div className="correlation-section-heading">
                  <h4>Potential shared patterns</h4>
                  <span>{activeRun.result?.groups?.length || 0} found</span>
                </div>
                {activeRun.result?.groups?.length ? (
                  activeRun.result.groups.map((group, index) => (
                    <article
                      className="correlation-group"
                      key={`${group.pattern}-${index}`}
                    >
                      <div className="group-title-row">
                        <h4>{group.pattern}</h4>
                        <span>
                          {Math.round((group.confidence || 0) * 100)}%
                        </span>
                      </div>
                      <p>{group.explanation}</p>
                      <div className="group-evidence">
                        <span>
                          <GitFork size={12} /> {group.case_ids.length} linked
                          cases
                        </span>
                        {group.common_locations?.length > 0 && (
                          <span>
                            <Globe2 size={12} />{" "}
                            {group.common_locations.join(", ")}
                          </span>
                        )}
                      </div>
                      <div className="correlation-group-cases">
                        {activeRun.cases
                          ?.filter((item) =>
                            group.case_ids.includes(item.case_key),
                          )
                          .map((item) => (
                            <button
                              key={item.id}
                              className="case-id-chip"
                              onClick={() => onOpenCase(item.id)}
                            >
                              {selectedLabel(item)} <ArrowUpRight size={11} />
                            </button>
                          ))}
                      </div>
                      {group.shared_keywords?.length > 0 && (
                        <div className="correlation-tags">
                          {group.shared_keywords.map((word) => (
                            <span key={word}>{word}</span>
                          ))}
                        </div>
                      )}
                      {group.shared_entities?.length > 0 && (
                        <div className="correlation-evidence-line">
                          <b>Shared entities</b>{" "}
                          {group.shared_entities.join(" · ")}
                        </div>
                      )}
                      {group.similar_modus_operandi && (
                        <div className="correlation-evidence-line">
                          <b>Method</b> {group.similar_modus_operandi}
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <div className="correlation-no-pattern">
                    <CheckCircle2 size={16} /> No well-supported shared pattern
                    found in this selection.
                  </div>
                )}
              </div>
              {activeRun.result?.recommended_actions?.length > 0 && (
                <div className="correlation-actions">
                  <h4>Suggested review steps</h4>
                  <ul>
                    {activeRun.result.recommended_actions.map(
                      (action, index) => (
                        <li key={`${action}-${index}`}>{action}</li>
                      ),
                    )}
                  </ul>
                </div>
              )}
              <div className="correlation-assignment">
                <div className="correlation-section-heading">
                  <div>
                    <h4>Assign reviewed cases</h4>
                    <p>
                      This action assigns all {activeRun.cases?.length || 0}{" "}
                      cases in this review.
                    </p>
                  </div>
                </div>
                {activeRun.result?.recommended_inspector && (
                  <div className="inspector-recommendation">
                    <span className="recommend-icon">
                      <UserRound size={15} />
                    </span>
                    <span>
                      <b>{activeRun.result.recommended_inspector.name}</b>
                      <small>
                        {activeRun.result.recommended_inspector.specialization}{" "}
                        · {activeRun.result.recommended_inspector.workload}{" "}
                        currently assigned
                      </small>
                    </span>
                    <button
                      className="button button-quiet button-sm"
                      onClick={() =>
                        setInspectorId(
                          String(activeRun.result.recommended_inspector.id),
                        )
                      }
                    >
                      Use suggestion
                    </button>
                  </div>
                )}
                {inspectors.length ? (
                  <div className="correlation-assign-controls">
                    <select
                      value={inspectorId}
                      onChange={(event) => setInspectorId(event.target.value)}
                    >
                      <option value="">Choose an inspector…</option>
                      {inspectors.map((item) => (
                        <option value={item.id} key={item.id}>
                          {item.name} · {item.specialization} · {item.workload}{" "}
                          assigned
                        </option>
                      ))}
                    </select>
                    <button
                      className="button button-primary"
                      disabled={!inspectorId || busy}
                      onClick={assign}
                    >
                      <UserRound size={14} /> Assign cases
                    </button>
                  </div>
                ) : (
                  <div className="correlation-no-inspectors">
                    <span>
                      Add an inspector to assign the correlated cases.
                    </span>
                    <button
                      className="button button-secondary button-sm"
                      onClick={() => onNavigate("Inspectors")}
                    >
                      Add inspector <ArrowRight size={13} />
                    </button>
                  </div>
                )}
              </div>
              <p className="correlation-run-foot">
                AI-generated leads · case assignment only changes after you
                choose an inspector and press Assign cases.
              </p>
            </section>
          ) : (
            <section className="panel correlation-empty">
              <div className="correlation-empty-art">
                <GitFork size={23} />
                <span>3+</span>
              </div>
              <div className="eyebrow">MULTI-CASE REVIEW</div>
              <h3>Look for the links between cases</h3>
              <p>
                Select three or more records to compare descriptions,
                categories, dates, locations and source fields in one review.
              </p>
              <div className="correlation-empty-steps">
                <span>
                  <i>01</i> Select cases
                </span>
                <span>
                  <i>02</i> Review shared evidence
                </span>
                <span>
                  <i>03</i> Assign an inspector
                </span>
              </div>
            </section>
          )}
          {history.length > 0 && (
            <section className="panel correlation-history">
              <div className="panel-heading">
                <div>
                  <h3>
                    <Clock3 size={15} /> Recent reviews
                  </h3>
                  <p>Saved correlation results</p>
                </div>
              </div>
              <div className="correlation-history-list">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className={`correlation-history-item ${activeRun?.id === item.id ? "history-active" : ""}`}
                    onClick={() => openRun(item.id)}
                  >
                    <span>
                      <b>Review #{item.id}</b>
                      <small>
                        {item.case_count ||
                          item.cases?.length ||
                          item.case_keys?.length}{" "}
                        cases · {shortDate(item.created_at)}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}

export default CorrelationPage;
