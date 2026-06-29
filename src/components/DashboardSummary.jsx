export default function DashboardSummary({ number, title, description, status = 'Revisar', highlight = false }) {
  return (
    <summary className={highlight ? 'dashboard-summary highlight' : 'dashboard-summary'}>
      <span className="dashboard-number">{number}</span>
      <span className="dashboard-title">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <em>{status}</em>
    </summary>
  );
}
