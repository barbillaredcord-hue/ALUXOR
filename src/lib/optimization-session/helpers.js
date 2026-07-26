export function optimizationSessionText(value) {
  return String(value ?? '').trim();
}

export function optimizationSessionTimestamp(value) {
  const normalized = optimizationSessionText(value);
  if (!normalized) return null;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function optimizationSessionHash(value) {
  const source = String(value ?? '');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function optimizationSessionError(message, code) {
  const value = new Error(message);
  if (code) value.code = code;
  return value;
}

export function optimizationSessionResult(data = null, error = null, metadata = {}) {
  return { data, error, ...metadata };
}

export function cloneOptimizationSessionValue(value) {
  if (Array.isArray(value)) return value.map(cloneOptimizationSessionValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      cloneOptimizationSessionValue(entry),
    ]),
  );
}
