import * as Shared from "../shared.js";
const { LoaderCircle } = Shared;

function Loading({ label = "Loading workspace data…" }) {
  return (
    <div className="loading-state">
      <LoaderCircle className="spin" size={18} />
      {label}
    </div>
  );
}

export default Loading;
