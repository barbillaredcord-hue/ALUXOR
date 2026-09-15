import { normalizePurchaseItem } from './purchaseEngine.js';
import { createUuid } from '../identity/createUuid.js';
import { MATERIAL_TRACE_SOURCE_MODULES } from '../material-traceability/materialTraceabilityEngine.js';

export const PURCHASE_AMENDMENT_FIELDS = Object.freeze([
  'requiredQuantity', 'purchasedQuantity', 'purchasedAt', 'unitCost', 'supplier',
  'additionalCharges', 'discounts', 'unit', 'notes',
]);

const numericFields = new Set(['requiredQuantity', 'purchasedQuantity', 'unitCost', 'additionalCharges', 'discounts']);
const text = (value) => String(value ?? '').trim();
const equal = (left, right) => (numericFields.has(left)
  ? Number(right?.[0]) === Number(right?.[1])
  : String(right?.[0] ?? '') === String(right?.[1] ?? ''));

export function validatePurchasedQuantityAmendment({ currentPurchasedQuantity = 0, acceptedQuantity = 0, requestedPurchasedQuantity = 0 } = {}) {
  const current = Math.max(0, Number(currentPurchasedQuantity) || 0);
  const accepted = Math.max(0, Number(acceptedQuantity) || 0);
  const requested = Math.max(0, Number(requestedPurchasedQuantity) || 0);
  if (requested >= current) return { valid: true, reviewRequired: false, minimum: accepted };
  if (accepted > 0 && requested < accepted) return { valid: false, reviewRequired: true, minimum: accepted, message: `No puedes reducir la cantidad comprada a ${requested} porque ya existen ${accepted} unidades recibidas y aceptadas. Solicita una revisión administrativa y una corrección de Recepción.` };
  return { valid: true, reviewRequired: false, minimum: accepted };
}

export function buildPurchaseItemAmendment({
  workspaceId, purchase, purchaseItem, expectedVersion, previousValues = {},
  requestedChanges = {}, reason, notes = '', sourceModule, actorId = '', actorRole = '',
  timestamp = new Date().toISOString(), eventIdFactory = createUuid,
} = {}) {
  const item = normalizePurchaseItem(purchaseItem);
  if (Object.prototype.hasOwnProperty.call(requestedChanges, 'purchasedQuantity')) {
    const guard = validatePurchasedQuantityAmendment({ currentPurchasedQuantity: item.purchasedQuantity, acceptedQuantity: previousValues.acceptedQuantity ?? 0, requestedPurchasedQuantity: requestedChanges.purchasedQuantity });
    if (!guard.valid) throw new Error(guard.message);
  }
  if (!text(workspaceId) || !text(purchase?.id) || !item.id) throw new Error('Faltan identificadores de la corrección.');
  if (!Object.values(MATERIAL_TRACE_SOURCE_MODULES).includes(sourceModule)) throw new Error('El módulo de origen no es válido.');
  if (!text(reason)) throw new Error('La corrección requiere un motivo.');
  if (!Number.isInteger(expectedVersion) || expectedVersion !== item.version) throw new Error('La versión esperada no coincide con la partida.');
  const keys = Object.keys(requestedChanges);
  if (!keys.length || keys.some((field) => !PURCHASE_AMENDMENT_FIELDS.includes(field))) throw new Error('La corrección no contiene campos permitidos.');
  keys.forEach((field) => {
    if (!equal(field, [previousValues[field], item[field]])) throw new Error(`El valor previo de ${field} no coincide.`);
  });
  const changes = Object.fromEntries(keys.map((field) => [
    field,
    numericFields.has(field) ? Math.max(0, Number(requestedChanges[field]) || 0) : text(requestedChanges[field]),
  ]).filter(([field, value]) => !equal(field, [item[field], value])));
  if (!Object.keys(changes).length) throw new Error('La corrección no modifica la partida.');
  const eventType = Object.keys(changes).some((field) => ['requiredQuantity', 'purchasedQuantity', 'unit'].includes(field))
    ? 'PURCHASE_QUANTITY_AMENDED'
    : Object.keys(changes).some((field) => ['unitCost', 'additionalCharges', 'discounts'].includes(field))
      ? 'PURCHASE_PRICE_AMENDED'
      : 'PURCHASE_ITEM_AMENDED';
  const eventId = text(eventIdFactory());
  if (!eventId) throw new Error('No se pudo generar el UUID del evento.');
  const optimisticQuantity = Number(changes.purchasedQuantity ?? item.purchasedQuantity);
  const optimisticUnitCost = Number(changes.unitCost ?? item.unitCost);
  const optimisticCharges = Number(changes.additionalCharges ?? item.additionalCharges);
  const optimisticDiscounts = Number(changes.discounts ?? item.discounts);
  const optimisticTotal = Math.max(0,
    (optimisticQuantity * optimisticUnitCost) + optimisticCharges - optimisticDiscounts,
  );
  return {
    eventId, workspaceId: text(workspaceId), purchaseId: text(purchase.id),
    purchaseItemId: item.id, expectedVersion, previousValues: Object.fromEntries(Object.keys(changes).map((field) => [field, item[field]])),
    requestedChanges: changes, reason: text(reason), notes: text(notes), sourceModule,
    actorId: text(actorId), actorRole: text(actorRole), timestamp, eventType,
    optimisticItem: normalizePurchaseItem({ ...item, ...changes, totalCost: optimisticTotal, pendingSync: true,
      pendingFields: Object.keys(changes), pendingExpectedVersion: expectedVersion,
      pendingAmendment: { eventId, previousValues: Object.fromEntries(Object.keys(changes).map((field) => [field, item[field]])), requestedChanges: changes, reason: text(reason), notes: text(notes), sourceModule, actorId: text(actorId), actorRole: text(actorRole), timestamp, eventType },
    }),
  };
}
