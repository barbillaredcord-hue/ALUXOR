

/**
 * BR Design System
 * Radius Tokens v1.0
 *
 * Escala oficial de bordes redondeados.
 * Debe sentirse moderna, profesional y no infantil.
 */

export const radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  pill: 999
};

export const componentRadius = {
  button: radius.md,
  input: radius.md,
  card: radius.lg,
  panel: radius.xl,
  modal: radius['2xl'],
  chip: radius.pill,
  badge: radius.pill,
  timelineStep: radius.lg
};

export default radius;