import * as Shared from "../shared.js";
const { labelize, urgencyClass } = Shared;

function Urgency({ value }) {
  return (
    <span className={`urgency-badge urgency-${urgencyClass(value)}`}>
      <i />
      {labelize(value || "Unassessed")}
    </span>
  );
}

export default Urgency;
