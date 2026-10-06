import * as Shared from "../shared.js";
const { Activity } = Shared;

function ChartEmpty({ label, action }) {
  return (
    <div className="chart-empty">
      <span className="chart-empty-icon">
        <Activity size={18} />
      </span>
      <p>{label}</p>
      {action}
    </div>
  );
}

export default ChartEmpty;
