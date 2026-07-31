import {
  getReceptionAccumulatedQuantities,
  getReceptionItemStatus,
  getReceptionStatus,
} from './receptionEngine.js';
import { isProjectReadOnly } from '../production/productionEngine.js';

function values(input) {
  return Array.isArray(input) ? input : [];
}

function text(value) {
  return String(value ?? '').trim();
}

function searchable(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-MX')
    .replace(/\s+/g, ' ');
}

function timestamp(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function quoteForm(quote) {
  return quote?.form_data || quote?.form || quote || {};
}

const statusPriority = Object.freeze({
  pending: 0,
  partial: 1,
  rejected: 2,
  complete: 3,
});

export function listReceptionsByWorkspace(receptions, workspaceId) {
  return values(receptions).filter((item) => item.workspaceId === workspaceId);
}

export function listReceptionsByPurchase(receptions, purchaseId) {
  return values(receptions).filter((item) => item.purchaseId === purchaseId);
}

export function listReceptionsByPurchaseItem(receptions, purchaseItemId) {
  return values(receptions).filter((reception) => (
    values(reception.items).some((item) => item.purchaseItemId === purchaseItemId)
  ));
}

export function getAcceptedQuantity(receptions, purchaseItemId) {
  return getReceptionAccumulatedQuantities(
    receptions,
    purchaseItemId,
  ).accepted;
}

export function getPendingQuantity(purchaseItem, receptions) {
  return Math.max(
    0,
    (Number(purchaseItem?.quantity) || 0)
      - getAcceptedQuantity(receptions, purchaseItem?.id),
  );
}

export function getReceptionProgress(purchase, receptions) {
  const items = values(purchase?.items);
  const purchased = items.reduce(
    (total, item) => total + Math.max(0, Number(item.quantity) || 0),
    0,
  );
  const accepted = items.reduce(
    (total, item) => total + Math.min(
      Math.max(0, Number(item.quantity) || 0),
      getAcceptedQuantity(receptions, item.id),
    ),
    0,
  );
  return purchased > 0 ? (accepted / purchased) * 100 : 0;
}

export function getLatestReception(receptions) {
  return [...values(receptions)].sort((left, right) => (
    Date.parse(right.receivedAt || right.updatedAt || '')
      - Date.parse(left.receivedAt || left.updatedAt || '')
    || right.id.localeCompare(left.id)
  ))[0] || null;
}

export function getPurchaseReceptionView(purchase, receptions = []) {
  const related = listReceptionsByPurchase(receptions, purchase?.id);
  const items = values(purchase?.items).map((purchaseItem) => {
    const accumulated = getReceptionAccumulatedQuantities(
      related,
      purchaseItem.id,
    );
    return {
      purchaseItem,
      accumulated,
      pendingQuantity: getPendingQuantity(purchaseItem, related),
      status: getReceptionItemStatus({
        purchasedQuantity: purchaseItem.quantity,
        accumulated,
      }),
    };
  });
  return {
    purchase,
    receptions: related,
    items,
    status: getReceptionStatus({ purchase, receptions: related }),
    progress: getReceptionProgress(purchase, related),
    latest: getLatestReception(related),
  };
}

function receptionIncidents(accumulated) {
  return [
    accumulated.damaged > 0 ? {
      id: 'damaged',
      type: 'damaged',
      label: 'Material dañado',
      quantity: accumulated.damaged,
      severity: 'high',
    } : null,
    accumulated.rejected > 0 ? {
      id: 'rejected',
      type: 'rejected',
      label: 'Material rechazado',
      quantity: accumulated.rejected,
      severity: 'high',
    } : null,
    accumulated.missing > 0 ? {
      id: 'missing',
      type: 'missing',
      label: 'Cantidad faltante',
      quantity: accumulated.missing,
      severity: 'medium',
    } : null,
  ].filter(Boolean);
}

function relatedItemReceptions(receptions, purchaseItemId) {
  return values(receptions)
    .filter((reception) => values(reception?.items).some((item) => (
      item?.purchaseItemId === purchaseItemId
    )))
    .sort((left, right) => (
      timestamp(right.receivedAt || right.updatedAt)
      - timestamp(left.receivedAt || left.updatedAt)
      || text(left.id).localeCompare(text(right.id))
    ));
}

/**
 * Vista transversal y no persistente de las partidas por recibir.
 * Las relaciones se resuelven únicamente por UUID dentro del workspace.
 */
export function selectReceptionInbox({
  workspaceId = null,
  purchases = [],
  receptions = [],
  productionOrders = [],
  quotes = [],
} = {}) {
  const canonicalWorkspaceId = text(workspaceId);
  const workspacePurchases = values(purchases).filter((purchase) => (
    purchase?.id
    && (!canonicalWorkspaceId || text(purchase.workspaceId) === canonicalWorkspaceId)
  ));
  const workspaceReceptions = values(receptions).filter((reception) => (
    reception?.id
    && (!canonicalWorkspaceId || text(reception.workspaceId) === canonicalWorkspaceId)
  ));
  const ordersById = new Map(values(productionOrders)
    .filter((order) => !canonicalWorkspaceId || text(order?.workspaceId) === canonicalWorkspaceId)
    .map((order) => [text(order?.id), order]));
  const quotesById = new Map(values(quotes)
    .filter((quote) => !canonicalWorkspaceId || !quote?.workspaceId
      || text(quote.workspaceId) === canonicalWorkspaceId)
    .map((quote) => [text(quote?.id), quote]));

  return workspacePurchases.flatMap((purchase) => {
    const related = workspaceReceptions.filter((reception) => (
      text(reception.purchaseId) === text(purchase.id)
    ));
    const order = ordersById.get(text(purchase.productionOrderId)) || null;
    const quote = quotesById.get(text(purchase.quoteId)) || null;
    const form = quoteForm(quote);

    return values(purchase.items).filter((item) => item?.id).map((item) => {
      const accumulated = getReceptionAccumulatedQuantities(related, item.id);
      const itemReceptions = relatedItemReceptions(related, item.id);
      const latestReception = itemReceptions[0] || null;
      const latestReceptionItem = values(latestReception?.items).find((entry) => (
        entry.purchaseItemId === item.id
      )) || null;
      const purchasedQuantity = Math.max(0, Number(item.quantity) || 0);
      const status = getReceptionItemStatus({ purchasedQuantity, accumulated });
      const pendingQuantity = Math.max(0, purchasedQuantity - accumulated.accepted);
      const incidents = receptionIncidents(accumulated).map((incident) => ({
        ...incident,
        status: pendingQuantity > 0 ? 'open' : 'resolved',
      }));
      const openIncidentCount = incidents.filter((incident) => (
        incident.status === 'open'
      )).length;
      const projectName = text(
        purchase.projectName || order?.producto || form.producto || quote?.producto,
      );
      const customerName = text(
        purchase.clientName || order?.cliente || form.clienteNombre || quote?.clienteNombre,
      );
      const searchText = searchable([
        quote?.folio,
        projectName,
        customerName,
        purchase.folio,
        purchase.supplier,
        purchase.productionOrderFolio,
        order?.folio,
        item.name,
        item.group,
        item.notes,
        item.supplier,
        latestReception?.receivedBy,
        latestReception?.observations,
        latestReceptionItem?.observations,
        ...incidents.map((incident) => incident.label),
      ].filter(Boolean).join(' '));

      return {
        id: text(item.id),
        workspaceId: text(purchase.workspaceId),
        projectId: text(purchase.quoteId) || null,
        projectFolio: text(quote?.folio) || null,
        projectName: projectName || 'Proyecto sin nombre',
        customerName: customerName || 'Cliente no registrado',
        quoteId: text(purchase.quoteId) || null,
        productionOrderId: text(purchase.productionOrderId) || null,
        productionOrderFolio: text(purchase.productionOrderFolio || order?.folio) || null,
        purchaseId: text(purchase.id),
        purchaseFolio: text(purchase.folio) || null,
        supplier: text(item.supplier || purchase.supplier) || 'Proveedor pendiente',
        purchaseItemId: text(item.id),
        material: text(item.name) || 'Material sin descripción',
        description: text(item.notes),
        unit: text(item.unit) || 'pieza',
        purchasedQuantity,
        receivedQuantity: accumulated.received,
        acceptedQuantity: accumulated.accepted,
        rejectedQuantity: accumulated.rejected,
        damagedQuantity: accumulated.damaged,
        missingQuantity: accumulated.missing,
        pendingQuantity,
        status,
        latestReceptionId: text(latestReception?.id) || null,
        latestReceptionAt: latestReception?.receivedAt || latestReception?.updatedAt || null,
        latestReceivedBy: text(latestReception?.receivedBy) || null,
        receptionCount: itemReceptions.length,
        incidents,
        incidentCount: incidents.length,
        hasIncidents: incidents.length > 0,
        openIncidentCount,
        hasOpenIncidents: openIncidentCount > 0,
        readOnly: isProjectReadOnly(order),
        observations: text(latestReceptionItem?.observations || latestReception?.observations),
        searchText,
      };
    });
  }).sort((left, right) => (
    Number(right.hasOpenIncidents) - Number(left.hasOpenIncidents)
    || (statusPriority[left.status] ?? 99) - (statusPriority[right.status] ?? 99)
    || timestamp(right.latestReceptionAt) - timestamp(left.latestReceptionAt)
    || left.purchaseId.localeCompare(right.purchaseId)
    || left.purchaseItemId.localeCompare(right.purchaseItemId)
  ));
}

export function filterReceptionInbox(inbox = [], filters = {}) {
  const query = searchable(filters.query);
  const statuses = new Set(values(filters.statuses).map(text).filter(Boolean));
  const from = timestamp(filters.from);
  const to = timestamp(filters.to);
  return values(inbox).filter((row) => {
    if (statuses.size && !statuses.has(row.status)) return false;
    if (filters.projectId && row.projectId !== filters.projectId) return false;
    if (filters.customer && searchable(row.customerName) !== searchable(filters.customer)) return false;
    if (filters.supplier && searchable(row.supplier) !== searchable(filters.supplier)) return false;
    if (filters.responsible && searchable(row.latestReceivedBy) !== searchable(filters.responsible)) return false;
    if (filters.material && !searchable(row.material).includes(searchable(filters.material))) return false;
    if (filters.purchaseId && row.purchaseId !== filters.purchaseId) return false;
    if (filters.purchaseItemId && row.purchaseItemId !== filters.purchaseItemId) return false;
    if (filters.productionOrderId && row.productionOrderId !== filters.productionOrderId) return false;
    if (filters.incidents === true && !row.hasOpenIncidents) return false;
    if (filters.readOnly === true && !row.readOnly) return false;
    if (filters.readOnly === false && row.readOnly) return false;
    const occurredAt = timestamp(row.latestReceptionAt);
    if (from && occurredAt < from) return false;
    if (to && occurredAt > to + 86399999) return false;
    if (query && !row.searchText.includes(query)) return false;
    return true;
  });
}

export function getReceptionOperationalEvents({
  receptions = [],
  inbox = [],
} = {}) {
  const rowsByItemId = new Map(values(inbox).map((row) => [row.purchaseItemId, row]));
  return values(receptions).flatMap((reception) => values(reception?.items).map((item) => {
    const row = rowsByItemId.get(item.purchaseItemId) || {};
    const type = Number(item.damagedQuantity) > 0
      ? 'reception-damaged'
      : Number(item.rejectedQuantity) > 0
        ? 'reception-rejected'
        : Number(item.missingQuantity) > 0
          ? 'reception-missing'
          : row.status === 'complete'
            ? 'reception-complete'
            : 'reception-registered';
    const quantity = Math.max(0, Number(item.receivedQuantity) || 0);
    return {
      id: `${text(reception.id)}:${text(item.id)}`,
      workspaceId: text(reception.workspaceId),
      type,
      occurredAt: reception.receivedAt || reception.updatedAt || null,
      projectId: text(reception.quoteId) || row.projectId || null,
      productionOrderId: text(reception.productionOrderId) || row.productionOrderId || null,
      purchaseId: text(reception.purchaseId),
      purchaseItemId: text(item.purchaseItemId),
      receptionId: text(reception.id),
      receptionItemId: text(item.id),
      responsible: text(reception.receivedBy),
      summary: `${row.material || 'Material'} · ${quantity} ${row.unit || 'pieza'}`,
      observation: text(item.observations || reception.observations),
      severity: ['reception-damaged', 'reception-rejected'].includes(type)
        ? 'high'
        : type === 'reception-missing' ? 'medium' : 'info',
    };
  })).sort((left, right) => (
    timestamp(right.occurredAt) - timestamp(left.occurredAt)
    || left.id.localeCompare(right.id)
  ));
}

export function getReceptionNotifications(inbox = []) {
  return values(inbox).flatMap((row) => {
    if (row.hasOpenIncidents) {
      return [{
        id: `reception-incident:${row.purchaseItemId}`,
        type: 'incident',
        severity: 'warning',
        label: `${row.material}: ${row.incidents.filter((item) => item.status === 'open').map((item) => item.label).join(', ')}`,
        purchaseId: row.purchaseId,
        purchaseItemId: row.purchaseItemId,
        projectId: row.projectId,
      }];
    }
    if (row.status === 'pending' || row.status === 'partial') {
      return [{
        id: `reception-pending:${row.purchaseItemId}`,
        type: row.status,
        severity: row.status === 'partial' ? 'warning' : 'info',
        label: `${row.material}: ${row.pendingQuantity} ${row.unit} por recibir`,
        purchaseId: row.purchaseId,
        purchaseItemId: row.purchaseItemId,
        projectId: row.projectId,
      }];
    }
    return [];
  });
}

function getRelatedReceptionStatus(inbox, predicate) {
  const rows = values(inbox).filter(predicate);
  const result = {
    items: rows.length,
    pending: 0,
    partial: 0,
    complete: 0,
    rejected: 0,
    incidents: 0,
    receivedQuantity: 0,
    acceptedQuantity: 0,
    pendingQuantity: 0,
    status: 'pending',
  };
  rows.forEach((row) => {
    result[row.status] += 1;
    result.incidents += row.openIncidentCount;
    result.receivedQuantity += row.receivedQuantity;
    result.acceptedQuantity += row.acceptedQuantity;
    result.pendingQuantity += row.pendingQuantity;
  });
  result.status = rows.length > 0 && result.complete === rows.length
    ? 'complete'
    : result.partial > 0 || result.complete > 0
      ? 'partial'
      : result.rejected > 0 ? 'rejected' : 'pending';
  return result;
}

export function getPurchaseReceptionStatusView(inbox = [], purchaseId = null) {
  return getRelatedReceptionStatus(
    inbox,
    (row) => row.purchaseId === purchaseId,
  );
}

export function getProductionReceptionStatusView(
  inbox = [],
  productionOrderId = null,
) {
  return getRelatedReceptionStatus(
    inbox,
    (row) => row.productionOrderId === productionOrderId,
  );
}
