import { classNames } from '../../design/utils/theme';

export default function BRTooltip({
  as: Component = 'span',
  content,
  children,
  className = '',
  position = 'top',
  ...props
}) {
  return (
    <Component
      className={classNames('br-tooltip', `br-tooltip--${position}`, className)}
      data-tooltip={content}
      {...props}
    >
      {children}
    </Component>
  );
}
