import {
  getReceptionAccumulatedQuantities,
  getReceptionItemStatus,
  getReceptionStatus,
} from './receptionEngine.js';
import { isProjectReadOnly } from '../production/productionEngine.js';
import { getReceptionItemActualCost } from './receptionCostSummary.js';
import {
  GLOBAL_MATERIAL_STATES,
  getMaterialVisualState,
  getPurchaseItemFulfillment,
  getReceptionCardTone,
} from '../purchases/materialFulfillment.js';
import { isPurchaseQuantityReviewPhysicalActionPending } from '../purchases/purchaseQuantityReviewSelectors.js';

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

export function getEffectivePurchasedQuantity(purchaseItem = {}) {
  return getPurchaseItemFulfillment(purchaseItem).purchasedQuantity;
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

export function getAcceptedQuantity(receptions, purchaseItemId, corrections = []) {
  return getReceptionAccumulatedQuantities(
    receptions,
    purchaseItemId,
    corrections,
  ).accepted;
}

export function getReceptionPendingQuantity(purchaseItem, receptions, corrections = []) {
  return getPurchaseItemFulfillment(
    purchaseItem,
    getAcceptedQuantity(receptions, purchaseItem?.id, corrections),
  ).receptionPendingQuantity;
}

export function getReceptionProgress(purchase, receptions, corrections = []) {
  const items = values(purchase?.items);
  const purchased = items.reduce(
    (total, item) => total + getEffectivePurchasedQuantity(item),
    0,
  );
  const accepted = items.reduce(
    (total, item) => total + Math.min(
      getEffectivePurchasedQuantity(item),
      getAcceptedQuantity(receptions, item.id, corrections),
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

export function getPurchaseReceptionHistoryEntry(reception = {}, purchase = {}, reviewRequests = [], corrections = []) {
  const items = values(reception.items).map((item) => {
    const purchaseItem = values(purchase.items).find((candidate) => candidate.id === item.purchaseItemId) || {};
    const totalReal = reception.revertedAt ? 0 : getReceptionItemActualCost(item, purchaseItem);
    return { ...item, material: purchaseItem.name || item.purchaseItemId, unit: purchaseItem.unit || 'pieza', supplier: purchaseItem.supplier || '', totalReal };
  });
  const activeReview = values(reviewRequests).find((review) => (
    review.purchaseId === purchase.id
    && isPurchaseQuantityReviewPhysicalActionPending(review, {
      workspaceId: reception.workspaceId,
      receptions: [reception],
      corrections,
    })
  )) || null;
  const hasIncident = items.some((item) => Number(item.damagedQuantity) > 0 || Number(item.rejectedQuantity) > 0);
  const status = reception.revertedAt ? 'reverted' : activeReview ? 'review_pending' : hasIncident ? 'incident' : items.every((item) => Number(item.missingQuantity || 0) === 0) ? 'complete' : 'partial';
  return Object.freeze({ reception, items, activeReview, status, totalReal: items.reduce((total, item) => total + item.totalReal, 0) });
}

export function getPurchaseReceptionView(purchase, receptions = [], corrections = []) {
  const related = listReceptionsByPurchase(receptions, purchase?.id);
  const items = values(purchase?.items).map((purchaseItem) => {
    const accumulated = getReceptionAccumulatedQuantities(
      related, purchaseItem.id, corrections,
    );
    const fulfillment = getPurchaseItemFulfillment(purchaseItem, accumulated.accepted);
    const hasBlockingIncident = accumulated.damaged > 0 || accumulated.rejected > 0;
    return {
      purchaseItem,
      accumulated,
      ...fulfillment,
      visualStatus: getMaterialVisualState({ ...fulfillment, hasBlockingIncident }),
      cardTone: getReceptionCardTone({ ...fulfillment, hasBlockingIncident }),
      status: getReceptionItemStatus({
        purchasedQuantity: fulfillment.purchasedQuantity,
        accumulated,
      }),
    };
  });
  return {
    purchase,
    receptions: related,
    items,
    status: getReceptionStatus({ purchase, receptions: related, corrections }),
    progress: getReceptionProgress(purchase, related, corrections),
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

export function getPurchaseItemReceptionHistory({
  purchase,
  purchaseItem,
  receptions = [],
  movements = [],
} = {}) {
  const ordered = Math.max(0, Number(purchaseItem?.quantity) || 0);
  const purchased = getEffectivePurchasedQuantity(purchaseItem);
  let acceptedBefore = 0;
  return relatedItemReceptions(receptions, purchaseItem?.id)
    .slice().reverse()
    .flatMap((reception) => values(reception.items)
      .filter((item) => item.purchaseItemId === purchaseItem?.id)
      .map((item) => {
        const received = Math.max(0, Number(item.receivedQuantity) || 0);
        const accepted = Math.max(0, Number(item.acceptedQuantity) || 0);
        const remainingBefore = Math.max(0, purchased - acceptedBefore);
        const excess = Math.max(0, received - remainingBefore);
        acceptedBefore += reception.revertedAt ? 0 : accepted;
        const relatedMovements = values(movements).filter((movement) => (
          movement?.receptionId === reception.id
          && movement?.metadata?.receptionItemId === item.id
        ));
        const movementIds = relatedMovements
          .filter((movement) => movement.movementType !== 'REVERSAL')
          .map((movement) => movement.id);
        const reversalIds = values(movements).filter((movement) => (
          movement.movementType === 'REVERSAL'
          && (movement.reversalOfId && movementIds.includes(movement.reversalOfId))
        )).map((movement) => movement.id);
        const status = reception.revertedAt
          ? 'reverted'
            : accepted > purchased || (acceptedBefore > purchased && item.excessDecision === 'accept')
            ? 'complete_excess'
              : item.shortageClosed && acceptedBefore < purchased
              ? 'closed_shortage'
              : item.damagedQuantity > 0 || item.rejectedQuantity > 0
                ? 'incident'
                : acceptedBefore >= purchased ? 'complete' : 'partial';
        return {
          receptionId: reception.id,
          receptionItemId: item.id,
          purchaseId: purchase?.id,
          purchaseItemId: purchaseItem?.id,
          receivedAt: reception.receivedAt,
          receivedBy: reception.receivedBy,
          orderedQuantity: ordered,
          receivedQuantity: received,
          acceptedQuantity: accepted,
          rejectedQuantity: Math.max(0, Number(item.rejectedQuantity) || 0),
          damagedQuantity: Math.max(0, Number(item.damagedQuantity) || 0),
          missingQuantity: Math.max(0, ordered - acceptedBefore),
          excessQuantity: excess,
          unit: purchaseItem?.unit || 'pieza',
          observations: text(item.observations || reception.observations),
          incidents: [
            item.damagedQuantity > 0 ? 'damaged' : null,
            item.rejectedQuantity > 0 ? 'rejected' : null,
            item.shortageClosed ? 'shortage_closed' : null,
            excess > 0 ? `excess_${item.excessDecision || 'pending'}` : null,
          ].filter(Boolean),
          status,
          version: item.version,
          actualCost: reception.revertedAt ? 0 : getReceptionItemActualCost(item, purchaseItem),
          movementIds,
          reversalIds,
          revertedAt: reception.revertedAt || null,
          reversalReason: text(reception.reversalReason),
        };
      }));
}

/**
 * Vista transversal y no persistente de las partidas por recibir.
 * Las relaciones se resuelven únicamente por UUID dentro del workspace.
 */
export function selectReceptionInbox({
  workspaceId = null,
  purchases = [],
  receptions = [],
  corrections = [],
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
      const accumulated = getReceptionAccumulatedQuantities(related, item.id, corrections);
      const itemReceptions = relatedItemReceptions(related, item.id);
      const latestReception = itemReceptions[0] || null;
      const latestReceptionItem = values(latestReception?.items).find((entry) => (
        entry.purchaseItemId === item.id
      )) || null;
      const fulfillment = getPurchaseItemFulfillment(item, accumulated.accepted);
      const { purchasedQuantity } = fulfillment;
      const status = getReceptionItemStatus({ purchasedQuantity, accumulated });
      const incidents = receptionIncidents(accumulated).map((incident) => ({
        ...incident,
        status: fulfillment.receptionPendingQuantity > 0 ? 'open' : 'resolved',
      }));
      const openIncidentCount = incidents.filter((incident) => (
        incident.status === 'open'
      )).length;
      const blockingIncidentCount = incidents.filter((incident) => (
        incident.status === 'open' && incident.severity === 'high'
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
        ...fulfillment,
        receivedQuantity: accumulated.received,
        acceptedQuantity: accumulated.accepted,
        rejectedQuantity: accumulated.rejected,
        damagedQuantity: accumulated.damaged,
        missingQuantity: accumulated.missing,
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
        blockingIncidentCount,
        hasBlockingIncidents: blockingIncidentCount > 0,
        visualStatus: getMaterialVisualState({
          ...fulfillment,
          hasBlockingIncident: blockingIncidentCount > 0,
        }),
        cardTone: getReceptionCardTone({
          ...fulfillment,
          hasBlockingIncident: blockingIncidentCount > 0,
        }),
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

export function selectReceptionProjectItems(inbox = [], projectId = null) {
  return values(inbox).filter((row) => row.projectId === projectId);
}

export function selectReceptionProjectSummary(inbox = [], projectId = null) {
  const rows = selectReceptionProjectItems(inbox, projectId);
  const pendingByUnit = rows.reduce((result, row) => {
    if (row.receptionPendingQuantity <= 0) return result;
    result[row.unit] = (result[row.unit] || 0) + row.receptionPendingQuantity;
    return result;
  }, {});
  const latest = rows.reduce((value, row) => (
    timestamp(row.latestReceptionAt) > timestamp(value) ? row.latestReceptionAt : value
  ), null);
  const purchases = new Set(rows.map((row) => row.purchaseId));
  const count = (status) => rows.filter((row) => row.status === status).length;
  const incidents = rows.reduce((total, row) => total + row.openIncidentCount, 0);
  const materialsReadyItems = rows.filter((row) => (
    row.globalMaterialStatus === GLOBAL_MATERIAL_STATES.READY
    || row.globalMaterialStatus === GLOBAL_MATERIAL_STATES.SURPLUS
    || row.globalMaterialStatus === GLOBAL_MATERIAL_STATES.NO_REQUIREMENT_WITH_SURPLUS
  )).length;
  const receptionCompleteButPurchaseMissingItems = rows.filter((row) => (
    row.receptionPendingQuantity === 0 && row.purchasePendingQuantity > 0
  )).length;
  return {
    projectId,
    purchases: purchases.size,
    totalItems: rows.length,
    pendingItems: count('pending'),
    partialItems: count('partial'),
    completeItems: count('complete'),
    rejectedItems: count('rejected'),
    activeIncidents: incidents,
    purchasePendingItems: rows.filter((row) => row.purchasePendingQuantity > 0).length,
    receptionPendingItems: rows.filter((row) => row.receptionPendingQuantity > 0).length,
    materialsReadyItems,
    receptionCompleteButPurchaseMissingItems,
    cardTone: rows.some((row) => row.hasBlockingIncidents)
      ? 'red'
      : rows.some((row) => row.visualStatus === 'PARTIALLY_PURCHASED')
        ? 'yellow'
        : rows.some((row) => row.visualStatus === 'PENDING_PURCHASE')
          ? 'gray'
          : rows.some((row) => row.visualStatus === 'PURCHASED_AWAITING_RECEPTION')
            ? 'blue' : 'green',
    pendingByUnit,
    latestReceptionAt: latest,
    status: rows.length > 0 && materialsReadyItems === rows.length
      ? 'MATERIALS_READY'
      : rows.length > 0 && receptionCompleteButPurchaseMissingItems > 0
        && rows.every((row) => row.receptionPendingQuantity === 0)
        ? 'RECEPTION_COMPLETE_BUT_PURCHASE_MISSING'
        : rows.some((row) => row.status === 'partial' || row.status === 'complete')
          ? 'partial' : 'pending',
    attentionRequired: incidents > 0 || rows.some((row) => row.status === 'rejected'),
  };
}

export function selectReceptionProjectIndex(inbox = []) {
  const grouped = new Map();
  values(inbox).forEach((row) => {
    const key = row.projectId || `unassigned:${row.productionOrderId || row.purchaseId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  });
  return [...grouped.entries()].map(([key, rows]) => ({
    id: key,
    projectId: rows[0].projectId,
    projectName: rows[0].projectName,
    customerName: rows[0].customerName,
    projectFolio: rows[0].projectFolio,
    productionOrderId: rows[0].productionOrderId,
    productionOrderFolio: rows[0].productionOrderFolio,
    materials: [...new Set(rows.map((row) => row.material))],
    searchText: searchable(rows.map((row) => row.searchText).join(' ')),
    ...selectReceptionProjectSummary(rows, rows[0].projectId),
  })).sort((left, right) => (
    Number(right.attentionRequired) - Number(left.attentionRequired)
    || timestamp(right.latestReceptionAt) - timestamp(left.latestReceptionAt)
    || left.projectName.localeCompare(right.projectName, 'es-MX')
  ));
}

export function filterReceptionProjects(projects = [], filters = {}) {
  const query = searchable(filters.query);
  return values(projects).filter((project) => {
    if (query && !project.searchText.includes(query)) return false;
    if (filters.customer && !searchable(project.customerName).includes(searchable(filters.customer))) return false;
    if (filters.folio && !searchable(`${project.projectFolio} ${project.productionOrderFolio}`).includes(searchable(filters.folio))) return false;
    if (filters.material && !project.materials.some((item) => searchable(item).includes(searchable(filters.material)))) return false;
    if (filters.status === 'pending' && project.pendingItems <= 0) return false;
    if (filters.status === 'partial' && project.partialItems <= 0) return false;
    if (filters.status === 'complete' && project.completeItems !== project.totalItems) return false;
    if (filters.status === 'incidents' && project.activeIncidents <= 0) return false;
    if (filters.status === 'without_reception' && project.latestReceptionAt) return false;
    if (filters.status === 'recent' && timestamp(project.latestReceptionAt) < Date.now() - 604800000) return false;
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
        label: `${row.material}: ${row.receptionPendingQuantity} ${row.unit} por recibir`,
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
    purchasePendingQuantity: 0,
    receptionPendingQuantity: 0,
    projectMissingQuantity: 0,
    status: 'pending',
  };
  rows.forEach((row) => {
    result[row.status] += 1;
    result.incidents += row.openIncidentCount;
    result.receivedQuantity += row.receivedQuantity;
    result.acceptedQuantity += row.acceptedQuantity;
    result.purchasePendingQuantity += row.purchasePendingQuantity;
    result.receptionPendingQuantity += row.receptionPendingQuantity;
    result.projectMissingQuantity += row.projectMissingQuantity;
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
