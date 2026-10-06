import * as Shared from "../shared.js";
import Loading from "../Loading/Loading.jsx";
import Urgency from "../Urgency/Urgency.jsx";
import Status from "../Status/Status.jsx";
const {
  useCallback,
  useEffect,
  useState,
  ArrowLeft,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
  UserRound,
  Users,
  asJSON,
  labelize,
  shortDate,
  urgencyClass,
  api,
} = Shared;

function CaseDetail({ caseId, onBack, onNotify, onRefresh }) {
  const [item, setItem] = useState(null);
  const [inspectors, setInspectors] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(
    () =>
      Promise.all([api(`/cases/${caseId}`), api("/inspectors")])
        .then(([record, team]) => {
          setItem(record);
          setInspectors(team);
        })
        .catch(() => setItem(null)),
    [caseId],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function analyze() {
    setBusy(true);
    try {
      await api(`/cases/${caseId}/analyze`, { method: "POST", body: "{}" });
      onNotify("AI analysis complete");
      await load();
      onRefresh();
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function assign(event) {
    const id = event.target.value || null;
    try {
      await api(`/cases/${caseId}/assign`, {
        method: "POST",
        body: asJSON({ inspectorId: id }),
      });
      onNotify(id ? "Inspector assigned" : "Assignment cleared");
      await load();
      onRefresh();
    } catch (error) {
      onNotify(error.message);
    }
  }
  async function changeStatus(event) {
    try {
      await api(`/cases/${caseId}/status`, {
        method: "PATCH",
        body: asJSON({ status: event.target.value }),
      });
      await load();
      onRefresh();
    } catch (error) {
      onNotify(error.message);
    }
  }
  if (!item)
    return (
      <>
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={15} /> Back to cases
        </button>
        <Loading />
      </>
    );
  const ai = item.ai;
  return (
    <>
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} /> Back to cases
      </button>
      <div className="case-detail-head">
        <div>
          <div className="eyebrow">
            INVESTIGATION FILE <span className="tiny-dot" /> {item.case_key}
          </div>
          <h1>{item.external_id || item.case_key}</h1>
          <p>
            {item.summary ||
              "Original complaint details are available in the source fields below."}
          </p>
          <div className="detail-tags">
            <Urgency value={item.urgency} />
            <Status value={item.status} />
            <span className="detail-date">
              <CalendarDays size={13} /> Reported {shortDate(item.reported_at)}
            </span>
          </div>
        </div>
        <button
          className="button button-secondary"
          onClick={() => window.print()}
        >
          <Download size={15} /> Print case
        </button>
      </div>
      <div className="detail-grid">
        <div className="detail-main-col">
          <section className="panel detail-panel">
            <div className="panel-heading">
              <div>
                <h3>Case information</h3>
                <p>Source dataset values, preserved as received</p>
              </div>
              <span className="panel-heading-icon">
                <FileText size={15} />
              </span>
            </div>
            <div className="field-grid">
              {[
                ["Case reference", item.external_id || item.case_key],
                ["Category", item.category || "Not mapped"],
                ["Date reported", item.reported_at || "Not present in source"],
                ["Location", item.location || "Not present in source"],
                ["Case status", labelize(item.status)],
                ["Updated", shortDate(item.updated_at)],
              ].map(([label, value]) => (
                <div className="detail-field" key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
            <div className="source-fields">
              <div className="subsection-heading">
                <b>Original source fields</b>
                <span>{Object.keys(item.source_data).length} fields</span>
              </div>
              <div className="source-field-list">
                {Object.entries(item.source_data).map(([key, value]) => (
                  <div key={key}>
                    <span>{labelize(key)}</span>
                    <p>
                      {value == null || value === "" ? (
                        <em>Not provided</em>
                      ) : (
                        String(value)
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <section className="panel detail-panel ai-detail-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Sparkles size={16} /> AI analysis
                </h3>
                <p>
                  Investigator decision support · Not an authoritative
                  determination
                </p>
              </div>
              {ai && <Urgency value={ai.urgency} />}
            </div>
            {ai ? (
              <>
                <div className="ai-analysis-top">
                  <div className="ai-score">
                    <div
                      className={`score-ring score-${urgencyClass(ai.urgency)}`}
                    >
                      <b>{ai.urgency_score}</b>
                      <span>/ 100</span>
                    </div>
                    <div>
                      <span className="mini-label">URGENCY SCORE</span>
                      <p>
                        Recommendation from the available complaint evidence
                      </p>
                    </div>
                  </div>
                  <div className="confidence-box">
                    <span>MODEL CONFIDENCE</span>
                    <b>
                      {Math.round((ai.confidence || 0) * 100)}
                      <small>%</small>
                    </b>
                  </div>
                </div>
                <div className="ai-reasoning">
                  <span className="mini-label">REASONING</span>
                  <p>{ai.reasoning}</p>
                </div>
                <div className="analysis-category-row">
                  <div>
                    <span className="mini-label">AI CLASSIFICATION</span>
                    <b>
                      {ai.case_category}
                      {ai.sub_category ? (
                        <small> / {ai.sub_category}</small>
                      ) : null}
                    </b>
                  </div>
                  <div>
                    <span className="mini-label">INSPECTOR TYPE</span>
                    <b>{ai.recommended_inspector_type}</b>
                  </div>
                </div>
                {ai.recommended_actions?.length > 0 && (
                  <div className="recommended-actions">
                    <span className="mini-label">SUGGESTED NEXT STEPS</span>
                    {ai.recommended_actions.map((action, i) => (
                      <div key={i}>
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <p>{action}</p>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  className="button button-quiet button-sm retry-button"
                  onClick={analyze}
                  disabled={busy}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <RefreshCw size={14} />
                  )}{" "}
                  Run analysis again
                </button>
              </>
            ) : (
              <div className="analysis-empty">
                <div className="empty-icon">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <b>
                    {item.ai_status === "ERROR"
                      ? "Analysis needs a retry"
                      : "No AI analysis yet"}
                  </b>
                  <p>
                    {item.ai_error ||
                      "Run a Gemini analysis to classify urgency and find potential patterns."}
                  </p>
                </div>
                <button
                  className="button button-primary button-sm"
                  disabled={busy}
                  onClick={analyze}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : (
                    <Sparkles size={14} />
                  )}{" "}
                  Analyze case
                </button>
              </div>
            )}
          </section>
          <section className="panel detail-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Target size={16} /> Potentially related cases
                </h3>
                <p>AI-generated investigative leads · Verify before linking</p>
              </div>
            </div>
            {ai?.potential_related_cases?.length ? (
              <div className="related-list">
                {ai.potential_related_cases.map((related) => (
                  <div className="related-card" key={related.case_id}>
                    <div className="related-card-top">
                      <span className="related-id">{related.case_id}</span>
                      <ArrowUpRight size={14} />
                    </div>
                    <p>{related.relevance_explanation}</p>
                    <div className="related-tags">
                      {related.shared_keywords?.slice(0, 4).map((word) => (
                        <span key={word}>{word}</span>
                      ))}
                    </div>
                    <small>Potential lead · Not a confirmed relationship</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="subtle-empty">
                <Target size={16} />
                <span>
                  {ai
                    ? "No strong match found among available candidate cases."
                    : "Run analysis to identify potential overlaps."}
                </span>
              </div>
            )}
          </section>
        </div>
        <aside className="detail-side-col">
          <section className="panel inspector-detail-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Users size={16} /> Inspector
                </h3>
                <p>Assignment requires investigator review</p>
              </div>
            </div>
            {ai?.recommended_inspector && !item.assigned_inspector_id && (
              <div className="recommend-card">
                <div className="recommend-label">
                  <Sparkles size={13} /> RECOMMENDED INSPECTOR
                </div>
                <b>{ai.recommended_inspector.name}</b>
                <span>{ai.recommended_inspector.specialization}</span>
                <p>{ai.recommended_inspector.reason}</p>
              </div>
            )}
            <label className="field-label">
              Assigned inspector
              <select
                className="form-control"
                value={item.assigned_inspector_id || ""}
                onChange={assign}
              >
                <option value="">Unassigned</option>
                {inspectors.map((inspector) => (
                  <option key={inspector.id} value={inspector.id}>
                    {inspector.name} · {inspector.workload} cases
                  </option>
                ))}
              </select>
            </label>
            {!inspectors.length && (
              <p className="micro-hint">
                Add inspectors under the Inspectors page to assign cases.
              </p>
            )}
            <label className="field-label">
              Case status
              <select
                className="form-control"
                value={item.status}
                onChange={changeStatus}
              >
                {[
                  "NEW",
                  "UNREVIEWED",
                  "IN_PROGRESS",
                  "AWAITING_INFORMATION",
                  "RESOLVED",
                  "CLOSED",
                  item.status,
                ]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((value) => (
                    <option value={value} key={value}>
                      {labelize(value)}
                    </option>
                  ))}
              </select>
            </label>
            {item.inspector && (
              <div className="assigned-contact">
                <div className="user-avatar">
                  <UserRound size={15} />
                </div>
                <div>
                  <b>{item.inspector.name}</b>
                  <small>{item.inspector.specialization}</small>
                </div>
                <span className="status-light" />
              </div>
            )}
          </section>
          <section className="panel timeline-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Clock3 size={16} /> Case timeline
                </h3>
                <p>Recorded investigation events</p>
              </div>
            </div>
            <div className="timeline-list">
              {item.timeline?.map((event, i) => (
                <div className="timeline-item" key={`${event.created_at}-${i}`}>
                  <span
                    className={`timeline-dot ${i === 0 ? "timeline-dot-current" : ""}`}
                  />
                  <div>
                    <b>{event.event}</b>
                    {event.detail && <p>{event.detail}</p>}
                    <small>
                      {new Date(event.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}

export default CaseDetail;
