import { classNames } from '../../design/utils/theme';

export default function BRSection({
  as: Component = 'section',
  title,
  description,
  actions,
  children,
  className = '',
  ...props
}) {
  return (
    <Component className={classNames('br-section', className)} {...props}>
      {title || description || actions ? (
        <header className="br-section__header">
          <div>
            {title ? <h2 className="br-section__title">{title}</h2> : null}
            {description ? <p className="br-section__description">{description}</p> : null}
          </div>
          {actions ? <div className="br-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Component>
  );
}
