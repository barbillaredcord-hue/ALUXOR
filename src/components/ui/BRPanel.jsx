import { componentClass } from '../../design/utils/theme';

export default function BRPanel({
  as: Component = 'section',
  children,
  className = '',
  variant = 'default',
  ...props
}) {
  return (
    <Component className={componentClass('br-panel', { variant, className })} {...props}>
      {children}
    </Component>
  );
}
