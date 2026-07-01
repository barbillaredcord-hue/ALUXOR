

/**
 * BR Design System
 * Typography Tokens v1.0
 *
 * Escala tipográfica oficial.
 * Prioriza legibilidad en escritorio y adaptación a móvil.
 */

export const fontFamily = {
  sans: 'Inter, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
  mono: 'JetBrains Mono, Menlo, Consolas, monospace'
};

export const fontSize = {
  micro: 11,
  caption: 12,
  body: 14,
  bodyLg: 16,
  heading: 20,
  title: 28,
  display: 36
};

export const lineHeight = {
  compact: 1.15,
  normal: 1.4,
  relaxed: 1.6
};

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  heavy: 800,
  black: 900
};

export const responsiveTypography = {
  desktop: {
    display: 36,
    title: 28,
    heading: 20,
    body: 14
  },
  tablet: {
    display: 32,
    title: 24,
    heading: 18,
    body: 14
  },
  mobile: {
    display: 26,
    title: 22,
    heading: 17,
    body: 15
  }
};

export default {
  fontFamily,
  fontSize,
  lineHeight,
  fontWeight,
  responsiveTypography
};