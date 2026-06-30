export default function DashboardSummary({ number, title, description, status = 'Revisar', highlight = false, icon: Icon }) {
  return (
    <summary className={highlight ? 'dashboard-summary highlight' : 'dashboard-summary'}>
      <span className="dashboard-number">
        {Icon ? <Icon size={18} /> : number}
      </span>
      <span className="dashboard-title">
        <small className="dashboard-kicker">{number}</small>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{status}</em>
    </summary>
  );
}
