import * as Shared from "../shared.js";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
import ChartEmpty from "../ChartEmpty/ChartEmpty.jsx";
import Urgency from "../Urgency/Urgency.jsx";
import Status from "../Status/Status.jsx";
const {
  useEffect,
  useState,
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Clock3,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Target,
  UserRound,
  Users,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  shortDate,
  COLORS,
  api,
} = Shared;

function Dashboard({ refreshKey, onNavigate, onOpenCase }) {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    Promise.all([
      api("/dashboard"),
      api("/cases?limit=6&sort=updated"),
      api("/meta"),
    ])
      .then(([d, c, m]) => {
        setData(d);
        setRecent(c.rows);
        setMeta(m);
      })
      .catch(() => setData({ total: 0 }));
  }, [refreshKey]);
  if (!data) return <Loading />;
  const stats = [
    [
      "Total cases",
      data.total,
      "All records in the database",
      <ClipboardList size={16} />,
      "stat-blue",
      { label: "all" },
    ],
    [
      "New cases",
      data.newCases,
      "Awaiting first review",
      <CircleDot size={16} />,
      "stat-teal",
      { status: "NEW", label: "new" },
    ],
    [
      "Critical",
      data.critical,
      "Immediate attention",
      <ShieldAlert size={16} />,
      "stat-red",
      { urgency: "CRITICAL", label: "critical priority" },
    ],
    [
      "High priority",
      data.high,
      "Priority investigation",
      <AlertTriangle size={16} />,
      "stat-amber",
      { urgency: "HIGH", label: "high priority" },
    ],
    [
      "Medium",
      data.medium,
      "Normal investigation",
      <Activity size={16} />,
      "stat-indigo",
      { urgency: "MEDIUM", label: "medium priority" },
    ],
    [
      "Low priority",
      data.low,
      "Routine handling",
      <ArrowDownRight size={16} />,
      "stat-green",
      { urgency: "LOW", label: "low priority" },
    ],
    [
      "Assigned",
      data.assigned,
      "With an inspector",
      <UserRound size={16} />,
      "stat-purple",
      { assigned: "yes", label: "assigned" },
    ],
    [
      "Unassigned",
      data.unassigned,
      "Awaiting assignment",
      <UserRound size={16} />,
      "stat-amber",
      { assigned: "no", label: "unassigned" },
    ],
    [
      "Resolved",
      data.resolved,
      "Closed or resolved",
      <BadgeCheck size={16} />,
      "stat-slate",
      { resolved: "yes", label: "resolved or closed" },
    ],
  ];
  const urgencyData = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((name) => ({
    name,
    count: data.urgency[name] || 0,
  }));
  return (
    <>
      <div className="welcome-bar">
        <div>
          <div className="eyebrow">
            <span className="pulse-dot" /> LIVE CASE OVERVIEW
          </div>
          <h1>Good day, Investigator</h1>
          <p>Your unit’s cybercrime case intelligence at a glance.</p>
        </div>
        <div className="welcome-date">
          <CalendarDays size={16} />
          <span>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      </div>
      {meta?.caseCount === 0 && (
        <div className="notice-banner">
          <div className="notice-icon">
            <FileSpreadsheet size={17} />
          </div>
          <div>
            <b>Your workspace is ready for its dataset</b>
            <span>
              Import the provided CSV to populate live case metrics and records.
            </span>
          </div>
          <button
            className="button button-secondary button-sm"
            onClick={() => onNavigate("Settings")}
          >
            Import CSV <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="section-title-row">
        <div>
          <h2>Case posture</h2>
          <span>
            Operational snapshot <span className="tiny-dot" /> Live database
          </span>
        </div>
        <span className="updated-label">
          <Clock3 size={13} /> Updated just now
        </span>
      </div>
      <div className="stats-grid">
        {stats.map(([title, value, caption, icon, style, filters]) => (
          <button
            type="button"
            className={`stat-card ${style} stat-card-button`}
            key={title}
            aria-label={`Show ${filters.label} cases`}
            onClick={() => onNavigate("Cases", filters)}
          >
            <span className="stat-top">
              <span>{title}</span>
              <span className="stat-icon">{icon}</span>
            </span>
            <b className="stat-value">{value ?? 0}</b>
            <span className="stat-caption">{caption}</span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Cases over time</h3>
              <p>Reported date from source records</p>
            </div>
            <span className="chart-icon">
              <Activity size={15} />
            </span>
          </div>
          {data.months?.length ? (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.months}>
                  <defs>
                    <linearGradient id="casesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#54c7b2"
                        stopOpacity={0.22}
                      />
                      <stop offset="100%" stopColor="#54c7b2" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="#263648"
                    strokeDasharray="3 5"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke="#6f8298"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#6f8298"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={25}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111e2c",
                      border: "1px solid #27384a",
                      borderRadius: 10,
                      color: "#e5edf4",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#54c7b2"
                    strokeWidth={2.2}
                    fill="url(#casesGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty label="Date trend appears when the source contains report dates." />
          )}
        </div>
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Urgency distribution</h3>
              <p>Current case assessments</p>
            </div>
            <span className="chart-icon chart-icon-amber">
              <Target size={15} />
            </span>
          </div>
          {data.total ? (
            <div className="urgency-chart">
              <div className="donut-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={urgencyData}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={51}
                      outerRadius={69}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {urgencyData.map((entry, i) => (
                        <Cell
                          key={entry.name}
                          fill={["#e76f77", "#e8a64a", "#6489ee", "#4abb9b"][i]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#111e2c",
                        border: "1px solid #27384a",
                        borderRadius: 9,
                        color: "#e5edf4",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <b>{data.total}</b>
                  <span>CASES</span>
                </div>
              </div>
              <div className="legend-list">
                {urgencyData.map((item, i) => (
                  <div key={item.name}>
                    <span className="legend-name">
                      <i
                        style={{
                          background: [
                            "#e76f77",
                            "#e8a64a",
                            "#6489ee",
                            "#4abb9b",
                          ][i],
                        }}
                      />
                      {item.name}
                    </span>
                    <b>{item.count}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ChartEmpty label="No cases to display yet." />
          )}
        </div>
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Top case categories</h3>
              <p>Based on mapped source fields</p>
            </div>
            <span className="chart-icon chart-icon-blue">
              <BriefcaseBusiness size={15} />
            </span>
          </div>
          {data.categories?.length ? (
            <div className="bar-chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.categories}
                  layout="vertical"
                  margin={{ left: 6, right: 15 }}
                >
                  <CartesianGrid
                    stroke="#263648"
                    strokeDasharray="3 5"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    stroke="#6f8298"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#8da0b4"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111e2c",
                      border: "1px solid #27384a",
                      borderRadius: 9,
                      color: "#e5edf4",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#6e8afa"
                    radius={[0, 5, 5, 0]}
                    barSize={15}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty label="Category distribution appears when the source includes categories." />
          )}
        </div>
        <div className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Inspector workload</h3>
              <p>Currently assigned cases</p>
            </div>
            <span className="chart-icon chart-icon-purple">
              <Users size={15} />
            </span>
            <button
              className="text-button"
              onClick={() => onNavigate("Inspectors")}
            >
              View all <ArrowRight size={13} />
            </button>
          </div>
          {data.inspectors?.length ? (
            <div className="workload-list">
              {data.inspectors.slice(0, 5).map((inspector, i) => (
                <div className="workload-row" key={inspector.id}>
                  <div
                    className="workload-avatar"
                    style={{ background: `${COLORS[i]}22`, color: COLORS[i] }}
                  >
                    {inspector.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="workload-info">
                    <div>
                      <b>{inspector.name}</b>
                      <span>{inspector.workload} cases</span>
                    </div>
                    <small>{inspector.specialization}</small>
                    <div className="workload-track">
                      <i
                        style={{
                          width: `${Math.min(100, Number(inspector.workload) * 15)}%`,
                          background: COLORS[i],
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ChartEmpty
              label="Add inspectors to monitor team workload."
              action={
                <button
                  className="text-button"
                  onClick={() => onNavigate("Inspectors")}
                >
                  Add inspector <ArrowRight size={13} />
                </button>
              }
            />
          )}
        </div>
      </div>
      <div className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <h3>Recently updated cases</h3>
            <p>Latest activity in your investigation queue</p>
          </div>
          <button
            className="button button-quiet button-sm"
            onClick={() => onNavigate("Cases")}
          >
            All cases <ArrowRight size={14} />
          </button>
        </div>
        {recent.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CASE ID</th>
                  <th>COMPLAINT</th>
                  <th>CATEGORY</th>
                  <th>URGENCY</th>
                  <th>STATUS</th>
                  <th>UPDATED</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id} onClick={() => onOpenCase(item.id)}>
                    <td>
                      <button className="case-id-link">
                        {item.external_id || item.case_key}
                      </button>
                    </td>
                    <td>
                      <span className="complaint-cell">
                        {item.summary || "Source information preserved"}
                      </span>
                    </td>
                    <td>
                      <span className="table-category">
                        {item.category || "—"}
                      </span>
                    </td>
                    <td>
                      <Urgency value={item.urgency} />
                    </td>
                    <td>
                      <Status value={item.status} />
                    </td>
                    <td className="muted-cell">{shortDate(item.updated_at)}</td>
                    <td>
                      <ChevronRight size={15} className="row-chevron" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={ClipboardList}
            title="No case records yet"
            detail="Import your Kaggle CSV from Settings to begin reviewing cases."
            action={
              <button
                className="button button-secondary button-sm"
                onClick={() => onNavigate("Settings")}
              >
                Open settings <ArrowRight size={14} />
              </button>
            }
          />
        )}
      </div>
    </>
  );
}

export default Dashboard;
