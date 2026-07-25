import { ArrowRight, ChevronDown } from 'lucide-react';

export default function ExpandableDashboardCard({
  icon: Icon,
  title,
  value,
  detail,
  tone = 'graphite',
  expanded,
  onToggle,
  onOpen,
  openLabel,
  children,
}) {
  return (
    <article className={`operational-dashboard-card material-${tone}${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="operational-dashboard-card__trigger"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="operational-dashboard-card__icon"><Icon size={20} /></span>
        <span>
          <strong>{title}</strong>
          <small>{detail}</small>
        </span>
        <em>{value}</em>
        <ChevronDown className="operational-dashboard-card__chevron" size={18} />
      </button>

      <div className="operational-dashboard-card__expansion" aria-hidden={!expanded}>
        <div className="operational-dashboard-card__content">{children}</div>
        <button
          type="button"
          className="operational-dashboard-card__open"
          onClick={onOpen}
          tabIndex={expanded ? 0 : -1}
        >
          {openLabel} <ArrowRight size={15} />
        </button>
      </div>
    </article>
  );
}
