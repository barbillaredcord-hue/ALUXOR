import tokens from '../tokens';

export const theme = tokens;

export function cssVar(name, fallback) {
  const variable = `--${String(name).replace(/^--/, '')}`;
  return fallback === undefined ? `var(${variable})` : `var(${variable}, ${fallback})`;
}

export function toCssUnit(value, unit = 'px') {
  return typeof value === 'number' && value !== 0 ? `${value}${unit}` : String(value);
}

export function getToken(path, source = theme) {
  if (!path) return source;

  return String(path)
    .split('.')
    .reduce((value, key) => value?.[key], source);
}

export function classNames(...values) {
  return values.flat().filter(Boolean).join(' ');
}

export function componentClass(base, { variant, size, state, className } = {}) {
  return classNames(
    base,
    variant && `${base}--${variant}`,
    size && `${base}--${size}`,
    state && `${base}--${state}`,
    className
  );
}

export const themeHelpers = Object.freeze({
  classNames,
  componentClass,
  cssVar,
  getToken,
  toCssUnit
});

export const helpers = themeHelpers;

export default theme;
