import {
  receptionFromStorageRecord,
  receptionToStorageRecord,
} from './receptionAdapter.js';
import { selectNewestReception } from './receptionVersioning.js';

const STORAGE_PREFIX = 'aluxor.receptions';
const STORAGE_VERSION = 1;

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function key(workspaceId) {
  return `${STORAGE_PREFIX}.${String(workspaceId || '').trim()}`;
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, String(value)),
    removeItem: (name) => values.delete(name),
  };
}

export function createReceptionStorage({
  storage = browserStorage() || createMemoryStorage(),
} = {}) {
  function normalizeList(workspaceId, receptions) {
    const byId = new Map();
    (Array.isArray(receptions) ? receptions : []).forEach((entry) => {
      const adapted = receptionFromStorageRecord(entry);
      if (adapted.error || adapted.data.workspaceId !== workspaceId) return;
      byId.set(
        adapted.data.id,
        selectNewestReception(byId.get(adapted.data.id), adapted.data),
      );
    });
    return [...byId.values()].sort((left, right) => (
      Date.parse(right.updatedAt || '') - Date.parse(left.updatedAt || '')
      || left.id.localeCompare(right.id)
    ));
  }

  function load(workspaceId) {
    if (!workspaceId) return [];
    try {
      const parsed = JSON.parse(storage.getItem(key(workspaceId)) || 'null');
      return normalizeList(
        workspaceId,
        Array.isArray(parsed) ? parsed : parsed?.receptions,
      );
    } catch {
      return [];
    }
  }

  function save(workspaceId, receptions) {
    const normalized = normalizeList(workspaceId, receptions);
    storage.setItem(key(workspaceId), JSON.stringify({
      version: STORAGE_VERSION,
      receptions: normalized.map(receptionToStorageRecord),
    }));
    return normalized;
  }

  function upsert(workspaceId, reception) {
    const current = load(workspaceId);
    const existing = current.find((item) => item.id === reception?.id);
    const candidate = selectNewestReception(existing, reception);
    if (!candidate || candidate.workspaceId !== workspaceId) return null;
    const next = existing
      ? current.map((item) => (item.id === candidate.id ? candidate : item))
      : [...current, candidate];
    return save(workspaceId, next).find((item) => item.id === candidate.id);
  }

  function remove(workspaceId, receptionId) {
    return save(
      workspaceId,
      load(workspaceId).filter((item) => item.id !== receptionId),
    );
  }

  function replaceWorkspace(workspaceId, receptions) {
    return save(workspaceId, receptions);
  }

  return Object.freeze({ load, save, upsert, remove, replaceWorkspace });
}

export const ReceptionStorage = createReceptionStorage();
