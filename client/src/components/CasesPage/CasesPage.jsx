import * as Shared from "../shared.js";
import Page from "../Page/Page.jsx";
import PageHead from "../PageHead/PageHead.jsx";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
import Urgency from "../Urgency/Urgency.jsx";
import Status from "../Status/Status.jsx";
const {
  useEffect,
  useMemo,
  useState,
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Filter,
  Plus,
  Search,
  Settings,
  shortDate,
  api,
} = Shared;

function CasesPage({ refreshKey, initialFilters, onOpenCase }) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({
    columns: [],
    categories: [],
    statuses: [],
    inspectors: [],
  });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [urgency, setUrgency] = useState(initialFilters?.urgency || "");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState(initialFilters?.status || "");
  const [inspector, setInspector] = useState("");
  const [assigned, setAssigned] = useState(initialFilters?.assigned || "");
  const [resolved, setResolved] = useState(initialFilters?.resolved || "");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("date");
  const [dir, setDir] = useState("desc");
  useEffect(() => {
    api("/meta")
      .then(setMeta)
      .catch(() => {});
  }, []);
  const params = useMemo(
    () =>
      new URLSearchParams(
        Object.entries({
          page,
          q: search,
          urgency,
          category,
          status,
          inspector,
          assigned,
          resolved,
          sort,
          dir,
          limit: 12,
        }).filter(([, value]) => value !== ""),
      ).toString(),
    [
      page,
      search,
      urgency,
      category,
      status,
      inspector,
      assigned,
      resolved,
      sort,
      dir,
    ],
  );
  useEffect(() => {
    setData(null);
    api(`/cases?${params}`)
      .then(setData)
      .catch(() => setData({ rows: [], total: 0, pages: 1 }));
  }, [params, refreshKey]);
  const categories = meta.categories || [];
  const count = data?.total || 0;
  function clearQuickFilter() {
    setUrgency("");
    setStatus("");
    setAssigned("");
    setResolved("");
    setPage(1);
  }
  return (
    <>
      <PageHead
        kicker="CASE MANAGEMENT"
        title="Case records"
        subtitle="Search, filter and review complaints from the source dataset."
        action={
          <button
            className="button button-primary"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("caseintel-nav", { detail: "Add Case" }),
              )
            }
          >
            <Plus size={16} /> Add case
          </button>
        }
      />
      <div className="panel case-list-panel">
        {initialFilters?.label && (
          <div className="quick-filter-banner">
            <span>
              Showing <b>{initialFilters.label}</b> cases
            </span>
            <button type="button" onClick={clearQuickFilter}>
              Clear filter
            </button>
          </div>
        )}
        <div className="case-toolbar">
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setSearch(query);
            }}
          >
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search case ID, complaint, category…"
            />
            <button aria-label="Search">
              <ArrowRight size={15} />
            </button>
          </form>
          <div className="filter-group">
            <span>
              <Filter size={14} /> Filters
            </span>
            <select
              value={urgency}
              onChange={(e) => {
                setPage(1);
                setUrgency(e.target.value);
              }}
            >
              <option value="">All urgency</option>
              {["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNASSESSED"].map(
                (item) => (
                  <option key={item}>{item}</option>
                ),
              )}
            </select>
            <select
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              {meta.statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={inspector}
              onChange={(e) => {
                setPage(1);
                setInspector(e.target.value);
              }}
            >
              <option value="">All inspectors</option>
              {meta.inspectors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              className="sort-button"
              onClick={() => {
                setSort(sort === "date" ? "urgency" : "date");
                setDir(dir === "desc" ? "asc" : "desc");
              }}
            >
              <ArrowDown size={13} /> Sort:{" "}
              {sort === "date" ? "Date" : "Urgency"}
            </button>
          </div>
        </div>
        {!data ? (
          <Loading />
        ) : count ? (
          <>
            <div className="table-wrap">
              <table className="data-table case-table">
                <thead>
                  <tr>
                    <th>CASE ID</th>
                    <th>COMPLAINT / SOURCE DETAIL</th>
                    <th>CATEGORY</th>
                    <th>REPORTED</th>
                    <th>URGENCY</th>
                    <th>STATUS</th>
                    <th>ASSIGNED INSPECTOR</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((item) => (
                    <tr key={item.id} onClick={() => onOpenCase(item.id)}>
                      <td>
                        <button className="case-id-link">
                          {item.external_id || item.case_key}
                        </button>
                      </td>
                      <td>
                        <div className="complaint-main">
                          {item.summary || "Source information preserved"}
                        </div>
                        <small className="complaint-sub">
                          {item.location || item.case_key}
                        </small>
                      </td>
                      <td>
                        <span className="table-category">
                          {item.category || "Unclassified"}
                        </span>
                      </td>
                      <td className="muted-cell">
                        {shortDate(item.reported_at)}
                      </td>
                      <td>
                        <Urgency value={item.urgency} />
                      </td>
                      <td>
                        <Status value={item.status} />
                      </td>
                      <td className="muted-cell">
                        {item.assigned_inspector || "Unassigned"}
                      </td>
                      <td>
                        <ChevronRight size={15} className="row-chevron" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                Showing{" "}
                <b>
                  {(page - 1) * 12 + 1}–{Math.min(page * 12, count)}
                </b>{" "}
                of <b>{count}</b> records
              </span>
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={15} />
                </button>
                <span>
                  Page {page} of {data.pages}
                </span>
                <button
                  disabled={page >= data.pages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            icon={ClipboardList}
            title={
              search || urgency || category || status
                ? "No matching cases"
                : "Your case list is empty"
            }
            detail={
              search || urgency || category || status
                ? "Try changing your search or filters."
                : "Import the source CSV in Settings or add a complaint."
            }
            action={
              !(search || urgency || category || status) ? (
                <button
                  className="button button-secondary button-sm"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("caseintel-nav", { detail: "Settings" }),
                    )
                  }
                >
                  Import dataset
                </button>
              ) : null
            }
          />
        )}
      </div>
    </>
  );
}

export default CasesPage;
