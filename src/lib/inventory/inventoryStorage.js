import {
  inventoryMovementFromStorageRecord,
  inventoryMovementToStorageRecord,
} from './inventoryAdapter.js';
import { selectNewestInventoryMovement } from './inventoryVersioning.js';

const STORAGE_PREFIX = 'aluxor.inventoryMovements';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function browserStorage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createInventoryStorage({
  storage = browserStorage() || memoryStorage(),
} = {}) {
  const key = (workspaceId) => `${STORAGE_PREFIX}.${workspaceId}`;
  function normalize(workspaceId, records = []) {
    const byId = new Map();
    records.forEach((record) => {
      const adapted = inventoryMovementFromStorageRecord(record);
      if (adapted.error || adapted.data.workspaceId !== workspaceId) return;
      byId.set(adapted.data.id, selectNewestInventoryMovement(
        byId.get(adapted.data.id),
        adapted.data,
      ));
    });
    return [...byId.values()].sort((left, right) => (
      Date.parse(left.createdAt) - Date.parse(right.createdAt)
      || left.id.localeCompare(right.id)
    ));
  }
  function load(workspaceId) {
    if (!workspaceId) return [];
    try {
      const value = JSON.parse(storage.getItem(key(workspaceId)) || 'null');
      return normalize(workspaceId, Array.isArray(value) ? value : value?.movements || []);
    } catch {
      return [];
    }
  }
  function save(workspaceId, movements) {
    const normalized = normalize(workspaceId, movements);
    storage.setItem(key(workspaceId), JSON.stringify({
      version: 1,
      movements: normalized.map(inventoryMovementToStorageRecord),
    }));
    return normalized;
  }
  function upsert(workspaceId, movement) {
    const current = load(workspaceId);
    const previous = current.find((item) => item.id === movement?.id);
    const selected = selectNewestInventoryMovement(previous, movement);
    const next = previous
      ? current.map((item) => (item.id === selected.id ? selected : item))
      : [...current, selected];
    return save(workspaceId, next).find((item) => item.id === selected.id) || null;
  }
  function remove(workspaceId, movementId) {
    return save(workspaceId, load(workspaceId).filter((item) => item.id !== movementId));
  }
  return Object.freeze({ load, save, upsert, remove });
}

export const InventoryStorage = createInventoryStorage();
