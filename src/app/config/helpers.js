import { Quote, Report, HistoryEngine } from '../../lib/br-engine/index.js';
import { APP_VERSION_QUERY, BRAND_NAME, HISTORY_API } from './constants.js';
import {
  catalogDefaults,
  defaultTypeDetails,
  defaults,
  objetivos,
  tiposPorGiro,
  tonos,
} from './data.js';

export function clean(value, fallback = '') {
  return String(value || fallback).trim();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isRemoteQuoteId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    .test(String(value || ''));
}

export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  const code = String(error?.code || '').toUpperCase();
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const description = `${message} ${details}`;

  if (
    code === '23505'
    || code === 'QUOTE_VERSION_CONFLICT'
    || code === 'PRODUCTION_ORDER_VERSION_CONFLICT'
    || code === '42501'
    || description.includes('row-level security')
    || description.includes('permission denied')
  ) {
    return false;
  }

  return name === 'aborterror'
    || name === 'timeouterror'
    || name === 'networkerror'
    || ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'NETWORK_ERROR', 'FETCH_ERROR']
      .includes(code)
    || description.includes('failed to fetch')
    || description.includes('fetch failed')
    || description.includes('network request failed')
    || description.includes('networkerror')
    || description.includes('timeout')
    || description.includes('timed out');
}

export function queuedCreateMatchesRow(row, payload) {
  if (!row || !payload || row.folio !== payload.folio) return false;

  try {
    return row.status === payload.status
      && row.client_name === payload.client_name
      && row.client_phone === payload.client_phone
      && row.product_name === payload.product_name
      && Number(row.total) === Number(payload.total)
      && Number(row.deposit) === Number(payload.deposit)
      && Number(row.balance) === Number(payload.balance)
      && JSON.stringify(row.form_data || {}) === JSON.stringify(payload.form_data || {});
  } catch {
    return false;
  }
}

const QUOTE_FIELD_DELETED = Symbol('quote-field-deleted');

export function quoteValuesEqual(left, right) {
  if (Object.is(left, right)) return true;

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function isNumericQuoteFieldPath(fieldPath) {
  const path = String(fieldPath || '');

  const topLevelNumericFields = new Set([
    'ancho',
    'alto',
    'fondo',
    'grosorMaterial',
    'cantidad',
    'precioM2',
    'costoMaterialM2',
    'merma',
    'margenMaterial',
    'costoHerrajes',
    'precioHerrajes',
    'manoObra',
    'extras',
    'descuento',
    'anticipo',
    'vigencia',
  ]);

  if (topLevelNumericFields.has(path)) return true;

  return /^(measureItems|materialItems|accessoryItems|planItems)\.[^.]+\.(ancho|alto|fondo|grosorMaterial|cantidad|grosor|costoUnitario|precioUnitario|merma|margen)$/.test(path);
}

export function quoteFieldValuesEqual(fieldPath, left, right) {
  if (isNumericQuoteFieldPath(fieldPath)) {
    if (left === '' || left === null || left === undefined) {
      return right === '' || right === null || right === undefined;
    }

    if (right === '' || right === null || right === undefined) {
      return false;
    }

    const leftNumber = Number(left);
    const rightNumber = Number(right);

    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
  }

  return quoteValuesEqual(left, right);
}

export function quoteFormChanges(baseForm = {}, nextForm = {}) {
  const changes = new Map();
  const keys = new Set([
    ...Object.keys(baseForm || {}),
    ...Object.keys(nextForm || {}),
  ]);

  keys.forEach((key) => {
    const baseValue = baseForm?.[key];
    const nextValue = nextForm?.[key];
    const keyedArrays = Array.isArray(baseValue)
      && Array.isArray(nextValue)
      && [...baseValue, ...nextValue].every((item) => item?.id);

    if (!keyedArrays) {
      if (!quoteValuesEqual(baseValue, nextValue)) changes.set(key, nextValue);
      return;
    }

    const baseById = new Map(baseValue.map((item) => [String(item.id), item]));
    const nextById = new Map(nextValue.map((item) => [String(item.id), item]));
    const ids = new Set([...baseById.keys(), ...nextById.keys()]);

    ids.forEach((id) => {
      const baseItem = baseById.get(id);
      const nextItem = nextById.get(id);
      const itemPath = `${key}.${id}`;

      if (!nextItem) {
        changes.set(itemPath, QUOTE_FIELD_DELETED);
        return;
      }
      if (!baseItem) {
        changes.set(itemPath, nextItem);
        return;
      }

      const itemKeys = new Set([
        ...Object.keys(baseItem),
        ...Object.keys(nextItem),
      ]);
      itemKeys.forEach((itemKey) => {
        if (!quoteValuesEqual(baseItem[itemKey], nextItem[itemKey])) {
          changes.set(`${itemPath}.${itemKey}`, nextItem[itemKey]);
        }
      });
    });
  });

  return changes;
}

export function quoteFormValue(form, path) {
  const [field, itemId, itemField] = String(path || '').split('.');
  if (!field) return undefined;
  if (!itemId) return form?.[field];

  const item = Array.isArray(form?.[field])
    ? form[field].find((entry) => String(entry?.id) === itemId)
    : undefined;
  return itemField ? item?.[itemField] : item;
}

export function withQuoteFormValue(form, path, value) {
  const [field, itemId, itemField] = String(path || '').split('.');
  if (!field) return form;
  if (!itemId) return { ...form, [field]: value };

  const items = Array.isArray(form?.[field]) ? form[field] : [];
  if (!itemField) {
    const withoutItem = items.filter((entry) => String(entry?.id) !== itemId);
    return {
      ...form,
      [field]: value === QUOTE_FIELD_DELETED ? withoutItem : [...withoutItem, value],
    };
  }

  return {
    ...form,
    [field]: items.map((entry) => (
      String(entry?.id) === itemId ? { ...entry, [itemField]: value } : entry
    )),
  };
}

export function positiveNumber(value) {
  return Math.max(0, numberValue(value));
}

export function percentValue(value) {
  return Math.min(100, Math.max(0, numberValue(value)));
}

export const quoteHelpers = {
  clean,
  numberValue,
  positiveNumber,
  percentValue,
  money,
  decimal,
};

export const historyHelpers = {
  clean,
  numberValue,
  defaults,
  historyApi: import.meta.env.VITE_HISTORY_API_URL || HISTORY_API,
};

export function formatDimensions(data) {
  const rows = Quote.measurementItemsFromForm(data, quoteHelpers);
  const parts = rows.map((item) => [
    item.nombre,
    item.ancho > 0 ? `${item.ancho} cm ancho` : null,
    item.alto > 0 ? `${item.alto} cm alto` : null,
    item.fondo > 0 ? `${item.fondo} cm fondo` : null,
    item.grosorMaterial > 0 ? `${item.grosorMaterial} mm grosor` : null,
    item.cantidad > 1 ? `${item.cantidad} pzas` : null,
  ].filter(Boolean).join(' · '));

  return parts.length ? parts.join(' | ') : 'medidas por confirmar';
}

export const planHelpers = {
  clean,
  numberValue,
  escapeHtml,
  formatDimensions,
};

export function uniqueByValue(items) {
  return [...new Set(items.map((item) => clean(item)).filter(Boolean))];
}

export function typeOptionsFor(giro, typeDetails = []) {
  return uniqueByValue([
    ...(tiposPorGiro[giro] || tiposPorGiro.Carpintería),
    ...typeDetails.filter((item) => item.giro === giro).map((item) => item.tipo),
  ]);
}

export function money(value) {
  const numeric = Number(value) || 0;
  const sign = numeric < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(Math.abs(Math.round(numeric)))}`;
}

export function decimal(value, digits = 2) {
  return (Number(value) || 0).toFixed(digits);
}

export function normalizeHash(value) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '');
}

export function hashtags(data) {
  const base = data.giro === 'Vidriería'
    ? ['#Vidrieria', '#Cristal', '#VidrioTemplado', '#Canceles', '#AluminioYVidrio']
    : ['#Carpinteria', '#MueblesAMedida', '#Carpintero', '#DiseñoDeInteriores', '#Muebles'];
  const city = normalizeHash(data.ciudad);
  const product = normalizeHash(data.producto);
  const type = normalizeHash(data.tipoTrabajo);
  return [...base, city ? `#${city}` : null, type ? `#${type}` : null, product ? `#${product}` : null].filter(Boolean).join(' ');
}

export function sentenceJoin(parts) {
  return parts.filter(Boolean).join('\n');
}

export function contactLine(whatsapp) {
  return whatsapp ? `WhatsApp: ${whatsapp}` : 'Escríbenos por mensaje directo';
}

export const reportHelpers = {
  tonos,
  objetivos,
  money,
  decimal,
  clean,
  numberValue,
  formatDimensions,
  hashtags,
  sentenceJoin,
  contactLine,
};

export const pdfHelpers = {
  brandName: BRAND_NAME,
  clean,
  escapeHtml,
  money,
  numberValue,
  professionalDocFromQuote: Report.professionalDocFromQuote,
  professionalDocHelpers: reportHelpers,
};

export function countScore(data) {
  const fields = ['producto', 'material', 'medidas', 'acabado', 'ciudad', 'beneficio', 'incluye', 'ancho', 'alto', 'fondo', 'precioM2'];
  return fields.reduce((score, field) => score + (clean(data[field]).length > 0 ? 1 : 0), 0);
}

export function quoteDataHealth(data, quote) {
  const required = [
    { label: 'Cliente', value: data.clienteNombre },
    { label: 'Teléfono', value: data.clienteTelefono || data.whatsapp },
    { label: 'Producto', value: data.producto },
    { label: 'Tipo de trabajo', value: data.tipoTrabajo },
    { label: 'Material', value: data.materialCotizacion || data.material },
    { label: 'Medidas', value: data.medidas },
    { label: 'Ancho', value: data.ancho },
    { label: 'Alto', value: data.alto },
    { label: 'Precio por m²', value: data.precioM2 },
    { label: 'Mano de obra', value: data.manoObra },
  ];

  const present = required.filter((item) => item.value !== '' && item.value !== null && item.value !== undefined && Number(item.value) !== 0);
  const missing = required.filter((item) => !present.includes(item));
  const warnings = [];

  if (quote.total <= 0) warnings.push('El total cliente está en cero.');
  if (quote.profit < 0) warnings.push('La utilidad estimada es negativa.');
  if (!data.clienteNombre) warnings.push('Falta nombre del cliente.');
  if (!data.clienteTelefono && !data.whatsapp) warnings.push('Falta teléfono o WhatsApp.');
  if (quote.areaTotal <= 0) warnings.push('El área total está en cero.');
  if (quote.material <= 0) warnings.push('El material no está generando precio.');
  if (quote.manoObra <= 0) warnings.push('La mano de obra está en cero.');

  return {
    present,
    missing,
    warnings,
    score: Math.round((present.length / required.length) * 100),
  };
}

export function marginPercentFromSaleAndCost(saleTotal, costTotal) {
  const sale = numberValue(saleTotal);
  const cost = numberValue(costTotal);
  if (sale <= 0) return 0;
  return ((sale - cost) / sale) * 100;
}

export function normalizeCatalogItem(item) {
  return {
    materialCotizacion: 'Material',
    herrajes: 'Sin herrajes',
    costoHerrajes: 0,
    precioHerrajes: 0,
    ...item,
  };
}

export const storageHelpers = {
  catalogDefaults,
  defaultTypeDetails,
  normalizeCatalogItem,
  normalizeHistory: HistoryEngine.normalizeHistory,
};

export const analysisHelpers = {
  money,
  decimal,
  percentValue,
};

export function refreshInstalledApp() {
  const clearCaches = 'caches' in window
    ? caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
    : Promise.resolve();
  const clearWorkers = 'serviceWorker' in navigator
    ? navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    : Promise.resolve();

  Promise.all([clearCaches, clearWorkers]).finally(() => {
    window.location.href = `${window.location.origin}${window.location.pathname}?v=${APP_VERSION_QUERY}`;
  });
}


