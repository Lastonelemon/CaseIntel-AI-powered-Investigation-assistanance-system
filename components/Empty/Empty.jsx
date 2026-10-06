import * as Shared from "../shared.js";
const { FileSpreadsheet } = Shared;

function Empty({ icon: Icon = FileSpreadsheet, title, detail, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={21} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export default Empty;
