import { PURCHASE_STATUSES, normalizePurchaseStatus } from './purchaseSummary.js';

function object(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function date(value, fallback = '') {
  if (!value) return fallback;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function positiveInteger(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : fallback;
}

function clone(value, fallback) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

const PURCHASE_GROUP_ORDER = new Map([
  ['Maderas', 0],
  ['Aluminio', 1],
  ['Vidrio', 2],
  ['Herrajes', 3],
  ['Consumibles', 4],
  ['Materiales', 5],
  ['Otro', 6],
]);

export function normalizePurchaseGroup(value = '') {
  const label = text(value).toLocaleLowerCase('es-MX');
  if (/madera|melamina|triplay|mdf/.test(label)) return 'Maderas';
  if (/aluminio|perfil|ptr|metal|herrer/.test(label)) return 'Aluminio';
  if (/vidrio|cristal/.test(label)) return 'Vidrio';
  if (/tornillo|silic[oó]n|taquete|consumible/.test(label)) return 'Consumibles';
  return text(value) || 'Materiales';
}

export function purchaseQuantityFromMaterial(item = {}) {
  const type = text(item.tipoCompra || item.calculo).toLocaleLowerCase('es-MX');
  if (type === 'hoja' || type === 'placa') {
    return { quantity: number(item.hojasNecesarias), unit: 'hoja' };
  }
  if (type === 'lineal') {
    return { quantity: number(item.metrosNecesarios || item.rowQuantity), unit: 'm' };
  }
  if (type === 'area') {
    return { quantity: number(item.rowQuantity), unit: 'm²' };
  }
  return {
    quantity: number(item.piezasNecesarias || item.rowQuantity),
    unit: text(item.unidad || item.tipoCompra) || 'pieza',
  };
}

export function buildPurchaseItems(quote = {}) {
  const materials = Array.isArray(quote?.materialRows) ? quote.materialRows : [];
  const accessories = Array.isArray(quote?.accessoryRows) ? quote.accessoryRows : [];

  return [
    ...materials.map((item, index) => {
      const quantity = purchaseQuantityFromMaterial(item);
      const totalCost = number(item.costTotal);
      return normalizePurchaseItem({
        id: `purchase-item-material-${text(item.id) || index}`,
        sourceType: 'material',
        sourceId: text(item.id) || `material-${index}`,
        group: normalizePurchaseGroup(item.categoria || item.nombre),
        name: item.nombre,
        unit: quantity.unit,
        quantity: quantity.quantity,
        unitCost: quantity.quantity > 0 ? totalCost / quantity.quantity : 0,
        totalCost,
        status: PURCHASE_STATUSES.PENDING,
        notes: item.nota,
      });
    }),
    ...accessories.map((item, index) => {
      const quantity = number(item.rowQuantity || item.cantidad);
      const totalCost = number(item.costTotal);
      return normalizePurchaseItem({
        id: `purchase-item-accessory-${text(item.id) || index}`,
        sourceType: 'accessory',
        sourceId: text(item.id) || `accessory-${index}`,
        group: 'Herrajes',
        name: item.nombre,
        unit: text(item.tipoCompra || item.unidad) || 'pieza',
        quantity,
        unitCost: quantity > 0 ? totalCost / quantity : 0,
        totalCost,
        status: PURCHASE_STATUSES.PENDING,
        notes: item.nota,
      });
    }),
  ].filter((item) => item.name);
}

export function purchaseStatusFromItems(items = []) {
  const statuses = (Array.isArray(items) ? items : []).map((item) => (
    normalizePurchaseStatus(item?.status)
  ));
  if (statuses.length > 0 && statuses.every((status) => status === PURCHASE_STATUSES.RECEIVED)) {
    return PURCHASE_STATUSES.RECEIVED;
  }
  if (statuses.length > 0 && statuses.every((status) => status !== PURCHASE_STATUSES.PENDING)) {
    return PURCHASE_STATUSES.PURCHASED;
  }
  return PURCHASE_STATUSES.PENDING;
}

export function generatePurchaseNumber(purchases = [], value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  const current = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const key = `${current.getFullYear()}${String(current.getMonth() + 1).padStart(2, '0')}${String(current.getDate()).padStart(2, '0')}`;
  const pattern = new RegExp(`^OC-${key}-(\\d+)$`);
  const maximum = (Array.isArray(purchases) ? purchases : []).reduce((max, purchase) => {
    const match = text(purchase?.folio).match(pattern);
    return match ? Math.max(max, Number(match[1]) || 0) : max;
  }, 0);
  return `OC-${key}-${String(maximum + 1).padStart(3, '0')}`;
}

export function normalizePurchaseItem(item = {}) {
  const source = object(item) ? item : {};
  const quantity = number(source.quantity);
  const unitCost = number(source.unitCost);
  return {
    id: text(source.id),
    workspaceId: text(source.workspaceId),
    purchaseId: text(source.purchaseId),
    sourceType: source.sourceType === 'accessory' ? 'accessory' : 'material',
    sourceId: text(source.sourceId),
    group: normalizePurchaseGroup(source.group),
    name: text(source.name),
    unit: text(source.unit) || 'pieza',
    quantity,
    unitCost,
    totalCost: Object.prototype.hasOwnProperty.call(source, 'totalCost')
      ? number(source.totalCost)
      : quantity * unitCost,
    status: normalizePurchaseStatus(source.status),
    supplier: text(source.supplier),
    itemDate: date(source.itemDate),
    notes: text(source.notes),
    createdBy: text(source.createdBy),
    version: positiveInteger(source.version),
    createdAt: date(source.createdAt),
    updatedAt: date(source.updatedAt),
    ...(source.pendingSync ? { pendingSync: true } : {}),
    ...(Array.isArray(source.pendingFields)
      ? { pendingFields: [...new Set(source.pendingFields.map(text).filter(Boolean))] }
      : {}),
    ...(positiveInteger(source.pendingExpectedVersion, 0) > 0
      ? { pendingExpectedVersion: positiveInteger(source.pendingExpectedVersion) }
      : {}),
  };
}

export function comparePurchaseItems(left, right) {
  const leftGroup = PURCHASE_GROUP_ORDER.get(normalizePurchaseGroup(left?.group)) ?? 99;
  const rightGroup = PURCHASE_GROUP_ORDER.get(normalizePurchaseGroup(right?.group)) ?? 99;
  if (leftGroup !== rightGroup) return leftGroup - rightGroup;
  const leftCreated = Date.parse(left?.createdAt || '') || 0;
  const rightCreated = Date.parse(right?.createdAt || '') || 0;
  if (leftCreated !== rightCreated) return leftCreated - rightCreated;
  return text(left?.id).localeCompare(text(right?.id), 'es-MX');
}

export function sortPurchaseItems(items = []) {
  return [...(Array.isArray(items) ? items : [])].sort(comparePurchaseItems);
}

export function normalizePurchase(purchase = {}) {
  const source = object(purchase) ? purchase : {};
  return {
    id: text(source.id),
    workspaceId: text(source.workspaceId),
    productionOrderId: text(source.productionOrderId),
    productionOrderFolio: text(source.productionOrderFolio),
    quoteId: text(source.quoteId),
    clientName: text(source.clientName),
    projectName: text(source.projectName),
    folio: text(source.folio),
    supplier: text(source.supplier),
    status: normalizePurchaseStatus(source.status),
    orderedAt: date(source.orderedAt, null),
    expectedAt: date(source.expectedAt, null),
    receivedAt: date(source.receivedAt, null),
    notes: text(source.notes),
    active: source.active !== false,
    items: (Array.isArray(source.items) ? source.items : []).map(normalizePurchaseItem),
    createdBy: text(source.createdBy),
    version: positiveInteger(source.version),
    createdAt: date(source.createdAt),
    updatedAt: date(source.updatedAt),
    ...(source.pendingSync ? { pendingSync: true } : {}),
    ...(Array.isArray(source.pendingFields)
      ? { pendingFields: [...new Set(source.pendingFields.map(text).filter(Boolean))] }
      : {}),
    ...(positiveInteger(source.pendingExpectedVersion, 0) > 0
      ? { pendingExpectedVersion: positiveInteger(source.pendingExpectedVersion) }
      : {}),
  };
}

export function createPurchaseFromProductionOrder({
  productionOrder,
  quote,
  purchases = [],
  createdBy,
  now = new Date(),
} = {}) {
  const order = object(productionOrder) ? productionOrder : {};
  const createdAt = date(now, new Date().toISOString());
  const folio = generatePurchaseNumber(purchases, createdAt);
  const id = `purchase-${folio}-${Date.parse(createdAt)}`;
  const items = buildPurchaseItems(quote).map((item) => ({
    ...item,
    workspaceId: text(order.workspaceId),
    purchaseId: id,
    createdBy: text(createdBy),
    createdAt,
    updatedAt: createdAt,
  }));

  return normalizePurchase({
    id,
    workspaceId: order.workspaceId,
    productionOrderId: order.id,
    productionOrderFolio: order.folio,
    quoteId: order.quoteId,
    clientName: order.cliente,
    projectName: order.producto,
    folio,
    supplier: '',
    status: PURCHASE_STATUSES.PENDING,
    notes: '',
    items,
    createdBy,
    createdAt,
    updatedAt: createdAt,
    pendingSync: true,
  });
}

export function updatePurchase(purchase, changes = {}, now = new Date()) {
  const current = normalizePurchase(purchase);
  const source = object(changes) ? changes : {};
  return normalizePurchase({
    ...current,
    ...source,
    id: current.id,
    workspaceId: current.workspaceId,
    productionOrderId: current.productionOrderId,
    productionOrderFolio: current.productionOrderFolio,
    quoteId: current.quoteId,
    clientName: current.clientName,
    projectName: current.projectName,
    createdBy: current.createdBy,
    createdAt: current.createdAt,
    items: Object.prototype.hasOwnProperty.call(source, 'items')
      ? clone(source.items, current.items)
      : current.items,
    updatedAt: date(now, new Date().toISOString()),
  });
}
