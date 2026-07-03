export function normalizeHistory(items) {
  if (!Array.isArray(items)) return [];

  const unique = new Map();

  items.forEach((item) => {
    if (!item?.id) return;

    const createdAt = item.createdAt || Number(String(item.id).replace(/\D/g, '')) || Date.now();

    unique.set(item.id, {
      ...item,
      createdAt,
      updatedAt: item.updatedAt || createdAt,
      status: item.status || 'Pendiente',
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
    .slice(0, 200);
}

export function mergeHistoryItems(...lists) {
  const unique = new Map();

  normalizeHistory(lists.flat()).forEach((item) => {
    const current = unique.get(item.id);
    const currentTime = Number(current?.updatedAt || current?.createdAt || 0);
    const nextTime = Number(item.updatedAt || item.createdAt || 0);

    if (!current || nextTime >= currentTime) {
      unique.set(item.id, item);
    }
  });

  return normalizeHistory(Array.from(unique.values()));
}

export function recoverLegacyHistoryFromLocalStorage(helpers = {}) {
  const { clean, numberValue, defaults = {} } = helpers;
  if (typeof window === 'undefined' || !window.localStorage) return [];

  const recovered = [];
  const legacyKeyPattern = /aluxor|anunciapro|historial|history|cotizacion|cotizaciones|quote|quotes/i;
  const collectionKeys = ['history', 'historial', 'cotizaciones', 'quotes', 'items', 'data', 'records', 'results'];
  const timestamp = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');
  const toNumber = (...values) => numberValue(firstValue(...values) || 0);
  const normalizeLegacyItem = (item, key, index) => {
    if (!item || typeof item !== 'object') return null;

    const form = item.form && typeof item.form === 'object' ? item.form : item;
    const createdAt = timestamp(firstValue(item.createdAt, item.fecha, item.date, item.created_at)) || Date.now();
    const updatedAt = timestamp(firstValue(item.updatedAt, item.updated_at, item.modificadoEn)) || createdAt;
    const total = toNumber(item.total, item.totalCotizacion, item.precioTotal, item.monto, item.amount, form.total);
    const anticipo = toNumber(item.anticipo, item.deposit, item.abono, form.anticipo);
    const resto = toNumber(item.resto, item.rest, item.saldo, total - anticipo);

    return {
      id: String(firstValue(item.id, item.uuid, item.folio, `legacy-${key}-${createdAt}-${index}`)),
      createdAt,
      updatedAt,
      status: firstValue(item.status, item.estado, 'Pendiente'),
      clienteNombre: clean(firstValue(item.clienteNombre, item.cliente, item.nombreCliente, item.clientName, form.clienteNombre), 'Cliente'),
      clienteTelefono: clean(firstValue(item.clienteTelefono, item.telefono, item.phone, item.whatsapp, form.clienteTelefono)),
      producto: clean(firstValue(item.producto, item.proyecto, item.product, item.title, form.producto), 'Proyecto a medida'),
      tipoTrabajo: clean(firstValue(item.tipoTrabajo, item.tipo, item.workType, form.tipoTrabajo), 'Trabajo'),
      giro: clean(firstValue(item.giro, item.categoria, item.category, form.giro), 'Carpintería'),
      total,
      anticipo,
      resto,
      form: { ...defaults, ...form },
      recoveredFrom: key,
    };
  };

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !legacyKeyPattern.test(key)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed)
        ? parsed
        : collectionKeys.map((name) => parsed?.[name]).find(Array.isArray) || [];

      if (Array.isArray(items)) {
        recovered.push(...items.map((item, index) => normalizeLegacyItem(item, key, index)).filter(Boolean));
      }
    } catch {
      // Ignorar llaves viejas que no sean JSON.
    }
  }

  return normalizeHistory(recovered);
}

export async function requestHistory(options = {}, helpers = {}) {
  const configuredHistoryApi = import.meta?.env?.VITE_HISTORY_API_URL;
  const { historyApi = configuredHistoryApi || '/api/history' } = helpers;
  const response = await fetch(historyApi, {
    cache: 'no-store',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error('No se pudo sincronizar el historial');
  }

  if (!contentType.includes('application/json')) {
    throw new Error('Servidor de historial no disponible; usando copia local');
  }

  const data = await response.json();
  return normalizeHistory(data.history || []);
}
