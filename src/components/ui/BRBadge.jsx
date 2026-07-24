import { componentClass } from '../../design/utils/theme';

export default function BRBadge({
  as: Component = 'span',
  children,
  className = '',
  variant = 'neutral',
  ...props
}) {
  return (
    <Component className={componentClass('br-badge', { variant, className })} {...props}>
      {children}
    </Component>
  );
}
