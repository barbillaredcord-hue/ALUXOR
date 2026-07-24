const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function identityKey(value) {
  return normalizeEntityId(value).toLocaleLowerCase('en-US');
}

export function normalizeEntityId(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return UUID_PATTERN.test(normalized) ? normalized : '';
}

export function hasStableEntityId(entity) {
  return Boolean(normalizeEntityId(entity?.id));
}

export function assertStableEntityId(entity, context = 'entidad') {
  const id = normalizeEntityId(entity?.id);
  if (id) return id;

  const error = new Error(`${context} requiere un UUID estable.`);
  error.code = 'MISSING_STABLE_ENTITY_ID';
  throw error;
}

export function sameEntity(left, right) {
  const leftId = identityKey(left?.id);
  const rightId = identityKey(right?.id);
  return Boolean(leftId && rightId && leftId === rightId);
}

export function preserveEntityIdentity(current, incoming) {
  const currentId = normalizeEntityId(current?.id);
  const incomingId = normalizeEntityId(incoming?.id);
  return {
    ...(incoming && typeof incoming === 'object' ? incoming : {}),
    ...(currentId || incomingId ? { id: currentId || incomingId } : {}),
  };
}

export function findEntityById(collection, entityId) {
  const id = identityKey(entityId);
  if (!id || !Array.isArray(collection)) return null;
  return collection.find((entity) => identityKey(entity?.id) === id) || null;
}

export function indexEntitiesById(collection) {
  const index = new Map();
  (Array.isArray(collection) ? collection : []).forEach((entity) => {
    const id = identityKey(entity?.id);
    if (id && !index.has(id)) index.set(id, entity);
  });
  return index;
}

export function detectDuplicateIds(collection) {
  const groups = new Map();
  (Array.isArray(collection) ? collection : []).forEach((entity) => {
    const id = identityKey(entity?.id);
    if (!id) return;
    const entries = groups.get(id) || [];
    entries.push(entity);
    groups.set(id, entries);
  });
  return Array.from(groups.entries())
    .filter(([, entities]) => entities.length > 1)
    .map(([id, entities]) => ({ id, entities }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function detectDuplicateBusinessReferences(collection, selector) {
  if (typeof selector !== 'function') return [];
  const groups = new Map();
  (Array.isArray(collection) ? collection : []).forEach((entity) => {
    const reference = String(selector(entity) ?? '').trim();
    if (!reference) return;
    const workspaceId = String(entity?.workspaceId ?? entity?.workspace_id ?? '').trim();
    const key = `${workspaceId}\u0000${reference}`;
    const group = groups.get(key) || { workspaceId, reference, entities: [] };
    group.entities.push(entity);
    groups.set(key, group);
  });
  return Array.from(groups.values())
    .filter((group) => new Set(group.entities.map((entity) => identityKey(entity?.id) || entity?.id)).size > 1)
    .sort((left, right) => (
      left.workspaceId.localeCompare(right.workspaceId)
      || left.reference.localeCompare(right.reference)
    ));
}

export function nextAvailableCommercialReference(
  candidate,
  collection = [],
  selector = (entity) => entity?.folio,
) {
  const initial = String(candidate ?? '').trim();
  if (!initial) return '';

  const occupied = new Set(
    (Array.isArray(collection) ? collection : [])
      .map((entity) => String(selector(entity) ?? '').trim())
      .filter(Boolean),
  );
  if (!occupied.has(initial)) return initial;

  const match = initial.match(/^(.*?)(\d+)$/);
  const prefix = match ? match[1] : `${initial}-`;
  const width = match ? match[2].length : 3;
  let consecutive = match ? Number.parseInt(match[2], 10) + 1 : 2;
  let reference = `${prefix}${String(consecutive).padStart(width, '0')}`;

  while (occupied.has(reference)) {
    consecutive += 1;
    reference = `${prefix}${String(consecutive).padStart(width, '0')}`;
  }

  return reference;
}

export const EntityIdentity = {
  normalizeEntityId,
  hasStableEntityId,
  assertStableEntityId,
  sameEntity,
  preserveEntityIdentity,
  findEntityById,
  indexEntitiesById,
  detectDuplicateIds,
  detectDuplicateBusinessReferences,
  nextAvailableCommercialReference,
};
