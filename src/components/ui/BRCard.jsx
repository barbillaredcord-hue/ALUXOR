

import { colors } from '../../design/tokens/colors';
import { layout } from '../../design/tokens/spacing';
import { componentRadius } from '../../design/tokens/radius';
import { componentShadows } from '../../design/tokens/shadows';

const variantStyles = {
  default: {
    background: colors.surface.secondary,
    borderColor: colors.border.default,
    boxShadow: componentShadows.card
  },
  elevated: {
    background: colors.surface.elevated,
    borderColor: colors.border.subtle,
    boxShadow: componentShadows.panel
  },
  soft: {
    background: colors.surface.primary,
    borderColor: colors.border.subtle,
    boxShadow: componentShadows.card
  },
  dark: {
    background: colors.surface.inverse,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: componentShadows.panel,
    color: colors.text.inverse
  },
  success: {
    background: colors.success.soft,
    borderColor: colors.success.primary,
    boxShadow: componentShadows.card
  },
  warning: {
    background: colors.warning.soft,
    borderColor: colors.warning.primary,
    boxShadow: componentShadows.card
  },
  danger: {
    background: colors.danger.soft,
    borderColor: colors.danger.primary,
    boxShadow: componentShadows.card
  }
};

const paddingStyles = {
  none: 0,
  compact: layout.fieldGap,
  normal: layout.panelPadding,
  spacious: layout.pagePadding
};

export default function BRCard({
  as: Component = 'article',
  children,
  className = '',
  variant = 'default',
  padding = 'normal',
  interactive = false,
  style,
  ...props
}) {
  const cardStyle = {
    minWidth: 0,
    padding: paddingStyles[padding] ?? paddingStyles.normal,
    color: colors.text.primary,
    border: `1px solid ${(variantStyles[variant] ?? variantStyles.default).borderColor}`,
    borderRadius: componentRadius.card,
    ...(variantStyles[variant] ?? variantStyles.default),
    ...(interactive
      ? {
          cursor: 'pointer',
          transition: 'transform 180ms ease, box-shadow 180ms ease'
        }
      : null),
    ...style
  };

  return (
    <Component
      className={`br-card${interactive ? ' br-card-interactive' : ''}${className ? ` ${className}` : ''}`}
      style={cardStyle}
      {...props}
    >
      {children}
    </Component>
  );
}
