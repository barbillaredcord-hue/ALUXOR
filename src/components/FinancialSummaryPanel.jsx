export default function FinancialSummaryPanel({
  title, money, rows = [], actions = [], className = '', compact = false,
}) {
  return (
    <aside className={`financial-summary-panel ${className}`}>
      <h3>{title}</h3>
      <div className="financial-summary-values">
        {rows.map((row) => <div key={row.label} className={row.emphasis ? 'emphasis' : ''}>
          <span>{row.label}</span><strong>{row.value}</strong>
        </div>)}
      </div>
      {!compact && actions.length > 0 && <div className="financial-summary-actions">
        {actions.map((action) => <button key={action.label} type="button" className={action.primary ? '' : 'ghost'} disabled={action.disabled} onClick={action.onClick}>{action.label}</button>)}
      </div>}
    </aside>
  );
}
