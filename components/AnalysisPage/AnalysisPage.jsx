import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
import Urgency from "../Urgency/Urgency.jsx";
const {
  useCallback,
  useEffect,
  useState,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  shortDate,
  api,
} = Shared;

function AnalysisPage({ refreshKey, onOpenCase, onNotify, onRefresh }) {
  const [rows, setRows] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const load = useCallback(
    () => api("/cases?limit=100&sort=urgency").then((d) => setRows(d.rows)),
    [refreshKey],
  );
  useEffect(() => {
    load();
  }, [load]);
  const filtered = (rows || []).filter(
    (item) =>
      filter === "ALL" ||
      (filter === "UNANALYZED"
        ? item.ai_status !== "COMPLETE"
        : item.urgency === filter),
  );
  async function analyze(item) {
    setBusyId(item.id);
    try {
      await api(`/cases/${item.id}/analyze`, { method: "POST", body: "{}" });
      onNotify(`Analysis complete for ${item.external_id || item.case_key}`);
      await load();
      onRefresh();
    } catch (error) {
      onNotify(error.message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <>
      <PageHead
        kicker="INTELLIGENCE ENGINE"
        title="AI case analysis"
        subtitle="Prioritize complaints and surface potential investigative leads with Gemini."
        action={
          <span className="ai-mode-badge">
            <span className="pulse-dot" /> HUMAN-LED · AI-ASSISTED
          </span>
        }
      />
      <div className="ai-disclaimer">
        <ShieldCheck size={17} />
        <span>
          <b>Decision support only.</b> AI classifications and case connections
          are investigative leads. Review evidence and make all case decisions
          yourself.
        </span>
      </div>
      <div className="analysis-toolbar">
        <div className="segmented-control">
          {[
            ["ALL", "All cases"],
            ["UNANALYZED", "Needs analysis"],
            ["CRITICAL", "Critical"],
            ["HIGH", "High priority"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <span>{filtered.length} cases in view</span>
      </div>
      {!rows ? (
        <Loading />
      ) : filtered.length ? (
        <div className="analysis-case-list">
          {filtered.map((item) => (
            <div className="panel analysis-case-card" key={item.id}>
              <div className="analysis-card-leading">
                <div className="analysis-case-icon">
                  <BrainCircuit size={19} />
                </div>
                <div>
                  <span className="analysis-case-id">
                    {item.external_id || item.case_key} <span>·</span>{" "}
                    {item.category || "Unclassified"}
                  </span>
                  <h3>
                    {item.summary || "Original complaint fields are preserved"}
                  </h3>
                  <p>
                    {item.location || "Location not present"} <span>·</span>{" "}
                    {shortDate(item.reported_at)}
                  </p>
                </div>
              </div>
              <div className="analysis-case-state">
                {item.ai_status === "COMPLETE" ? (
                  <>
                    <Urgency value={item.urgency} />
                    <span className="analysis-confidence">
                      <CheckCircle2 size={13} /> AI analysis available
                    </span>
                  </>
                ) : (
                  <span className="unanalysed-label">
                    <CircleDot size={13} />{" "}
                    {item.ai_status === "ERROR"
                      ? "Retry analysis"
                      : "Awaiting analysis"}
                  </span>
                )}
              </div>
              <div className="analysis-case-action">
                <button
                  className="button button-quiet button-sm"
                  onClick={() => onOpenCase(item.id)}
                >
                  Review <ArrowRight size={13} />
                </button>
                {item.ai_status !== "COMPLETE" && (
                  <button
                    className="button button-primary button-sm"
                    disabled={busyId === item.id}
                    onClick={() => analyze(item)}
                  >
                    {busyId === item.id ? (
                      <LoaderCircle className="spin" size={14} />
                    ) : (
                      <Sparkles size={14} />
                    )}{" "}
                    Analyze
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            icon={BrainCircuit}
            title="No cases in this view"
            detail="Import the dataset to start reviewing AI-assisted classification and correlation."
          />
        </div>
      )}
    </>
  );
}

export default AnalysisPage;
