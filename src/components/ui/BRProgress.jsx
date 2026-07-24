import { classNames } from '../../design/utils/theme';

export default function BRProgress({
  value = 0,
  max = 100,
  label,
  showValue = false,
  className = '',
  ...props
}) {
  const safeMax = Number(max) > 0 ? Number(max) : 100;
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percentage = Math.round((safeValue / safeMax) * 100);

  return (
    <div className={classNames('br-progress', className)} {...props}>
      {label || showValue ? (
        <div className="br-progress__meta">
          <span>{label}</span>
          {showValue ? <span>{percentage}%</span> : null}
        </div>
      ) : null}
      <div
        className="br-progress__track"
        role="progressbar"
        aria-label={label || undefined}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
      >
        <span className="br-progress__bar" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
