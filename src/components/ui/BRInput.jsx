import { classNames } from '../../design/utils/theme';

export default function BRInput({
  id,
  label,
  hint,
  error,
  className = '',
  inputClassName = '',
  ...props
}) {
  return (
    <label className={classNames('br-field', className)} htmlFor={id}>
      {label ? <span className="br-field__label">{label}</span> : null}
      <input
        id={id}
        className={classNames('br-input', error && 'br-input--error', inputClassName)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error || hint ? (
        <span className={classNames('br-field__hint', error && 'br-field__hint--error')}>
          {error || hint}
        </span>
      ) : null}
    </label>
  );
}
