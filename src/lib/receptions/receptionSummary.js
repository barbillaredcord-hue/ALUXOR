import {
  RECEPTION_STATUSES,
  getReceptionAccumulatedQuantities,
} from './receptionEngine.js';
import {
  getLatestReception,
  getEffectivePurchasedQuantity,
  getPurchaseReceptionView,
  getReceptionNotifications,
  getReceptionOperationalEvents,
  selectReceptionInbox,
} from './receptionSelectors.js';

function values(input) {
  return Array.isArray(input) ? input : [];
}

export function getReceptionSummary({
  receptions = [],
  purchases = [],
  productionOrders = [],
  quotes = [],
  workspaceId = null,
  corrections = [],
} = {}) {
  const scopedReceptions = values(receptions).filter((item) => (
    !workspaceId || item?.workspaceId === workspaceId
  ));
  const scopedPurchases = values(purchases).filter((item) => (
    !workspaceId || item?.workspaceId === workspaceId
  ));
  const summary = {
    receptions: scopedReceptions.length,
    purchases: 0,
    pending: 0,
    partial: 0,
    complete: 0,
    rejected: 0,
    receivedQuantity: 0,
    acceptedQuantity: 0,
    damagedQuantity: 0,
    rejectedQuantity: 0,
    missingQuantity: 0,
    progress: 0,
    latestReception: null,
    alerts: [],
    status: RECEPTION_STATUSES.PENDING,
    updatedAt: null,
    items: 0,
    pendingItems: 0,
    partialItems: 0,
    completeItems: 0,
    rejectedItems: 0,
    incidentItems: 0,
    purchasePendingItems: 0,
    receptionPendingItems: 0,
    materialsReadyItems: 0,
    receptionCompleteButPurchaseMissingItems: 0,
    requiredQuantity: 0,
    orderedQuantity: 0,
    purchasedQuantity: 0,
    purchasePendingQuantity: 0,
    receptionPendingQuantity: 0,
    projectMissingQuantity: 0,
    surplusPurchasedQuantity: 0,
    surplusReceivedQuantity: 0,
    pendingByUnit: [],
    recentReceptions: 0,
    activity: [],
    notifications: [],
  };
  let purchasedQuantity = 0;
  let acceptedForProgress = 0;
  scopedPurchases.forEach((purchase) => {
    const view = getPurchaseReceptionView(purchase, scopedReceptions, corrections);
    summary.purchases += 1;
    summary[view.status] += 1;
    view.items.forEach(({ purchaseItem, accumulated }) => {
      const purchased = getEffectivePurchasedQuantity(purchaseItem);
      purchasedQuantity += purchased;
      acceptedForProgress += Math.min(purchased, accumulated.accepted);
    });
  });
  const totals = getReceptionAccumulatedQuantities(scopedReceptions, null, corrections);
  summary.receivedQuantity = totals.received;
  summary.acceptedQuantity = totals.accepted;
  summary.damagedQuantity = totals.damaged;
  summary.rejectedQuantity = totals.rejected;
  summary.missingQuantity = totals.missing;
  summary.progress = purchasedQuantity > 0
    ? (acceptedForProgress / purchasedQuantity) * 100
    : 0;
  const latest = getLatestReception(scopedReceptions);
  summary.latestReception = latest?.id || null;
  summary.updatedAt = latest?.updatedAt || latest?.receivedAt || null;
  if (summary.damagedQuantity > 0) {
    summary.alerts.push({
      id: 'reception-damaged',
      label: 'Material dañado',
      count: summary.damagedQuantity,
    });
  }
  if (summary.rejectedQuantity > 0) {
    summary.alerts.push({
      id: 'reception-rejected',
      label: 'Material rechazado',
      count: summary.rejectedQuantity,
    });
  }
  if (summary.missingQuantity > 0) {
    summary.alerts.push({
      id: 'reception-missing',
      label: 'Material faltante',
      count: summary.missingQuantity,
    });
  }
  summary.status = summary.purchases > 0 && summary.complete === summary.purchases
    ? RECEPTION_STATUSES.COMPLETE
    : summary.partial > 0 || summary.complete > 0
      ? RECEPTION_STATUSES.PARTIAL
      : summary.rejected > 0
        ? RECEPTION_STATUSES.REJECTED
        : RECEPTION_STATUSES.PENDING;
  const inbox = selectReceptionInbox({
    workspaceId,
    purchases: scopedPurchases,
    receptions: scopedReceptions,
    corrections,
    productionOrders,
    quotes,
  });
  const pendingByUnit = new Map();
  inbox.forEach((item) => {
    summary.items += 1;
    summary[`${item.status}Items`] += 1;
    if (item.hasOpenIncidents) summary.incidentItems += 1;
    summary.requiredQuantity += item.requiredQuantity;
    summary.orderedQuantity += item.orderedQuantity;
    summary.purchasedQuantity += item.purchasedQuantity;
    summary.purchasePendingQuantity += item.purchasePendingQuantity;
    summary.receptionPendingQuantity += item.receptionPendingQuantity;
    summary.projectMissingQuantity += item.projectMissingQuantity;
    summary.surplusPurchasedQuantity += item.surplusPurchasedQuantity;
    summary.surplusReceivedQuantity += item.surplusReceivedQuantity;
    if (item.purchasePendingQuantity > 0) summary.purchasePendingItems += 1;
    if (item.receptionPendingQuantity > 0) summary.receptionPendingItems += 1;
    if (item.globalMaterialStatus === 'READY' || item.globalMaterialStatus === 'SURPLUS') {
      summary.materialsReadyItems += 1;
    }
    if (item.receptionPendingQuantity === 0 && item.purchasePendingQuantity > 0) {
      summary.receptionCompleteButPurchaseMissingItems += 1;
    }
    if (item.receptionPendingQuantity > 0) {
      pendingByUnit.set(
        item.unit,
        (pendingByUnit.get(item.unit) || 0) + item.receptionPendingQuantity,
      );
    }
  });
  summary.pendingByUnit = [...pendingByUnit.entries()]
    .map(([unit, quantity]) => ({ unit, quantity }))
    .sort((left, right) => left.unit.localeCompare(right.unit));
  const activeIncidentQuantity = inbox.reduce((totals, item) => {
    item.incidents.filter((incident) => incident.status === 'open').forEach((incident) => {
      totals[incident.type] = (totals[incident.type] || 0) + incident.quantity;
    });
    return totals;
  }, {});
  summary.alerts = [
    activeIncidentQuantity.damaged ? {
      id: 'reception-damaged',
      label: 'Material dañado',
      count: activeIncidentQuantity.damaged,
    } : null,
    activeIncidentQuantity.rejected ? {
      id: 'reception-rejected',
      label: 'Material rechazado',
      count: activeIncidentQuantity.rejected,
    } : null,
    activeIncidentQuantity.missing ? {
      id: 'reception-missing',
      label: 'Material faltante',
      count: activeIncidentQuantity.missing,
    } : null,
  ].filter(Boolean);
  summary.activity = getReceptionOperationalEvents({
    receptions: scopedReceptions,
    inbox,
  });
  summary.recentReceptions = Math.min(5, summary.activity.length);
  summary.notifications = getReceptionNotifications(inbox);
  return Object.freeze(summary);
}
