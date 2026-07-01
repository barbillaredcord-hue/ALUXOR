

/**
 * BR Design System
 * Motion Tokens v1.0
 *
 * Las animaciones deben ser discretas, rápidas y útiles.
 * Nunca deben retrasar el trabajo ni distraer al usuario.
 */

export const duration = {
  instant: '0ms',
  fast: '120ms',
  normal: '180ms',
  slow: '260ms',
  slower: '360ms'
};

export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  enter: 'cubic-bezier(0, 0, 0.2, 1)'
};

export const transition = {
  fast: `${duration.fast} ${easing.standard}`,
  normal: `${duration.normal} ${easing.standard}`,
  slow: `${duration.slow} ${easing.smooth}`,
  transform: `transform ${duration.normal} ${easing.standard}`,
  opacity: `opacity ${duration.fast} ${easing.standard}`,
  colors: `background-color ${duration.normal} ${easing.standard}, border-color ${duration.normal} ${easing.standard}, color ${duration.normal} ${easing.standard}`
};

export const motionPreference = {
  reduce: '@media (prefers-reduced-motion: reduce)',
  noPreference: '@media (prefers-reduced-motion: no-preference)'
};

export default {
  duration,
  easing,
  transition,
  motionPreference
};