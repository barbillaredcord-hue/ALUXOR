export const PRODUCTION_STATUSES = Object.freeze({
  PENDING: 'Pendiente',
  SCHEDULED: 'Programada',
  CUTTING: 'En corte',
  FABRICATING: 'Fabricando',
  ASSEMBLY: 'Armado',
  READY: 'Listo',
  DELIVERED: 'Entregado',
});

const productionStatuses = Object.freeze(Object.values(PRODUCTION_STATUSES));

const PRODUCTION_PRIORITIES = Object.freeze([
  'Normal',
  'Alta',
  'Urgente',
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function toIsoDate(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function cloneValue(value, seen = new WeakMap()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value instanceof Date) return new Date(value.getTime());

  const copy = Array.isArray(value) ? [] : {};
  seen.set(value, copy);

  Object.entries(value).forEach(([key, entry]) => {
    copy[key] = cloneValue(entry, seen);
  });

  return copy;
}

function normalizeTimeline(timeline) {
  if (!Array.isArray(timeline)) return [];

  return timeline
    .filter(isObject)
    .map((entry) => ({
      evento: clean(entry.evento),
      fecha: toIsoDate(entry.fecha),
      usuario: clean(entry.usuario),
      comentario: clean(entry.comentario),
    }))
    .filter((entry) => entry.evento);
}

function normalizeQuoteVersion(value) {
  const version = Number(value);
  return Number.isInteger(version) && version >= 1 ? version : 1;
}

export function productionStatusOptions() {
  return [...productionStatuses];
}

export function productionPriorityOptions() {
  return [...PRODUCTION_PRIORITIES];
}

export function cloneQuoteSnapshot(snapshot) {
  if (!isObject(snapshot)) return {};

  try {
    return cloneValue(snapshot);
  } catch {
    return {};
  }
}

export function normalizeProductionStatus(status) {
  return productionStatuses.includes(status) ? status : PRODUCTION_STATUSES.PENDING;
}

export function generateProductionOrderNumber(orders = [], date = new Date()) {
  const referenceDate = date instanceof Date ? date : new Date(date);
  const validDate = Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate;
  const dateKey = [
    validDate.getFullYear(),
    String(validDate.getMonth() + 1).padStart(2, '0'),
    String(validDate.getDate()).padStart(2, '0'),
  ].join('');
  const pattern = new RegExp(`^OT-${dateKey}-(\\d+)$`);
  const maximum = (Array.isArray(orders) ? orders : []).reduce((current, order) => {
    const folio = clean(typeof order === 'string' ? order : order?.folio);
    const match = folio.match(pattern);
    if (!match) return current;

    const consecutive = Number(match[1]);
    return Number.isInteger(consecutive) ? Math.max(current, consecutive) : current;
  }, 0);

  return `OT-${dateKey}-${String(maximum + 1).padStart(3, '0')}`;
}

export function normalizeProductionOrder(order = {}) {
  const source = isObject(order) ? order : {};
  const estado = normalizeProductionStatus(source.estado);
  const prioridad = PRODUCTION_PRIORITIES.includes(source.prioridad) ? source.prioridad : 'Normal';

  return {
    id: clean(source.id),
    quoteId: clean(source.quoteId),
    workspaceId: clean(source.workspaceId),
    folio: clean(source.folio),
    estado,
    prioridad,
    responsable: clean(source.responsable),
    cliente: clean(source.cliente),
    producto: clean(source.producto),
    fechaCreacion: toIsoDate(source.fechaCreacion),
    fechaCompromiso: toIsoDate(source.fechaCompromiso),
    fechaInicio: toIsoDate(source.fechaInicio),
    fechaFinal: toIsoDate(source.fechaFinal),
    observaciones: clean(source.observaciones),
    timeline: normalizeTimeline(source.timeline),
    formSnapshot: cloneQuoteSnapshot(source.formSnapshot),
    quoteVersion: normalizeQuoteVersion(source.quoteVersion),
    createdBy: clean(source.createdBy),
    updatedAt: toIsoDate(source.updatedAt),
  };
}

export function createProductionOrder(input = {}, existingOrders = []) {
  const source = isObject(input) ? input : {};
  const now = toIsoDate(source.fechaCreacion, new Date().toISOString());
  const folio = clean(source.folio) || generateProductionOrderNumber(existingOrders, now);
  const createdBy = clean(source.createdBy);
  const timeline = normalizeTimeline(source.timeline);
  const creationEvent = {
    evento: 'Orden creada',
    fecha: now,
    usuario: createdBy,
    comentario: clean(source.observaciones),
  };

  if (timeline[0]?.evento === 'Orden creada') {
    timeline[0] = {
      ...creationEvent,
      ...timeline[0],
      fecha: timeline[0].fecha || now,
      usuario: timeline[0].usuario || createdBy,
    };
  } else {
    timeline.unshift(creationEvent);
  }

  return normalizeProductionOrder({
    ...source,
    id: clean(source.id) || `production-${folio}-${Date.parse(now)}`,
    folio,
    fechaCreacion: now,
    timeline,
    formSnapshot: source.formSnapshot ?? source.quote?.form ?? {},
    quoteId: source.quoteId ?? source.quote?.id,
    quoteVersion: source.quoteVersion ?? source.quote?.version,
    createdBy,
    updatedAt: now,
  });
}

export function updateProductionOrder(order, changes = {}, updatedAt = new Date()) {
  const current = normalizeProductionOrder(order);
  const next = isObject(changes) ? changes : {};
  const timestamp = toIsoDate(updatedAt, new Date().toISOString());

  const incomingTimeline = normalizeTimeline(next.timeline);
  const mergedTimeline = [...current.timeline];

  incomingTimeline.forEach((entry) => {
    const duplicated = mergedTimeline.some((currentEntry) => (
      currentEntry.evento === entry.evento
      && currentEntry.fecha === entry.fecha
      && currentEntry.usuario === entry.usuario
      && currentEntry.comentario === entry.comentario
    ));

    if (!duplicated) {
      mergedTimeline.push(entry);
    }
  });

  return normalizeProductionOrder({
    ...current,
    ...next,
    id: current.id,
    quoteId: current.quoteId,
    workspaceId: current.workspaceId,
    folio: current.folio,
    fechaCreacion: current.fechaCreacion,
    createdBy: current.createdBy,
    formSnapshot: Object.prototype.hasOwnProperty.call(next, 'formSnapshot')
      ? next.formSnapshot
      : current.formSnapshot,
    timeline: mergedTimeline,
    updatedAt: timestamp,
  });
}

export function isProductionOrder(value) {
  if (!isObject(value)) return false;

  const requiredFields = [
    'id', 'quoteId', 'workspaceId', 'folio', 'estado', 'prioridad',
    'responsable', 'cliente', 'producto', 'fechaCreacion', 'fechaCompromiso',
    'fechaInicio', 'fechaFinal', 'observaciones', 'timeline', 'formSnapshot',
    'quoteVersion', 'createdBy', 'updatedAt',
  ];

  return requiredFields.every((field) => Object.prototype.hasOwnProperty.call(value, field))
    && clean(value.id) !== ''
    && /^OT-\d{8}-\d{3,}$/.test(clean(value.folio))
    && productionStatuses.includes(value.estado)
    && PRODUCTION_PRIORITIES.includes(value.prioridad)
    && Array.isArray(value.timeline)
    && isObject(value.formSnapshot);
}
