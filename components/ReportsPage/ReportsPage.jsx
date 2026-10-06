import * as Shared from "../shared.js";
import PageHead from "../PageHead/PageHead.jsx";
import Empty from "../Empty/Empty.jsx";
import Loading from "../Loading/Loading.jsx";
import ChartEmpty from "../ChartEmpty/ChartEmpty.jsx";
import Status from "../Status/Status.jsx";
const {
  useEffect,
  useState,
  CircleDot,
  Download,
  FileText,
  Globe2,
  Sparkles,
  UserRound,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  labelize,
  COLORS,
  api,
} = Shared;

function ReportsPage({ refreshKey }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api("/dashboard")
      .then(setData)
      .catch(() => setData(null));
  }, [refreshKey]);
  return (
    <>
      <PageHead
        kicker="OPERATIONAL REPORTING"
        title="Reports & patterns"
        subtitle="Database-driven views of reported categories, urgency and location."
        action={
          <a
            className="button button-secondary"
            href="/api/reports.csv"
            target="_blank"
            rel="noreferrer"
          >
            <Download size={15} /> Export CSV
          </a>
        }
      />
      {!data ? (
        <Loading />
      ) : !data.total ? (
        <div className="panel">
          <Empty
            icon={FileText}
            title="No report data yet"
            detail="Reports will reflect imported or investigator-created case records."
          />
        </div>
      ) : (
        <>
          <div className="report-stat-strip">
            <div>
              <span>RECORDS ANALYZED</span>
              <b>{data.total}</b>
            </div>
            <div>
              <span>CRITICAL + HIGH</span>
              <b className="text-red">{data.critical + data.high}</b>
            </div>
            <div>
              <span>RESOLVED</span>
              <b>{data.resolved}</b>
            </div>
            <div>
              <span>ASSIGNMENT RATE</span>
              <b>
                {Math.round((data.assigned / Math.max(data.total, 1)) * 100)}
                <small>%</small>
              </b>
            </div>
          </div>
          <div className="reports-grid">
            <div className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h3>Reported category</h3>
                  <p>Record count from mapped source fields</p>
                </div>
              </div>
              <div className="report-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.categories}
                    margin={{ top: 6, right: 12, left: 0, bottom: 30 }}
                  >
                    <CartesianGrid
                      stroke="#263648"
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke="#8092a7"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      angle={-18}
                      textAnchor="end"
                      interval={0}
                    />
                    <YAxis
                      stroke="#6f8298"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
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
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.categories.map((item, i) => (
                        <Cell
                          key={item.name}
                          fill={COLORS[i % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h3>AI classification</h3>
                  <p>Distribution of completed AI reviews</p>
                </div>
              </div>
              {data.aiCategories.length ? (
                <div className="report-ranking">
                  {data.aiCategories.map((item, i) => (
                    <div key={item.name}>
                      <span className="rank-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="rank-name">
                        <Sparkles size={13} />
                        {item.name}
                      </span>
                      <div className="rank-bar">
                        <i
                          style={{
                            width: `${Math.max(4, (item.count / data.aiCategories[0].count) * 100)}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <b>{item.count}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <ChartEmpty label="AI classifications appear here after cases are analyzed." />
              )}
            </div>
            <div className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h3>Reported location</h3>
                  <p>Most common locations in source records</p>
                </div>
              </div>
              <div className="report-ranking">
                {data.locations.map((item, i) => (
                  <div key={item.name}>
                    <span className="rank-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="rank-name">
                      <Globe2 size={13} />
                      {item.name}
                    </span>
                    <div className="rank-bar">
                      <i
                        style={{
                          width: `${Math.max(4, (item.count / data.locations[0].count) * 100)}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <b>{item.count}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h3>Status overview</h3>
                  <p>Current disposition of cases</p>
                </div>
              </div>
              <div className="status-report-list">
                {Object.entries(data.statuses).map(([name, count], i) => (
                  <div key={name}>
                    <span
                      className="status-report-icon"
                      style={{
                        color: COLORS[i % COLORS.length],
                        background: `${COLORS[i % COLORS.length]}18`,
                      }}
                    >
                      <CircleDot size={14} />
                    </span>
                    <span>{labelize(name)}</span>
                    <div>
                      <i
                        style={{
                          width: `${(count / data.total) * 100}%`,
                          background: COLORS[i % COLORS.length],
                        }}
                      />
                    </div>
                    <b>{count}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="panel report-panel">
              <div className="panel-heading">
                <div>
                  <h3>Workload by inspector</h3>
                  <p>Assigned records by current roster</p>
                </div>
              </div>
              {data.inspectors.length ? (
                <div className="report-ranking">
                  {data.inspectors.map((item, i) => (
                    <div key={item.id}>
                      <span className="rank-number">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="rank-name">
                        <UserRound size={13} />
                        {item.name}
                      </span>
                      <div className="rank-bar">
                        <i
                          style={{
                            width: `${Math.max(4, (item.workload / Math.max(data.inspectors[0].workload, 1)) * 100)}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                      <b>{item.workload}</b>
                    </div>
                  ))}
                </div>
              ) : (
                <ChartEmpty label="Add inspectors and assign cases to compare workload." />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

export default ReportsPage;
