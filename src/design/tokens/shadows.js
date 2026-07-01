

/**
 * BR Design System
 * Shadow Tokens v1.0
 *
 * Las sombras comunican elevación y jerarquía.
 * Deben ser discretas y consistentes.
 */

export const shadows = {
  none: 'none',

  soft: '0 2px 8px rgba(23, 32, 27, 0.06)',

  medium: '0 8px 24px rgba(23, 32, 27, 0.10)',

  floating: '0 18px 46px rgba(20, 36, 28, 0.14)',

  overlay: '0 28px 72px rgba(17, 24, 39, 0.20)',

  focus: '0 0 0 3px rgba(34, 116, 95, 0.22)',

  inset: 'inset 0 1px 2px rgba(23, 32, 27, 0.08)'
};

export const componentShadows = {
  card: shadows.soft,
  panel: shadows.medium,
  dropdown: shadows.floating,
  modal: shadows.overlay,
  buttonFocus: shadows.focus,
  inputFocus: shadows.focus
};

export default shadows;