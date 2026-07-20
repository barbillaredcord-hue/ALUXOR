const placeholderNames = new Set([
  'cliente',
  'cliente pendiente',
]);

function cleanText(value) {
  if (value === null || value === undefined) return '';

  try {
    return String(value).trim().replace(/\s+/g, ' ');
  } catch {
    return '';
  }
}

function timestamp(record) {
  const value = record?.updatedAt ?? record?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeCustomerName(value) {
  const name = cleanText(value);
  if (placeholderNames.has(name.toLocaleLowerCase('es-MX'))) return '';
  return name;
}

export function normalizeCustomerPhone(value) {
  return cleanText(value).replace(/\D/g, '');
}

function customerData(record) {
  const form = record?.form_data ?? record?.form ?? {};
  const name = normalizeCustomerName(
    record?.clienteNombre
      ?? record?.client_name
      ?? record?.clientName
      ?? record?.cliente
      ?? record?.nombreCliente
      ?? form?.clienteNombre
  );
  const phone = normalizeCustomerPhone(
    record?.clienteTelefono
      ?? record?.client_phone
      ?? record?.clientPhone
      ?? record?.telefono
      ?? record?.phone
      ?? record?.whatsapp
      ?? form?.clienteTelefono
      ?? form?.whatsapp
  );

  return { name, phone };
}

function customerKey(customer) {
  if (customer.phone) return `phone:${customer.phone}`;
  if (customer.name) return `name:${customer.name.toLocaleLowerCase('es-MX')}`;
  return null;
}

export function getCustomerSummary(records = []) {
  const summary = {
    total: 0,
    withPhone: 0,
    withoutPhone: 0,
    quotes: 0,
    updatedAt: null,
  };

  if (!Array.isArray(records)) return summary;

  const customers = new Map();
  let latestTimestamp = null;

  records.forEach((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;

    const customer = customerData(record);
    const key = customerKey(customer);
    if (!key) return;

    const current = customers.get(key);
    customers.set(key, {
      name: current?.name || customer.name,
      phone: current?.phone || customer.phone,
    });
    summary.quotes += 1;

    const recordTimestamp = timestamp(record);
    if (recordTimestamp !== null && (latestTimestamp === null || recordTimestamp > latestTimestamp)) {
      latestTimestamp = recordTimestamp;
    }
  });

  summary.total = customers.size;
  customers.forEach((customer) => {
    if (customer.phone) summary.withPhone += 1;
    else summary.withoutPhone += 1;
  });
  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
