const STORAGE_PREFIX = 'aluxor.deletedEntities';

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

function normalize(entry, workspaceId) {
  const entityId = String(entry?.entityId || '').trim();
  const deletedAt = String(entry?.deletedAt || '').trim();
  if (
    !workspaceId
    || entry?.workspaceId !== workspaceId
    || entry?.entityType !== 'production_order'
    || !entityId
    || Number.isNaN(Date.parse(deletedAt))
  ) return null;
  return {
    workspaceId,
    entityType: 'production_order',
    entityId,
    deletedAt,
  };
}

export function createProductionDeletionRegistry({
  storage = browserStorage,
  now = () => new Date().toISOString(),
} = {}) {
  function load(workspaceId) {
    const normalizedWorkspaceId = String(workspaceId || '').trim();
    if (!normalizedWorkspaceId) return [];
    try {
      const values = JSON.parse(storage()?.getItem(key(normalizedWorkspaceId)) || '[]');
      return (Array.isArray(values) ? values : [])
        .map((entry) => normalize(entry, normalizedWorkspaceId))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function mark(workspaceId, entityId, deletedAt = now()) {
    const normalizedWorkspaceId = String(workspaceId || '').trim();
    const entry = normalize({
      workspaceId: normalizedWorkspaceId,
      entityType: 'production_order',
      entityId: String(entityId || '').trim(),
      deletedAt,
    }, normalizedWorkspaceId);
    if (!entry) return null;
    const next = [
      ...load(normalizedWorkspaceId).filter((item) => item.entityId !== entry.entityId),
      entry,
    ];
    try {
      storage()?.setItem(key(normalizedWorkspaceId), JSON.stringify(next));
    } catch {
      return entry;
    }
    return entry;
  }

  function contains(workspaceId, entityId) {
    const normalizedId = String(entityId || '').trim();
    return load(workspaceId).some((entry) => entry.entityId === normalizedId);
  }

  return Object.freeze({ load, mark, contains });
}

export const ProductionDeletionRegistry = createProductionDeletionRegistry();
