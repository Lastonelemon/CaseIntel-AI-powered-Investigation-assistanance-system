import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
import UploadIcon from "../UploadIcon/UploadIcon.jsx";
const {
  useCallback,
  useEffect,
  useRef,
  useState,
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Settings,
  ShieldCheck,
  Target,
  API,
  asJSON,
  mappedTo,
  api,
} = Shared;

function SettingsPage({ refreshKey, onNotify, onRefresh }) {
  const [meta, setMeta] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const picker = useRef(null);
  const load = useCallback(
    () =>
      api("/meta")
        .then(setMeta)
        .catch(() => {}),
    [refreshKey],
  );
  useEffect(() => {
    load();
  }, [load]);
  async function importCsv() {
    if (!file) return;
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const result = await api("/import", {
        method: "POST",
        body: asJSON({ filename: file.name, csv: await file.text() }),
      });
      setReport(result);
      onNotify(
        result.repeated
          ? "This CSV was already imported"
          : `Imported ${result.imported} source records`,
      );
      await load();
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        kicker="WORKSPACE CONFIGURATION"
        title="Settings"
        subtitle="Dataset ingestion, AI connectivity and source-field mapping."
      />
      <div className="settings-layout">
        <section className="panel settings-panel">
          <div className="panel-heading">
            <div>
              <h3>
                <FileSpreadsheet size={16} /> Dataset import
              </h3>
              <p>Load the original Kaggle CSV into the local database.</p>
            </div>
            <span className="settings-icon">
              <UploadIcon />
            </span>
          </div>
          <div
            className={`import-dropzone ${file ? "file-ready" : ""}`}
            onClick={() => picker.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const selected = e.dataTransfer.files?.[0];
              if (selected) setFile(selected);
            }}
          >
            <input
              ref={picker}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file ? (
              <>
                <span className="file-ready-icon">
                  <CheckCircle2 size={19} />
                </span>
                <b>{file.name}</b>
                <small>{(file.size / 1024).toFixed(1)} KB · CSV selected</small>
              </>
            ) : (
              <>
                <span className="dropzone-icon">
                  <UploadIcon />
                </span>
                <b>
                  Drop your CSV here, or <span>browse</span>
                </b>
                <small>CSV format · Up to 8 MB</small>
              </>
            )}
          </div>
          <div className="import-guidance">
            <span>
              <CircleDot size={14} /> Dynamic column mapping
            </span>
            <p>
              CaseIntel reads the actual CSV headers and preserves every source
              field. Common fields such as complaint, category, date, location,
              status and urgency are mapped when present.
            </p>
          </div>
          {error && (
            <div className="inline-error">
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          {report && (
            <div className="import-success">
              <CheckCircle2 size={16} />
              <span>
                <b>
                  {report.repeated
                    ? "This exact file was already imported"
                    : "Import complete"}
                </b>
                <small>
                  {report.imported} rows added · {report.columns.length} columns
                  detected
                  {report.skipped
                    ? ` · ${report.skipped} previously imported`
                    : ""}
                </small>
              </span>
            </div>
          )}
          <div className="import-actions">
            <span>{meta?.caseCount || 0} cases currently in database</span>
            <button
              className="button button-primary"
              disabled={!file || busy}
              onClick={importCsv}
            >
              {busy ? (
                <>
                  <LoaderCircle className="spin" size={15} /> Importing…
                </>
              ) : (
                <>
                  <FileSpreadsheet size={15} /> Import dataset
                </>
              )}
            </button>
          </div>
        </section>
        <aside className="settings-aside">
          <section className="panel settings-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <BrainCircuit size={16} /> Gemini AI
                </h3>
                <p>Server-side AI connectivity</p>
              </div>
              <span
                className={`connection-status ${meta?.geminiConfigured ? "connected" : "disconnected"}`}
              >
                <i />
                {meta?.geminiConfigured ? "Connected" : "Not configured"}
              </span>
            </div>
            <div className="ai-config-message">
              {meta?.geminiConfigured ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>
                    API key is present in the local server environment. It is
                    never sent to your browser.
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>
                    Add your key as <code>GEMINI_API_KEY</code> in the project’s
                    server-side <code>.env</code> file, then restart the server.
                  </span>
                </>
              )}
            </div>
            <div className="config-list">
              <div>
                <span>Model</span>
                <b>Environment configured</b>
              </div>
              <div>
                <span>API key exposure</span>
                <b className="good-value">
                  Server only <ShieldCheck size={13} />
                </b>
              </div>
            </div>
          </section>
          <section className="panel settings-panel mapping-panel">
            <div className="panel-heading">
              <div>
                <h3>
                  <Target size={16} /> Source field mapping
                </h3>
                <p>Columns detected in the imported CSV</p>
              </div>
              <span className="mapping-count">
                {meta?.columns?.length || 0}
              </span>
            </div>
            {meta?.columns?.length ? (
              <div className="mapping-list">
                {meta.columns.map((column) => (
                  <div key={column}>
                    <span className="mapping-field-icon">
                      <FileText size={13} />
                    </span>
                    <b>{column}</b>
                    <span>{mappedTo(column)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="subtle-empty">
                <FileSpreadsheet size={16} />
                <span>
                  Import the CSV to inspect and preserve its column schema.
                </span>
              </div>
            )}
            <p className="mapping-note">
              All original headers and values remain stored, including columns
              not mapped to a CaseIntel filter.
            </p>
          </section>
        </aside>
      </div>
      <section className="panel environment-note">
        <div className="env-note-icon">
          <ShieldCheck size={17} />
        </div>
        <div>
          <b>Data storage & security</b>
          <p>
            Case records use a local SQLite database. Passwords are compared
            using scrypt; login sessions use HttpOnly cookies. Avoid placing
            production secrets or sensitive case data in shared folders.
          </p>
        </div>
      </section>
    </>
  );
}

export default SettingsPage;
