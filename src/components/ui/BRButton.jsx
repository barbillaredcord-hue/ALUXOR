import { componentClass } from '../../design/utils/theme';

export default function BRButton({
  as: Component = 'button',
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  block = false,
  iconOnly = false,
  type = 'button',
  ...props
}) {
  const componentProps = Component === 'button' ? { type, ...props } : props;

  return (
    <Component
      className={componentClass('br-button', {
        variant,
        size,
        className: `${block ? 'br-button--block ' : ''}${iconOnly ? 'br-button--icon-only ' : ''}${className}`
      })}
      {...componentProps}
    >
      {children}
    </Component>
  );
}
