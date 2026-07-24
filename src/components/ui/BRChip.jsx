import { componentClass } from '../../design/utils/theme';

export default function BRChip({
  as: Component = 'span',
  children,
  className = '',
  variant = 'neutral',
  ...props
}) {
  return (
    <Component className={componentClass('br-chip', { variant, className })} {...props}>
      {children}
    </Component>
  );
}
