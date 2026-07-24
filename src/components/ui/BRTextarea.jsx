import { classNames } from '../../design/utils/theme';

export default function BRTextarea({
  id,
  label,
  hint,
  error,
  className = '',
  textareaClassName = '',
  ...props
}) {
  return (
    <label className={classNames('br-field', className)} htmlFor={id}>
      {label ? <span className="br-field__label">{label}</span> : null}
      <textarea
        id={id}
        className={classNames('br-textarea', error && 'br-textarea--error', textareaClassName)}
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
