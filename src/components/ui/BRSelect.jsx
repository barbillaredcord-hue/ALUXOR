import { classNames } from '../../design/utils/theme';

export default function BRSelect({
  id,
  label,
  hint,
  error,
  children,
  className = '',
  selectClassName = '',
  ...props
}) {
  return (
    <label className={classNames('br-field', className)} htmlFor={id}>
      {label ? <span className="br-field__label">{label}</span> : null}
      <select
        id={id}
        className={classNames('br-select', error && 'br-select--error', selectClassName)}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      {error || hint ? (
        <span className={classNames('br-field__hint', error && 'br-field__hint--error')}>
          {error || hint}
        </span>
      ) : null}
    </label>
  );
}
