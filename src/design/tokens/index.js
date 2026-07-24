import colors from './colors';
import typography, {
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  responsiveTypography
} from './typography';
import spacing, { layout } from './spacing';
import radius, { componentRadius } from './radius';
import shadows, { componentShadows } from './shadows';
import motion, { duration, easing, motionPreference, transition } from './motion';
import zIndex, { layers } from './zIndex';

export {
  colors,
  componentRadius,
  componentShadows,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  layers,
  layout,
  lineHeight,
  motionPreference,
  radius,
  responsiveTypography,
  shadows,
  spacing,
  transition,
  zIndex
};

export const tokens = Object.freeze({
  colors,
  typography,
  spacing,
  layout,
  radius,
  componentRadius,
  shadows,
  componentShadows,
  motion,
  zIndex,
  layers
});

export default tokens;
