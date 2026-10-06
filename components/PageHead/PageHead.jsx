function PageHead({ kicker, title, subtitle, action }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export default PageHead;
