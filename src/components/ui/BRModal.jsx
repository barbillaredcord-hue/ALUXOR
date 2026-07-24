import { classNames } from '../../design/utils/theme';

export default function BRModal({
  open,
  title,
  children,
  footer,
  onClose,
  className = '',
  closeLabel = 'Cerrar',
  ...props
}) {
  if (!open) return null;

  return (
    <div className="br-modal-backdrop" role="presentation">
      <section
        className={classNames('br-modal', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title || undefined}
        {...props}
      >
        {title || onClose ? (
          <header className="br-modal__header">
            {title ? <h2>{title}</h2> : <span />}
            {onClose ? (
              <button className="br-modal__close" type="button" onClick={onClose} aria-label={closeLabel}>
                ×
              </button>
            ) : null}
          </header>
        ) : null}
        <div className="br-modal__body">{children}</div>
        {footer ? <footer className="br-modal__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
