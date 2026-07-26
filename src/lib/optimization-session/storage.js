import {
  optimizationSessionStorageRecordToModel,
  optimizationSessionToStorageRecord,
} from './adapter.js';
import {
  selectNewestOptimizationSession,
} from './versioning.js';

const STORAGE_PREFIX = 'aluxor.optimizationSessions';
const STORAGE_VERSION = 1;

function storage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function key(workspaceId) {
  return `${STORAGE_PREFIX}.${String(workspaceId || '').trim()}`;
}

function timestamp(session) {
  const value = Date.parse(session?.updatedAt || '');
  return Number.isFinite(value) ? value : 0;
}

function normalizeSessions(workspaceId, values) {
  if (!workspaceId || !Array.isArray(values)) return [];
  const byId = new Map();
  values.forEach((value) => {
    const hydrated = optimizationSessionStorageRecordToModel(value, { workspaceId });
    const session = hydrated.session;
    if (!hydrated.success || session.workspaceId !== workspaceId) return;
    byId.set(session.id, selectNewestOptimizationSession(byId.get(session.id), session));
  });
  return [...byId.values()].sort((left, right) => (
    timestamp(right) - timestamp(left)
    || right.version - left.version
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  ));
}

export function loadOptimizationSessions(workspaceId) {
  if (!workspaceId) return [];
  try {
    const raw = storage()?.getItem(key(workspaceId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const records = Array.isArray(parsed) ? parsed : parsed?.sessions;
    return normalizeSessions(workspaceId, records);
  } catch {
    return [];
  }
}

export function saveOptimizationSessions(workspaceId, sessions) {
  const normalized = normalizeSessions(workspaceId, sessions);
  const records = normalized
    .map(optimizationSessionToStorageRecord)
    .filter(Boolean);
  try {
    storage()?.setItem(key(workspaceId), JSON.stringify({
      version: STORAGE_VERSION,
      sessions: records,
    }));
  } catch {
    // La copia entregada al consumidor permanece disponible.
  }
  return normalized;
}

export function upsertOptimizationSession(workspaceId, session) {
  const hydrated = optimizationSessionStorageRecordToModel(session, { workspaceId });
  if (!hydrated.success || hydrated.session.workspaceId !== workspaceId) return null;
  const current = loadOptimizationSessions(workspaceId);
  const existing = current.find((item) => item.id === hydrated.session.id);
  const candidate = selectNewestOptimizationSession(existing, hydrated.session);
  const saved = saveOptimizationSessions(workspaceId, existing
    ? current.map((item) => (item.id === candidate.id ? candidate : item))
    : [...current, candidate]);
  return saved.find((item) => item.id === candidate.id) || null;
}

export function removeOptimizationSession(workspaceId, sessionId) {
  const id = String(sessionId || '').trim();
  if (!workspaceId || !id) return loadOptimizationSessions(workspaceId);
  return saveOptimizationSessions(
    workspaceId,
    loadOptimizationSessions(workspaceId).filter((session) => session.id !== id),
  );
}

export function replaceWorkspaceOptimizationSessions(workspaceId, sessions) {
  return saveOptimizationSessions(workspaceId, sessions);
}

export const OptimizationSessionStorage = {
  load: loadOptimizationSessions,
  save: saveOptimizationSessions,
  upsert: upsertOptimizationSession,
  remove: removeOptimizationSession,
  replaceWorkspace: replaceWorkspaceOptimizationSessions,
};
