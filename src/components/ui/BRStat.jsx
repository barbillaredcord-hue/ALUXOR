import { classNames } from '../../design/utils/theme';

export default function BRStat({ label, value, detail, className = '', ...props }) {
  return (
    <div className={classNames('br-stat', className)} {...props}>
      <span className="br-stat__label">{label}</span>
      <strong className="br-stat__value">{value}</strong>
      {detail ? <span className="br-stat__detail">{detail}</span> : null}
    </div>
  );
}
