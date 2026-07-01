

/**
 * BR Design System
 * Spacing Tokens v1.0
 *
 * Escala oficial de espaciado.
 * Evitar valores mágicos en componentes nuevos.
 */

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64
};

export const layout = {
  pagePadding: spacing.xl,
  panelPadding: spacing.lg,
  sectionGap: spacing.xl,
  cardGap: spacing.md,
  fieldGap: spacing.sm,
  gridGap: spacing.lg,
  toolbarGap: spacing.sm,
  sidebarWidth: 292,
  inspectorWidth: 340,
  contentMaxWidth: 1280
};

export default spacing;