import * as Shared from "../shared.js";
const { labelize } = Shared;

function Status({ value }) {
  return (
    <span
      className={`status-badge status-${String(value || "unreviewed")
        .toLowerCase()
        .replace(/[^a-z]+/g, "-")}`}
    >
      <i />
      {labelize(value || "Unreviewed")}
    </span>
  );
}

export default Status;
