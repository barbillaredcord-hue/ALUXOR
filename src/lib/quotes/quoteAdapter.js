export const QUOTE_STATUSES = Object.freeze({
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  SENT: 'Enviada',
  IN_REVIEW: 'En revisión',
  ACCEPTED: 'Aceptada',
  CANCELLED: 'Cancelada',
});

const quoteCommercialStatuses = Object.freeze(Object.values(QUOTE_STATUSES));

const canonicalStatuses = new Map([
  ['borrador', QUOTE_STATUSES.DRAFT],
  ['pendiente', QUOTE_STATUSES.PENDING],
  ['enviada', QUOTE_STATUSES.SENT],
  ['en revisión', QUOTE_STATUSES.IN_REVIEW],
  ['aceptada', QUOTE_STATUSES.ACCEPTED],
  ['en fabricación', QUOTE_STATUSES.ACCEPTED],
  ['instalación', QUOTE_STATUSES.ACCEPTED],
  ['terminada', QUOTE_STATUSES.ACCEPTED],
  ['cancelada', QUOTE_STATUSES.CANCELLED],
  ['aprobada', QUOTE_STATUSES.ACCEPTED],
  ['instalada', QUOTE_STATUSES.ACCEPTED],
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clean(value, fallback = '') {
  if (value === null || value === undefined) return fallback;

  try {
    return String(value).trim() || fallback;
  } catch {
    return fallback;
  }
}

function firstStatus(...values) {
  return values.find((value) => clean(value)) || QUOTE_STATUSES.PENDING;
}

function numberValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;

  try {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function timestamp(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  try {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;

    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
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

function cloneFormData(value) {
  if (!isObject(value)) return {};

  try {
    return cloneValue(value);
  } catch {
    return {};
  }
}

function hasNumericValue(value) {
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'string' && !value.trim()) return false;

  try {
    return Number.isFinite(Number(value));
  } catch {
    return false;
  }
}

export function normalizeQuoteStatus(status) {
  const normalized = clean(status).toLocaleLowerCase('es-MX');
  return canonicalStatuses.get(normalized) || QUOTE_STATUSES.PENDING;
}

export function quoteCommercialStatusOptions() {
  return [...quoteCommercialStatuses];
}

export function normalizeQuotePayload(payload) {
  const source = isObject(payload) ? payload : {};
  const formData = cloneFormData(source.form_data);
  const status = normalizeQuoteStatus(firstStatus(
    source.status,
    formData.estadoCotizacion,
    QUOTE_STATUSES.PENDING,
  ));
  formData.estadoCotizacion = status;
  return { ...source, status, form_data: formData };
}

export function quoteRecordStatus(record) {
  const source = isObject(record) ? record : {};

  return normalizeQuoteStatus(firstStatus(
    source.status,
    source.estadoCotizacion,
    source.form_data?.estadoCotizacion,
    source.form?.estadoCotizacion,
    QUOTE_STATUSES.PENDING,
  ));
}

export function quoteRowToHistoryItem(row) {
  const source = isObject(row) ? row : {};
  const form = cloneFormData(source.form_data);
  const status = normalizeQuoteStatus(firstStatus(
    source.status,
    form.estadoCotizacion,
    QUOTE_STATUSES.PENDING,
  ));

  form.estadoCotizacion = status;

  return {
    id: source.id ?? '',
    legacyId: source.legacy_id ?? source.legacyId ?? '',
    createdAt: timestamp(source.created_at),
    updatedAt: timestamp(source.updated_at),
    status,
    folio: source.folio ?? '',
    estadoCotizacion: status,
    formaPago: clean(form.formaPago),
    notasCliente: clean(form.notasCliente),
    notasInternas: clean(form.notasInternas),
    clienteNombre: clean(source.client_name, 'Cliente'),
    clienteTelefono: clean(source.client_phone),
    producto: clean(source.product_name, 'Proyecto a medida'),
    tipoTrabajo: clean(form.tipoTrabajo, 'Trabajo'),
    giro: clean(form.giro, 'Carpintería'),
    total: numberValue(source.total),
    anticipo: numberValue(source.deposit),
    resto: numberValue(source.balance),
    version: numberValue(source.version, 1),
    form,
  };
}

export function historyItemToQuotePayload(item) {
  const source = isObject(item) ? item : {};
  const formData = cloneFormData(source.form);
  const status = normalizeQuoteStatus(firstStatus(
    source.estadoCotizacion,
    source.status,
    formData.estadoCotizacion,
    QUOTE_STATUSES.PENDING,
  ));

  formData.estadoCotizacion = status;

  return {
    folio: clean(source.folio),
    status,
    client_name: clean(source.clienteNombre, 'Cliente'),
    client_phone: clean(source.clienteTelefono),
    product_name: clean(source.producto, 'Proyecto a medida'),
    total: numberValue(source.total),
    deposit: numberValue(source.anticipo),
    balance: numberValue(source.resto),
    form_data: formData,
  };
}

export function quoteFormToPayload(input = {}) {
  const source = isObject(input) ? input : {};
  const { form, quote, workspaceId, folio } = source;

  if (!clean(workspaceId)) {
    return {
      workspaceId,
      payload: null,
      error: new Error('Falta el identificador del workspace.'),
    };
  }

  if (!isObject(form)) {
    return {
      workspaceId,
      payload: null,
      error: new Error('Faltan los datos del formulario.'),
    };
  }

  if (!clean(folio)) {
    return {
      workspaceId,
      payload: null,
      error: new Error('Falta el folio de la cotización.'),
    };
  }

  if (
    !isObject(quote)
    || !hasNumericValue(quote.total)
    || !hasNumericValue(quote.deposit)
    || !hasNumericValue(quote.rest)
  ) {
    return {
      workspaceId,
      payload: null,
      error: new Error('Faltan los resultados calculados de la cotización.'),
    };
  }

  const status = normalizeQuoteStatus(form.estadoCotizacion);
  const formData = cloneFormData(form);
  formData.estadoCotizacion = status;

  return {
    workspaceId,
    payload: {
      folio: clean(folio),
      status,
      client_name: clean(form.clienteNombre, 'Cliente'),
      client_phone: clean(form.clienteTelefono),
      product_name: clean(form.producto, 'Proyecto a medida'),
      total: numberValue(quote.total),
      deposit: numberValue(quote.deposit),
      balance: numberValue(quote.rest),
      form_data: formData,
    },
    error: null,
  };
}

export const QuoteAdapter = {
  quoteRowToHistoryItem,
  historyItemToQuotePayload,
  quoteFormToPayload,
  normalizeQuoteStatus,
  quoteRecordStatus,
  quoteCommercialStatusOptions,
  normalizeQuotePayload,
};
