import { classNames } from '../../design/utils/theme';

export default function BRToolbar({
  as: Component = 'div',
  children,
  className = '',
  align = 'start',
  ...props
}) {
  return (
    <Component
      className={classNames('br-toolbar', `br-toolbar--${align}`, className)}
      role={Component === 'div' ? 'toolbar' : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}
