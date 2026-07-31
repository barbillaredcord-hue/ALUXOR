import {
  RECEPTION_STATUSES,
  getReceptionAccumulatedQuantities,
} from './receptionEngine.js';
import {
  getLatestReception,
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
    pendingByUnit: [],
    recentReceptions: 0,
    activity: [],
    notifications: [],
  };
  let purchasedQuantity = 0;
  let acceptedForProgress = 0;
  scopedPurchases.forEach((purchase) => {
    const view = getPurchaseReceptionView(purchase, scopedReceptions);
    summary.purchases += 1;
    summary[view.status] += 1;
    view.items.forEach(({ purchaseItem, accumulated }) => {
      const purchased = Math.max(0, Number(purchaseItem.quantity) || 0);
      purchasedQuantity += purchased;
      acceptedForProgress += Math.min(purchased, accumulated.accepted);
    });
  });
  const totals = getReceptionAccumulatedQuantities(scopedReceptions);
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
    productionOrders,
    quotes,
  });
  const pendingByUnit = new Map();
  inbox.forEach((item) => {
    summary.items += 1;
    summary[`${item.status}Items`] += 1;
    if (item.hasOpenIncidents) summary.incidentItems += 1;
    if (item.pendingQuantity > 0) {
      pendingByUnit.set(
        item.unit,
        (pendingByUnit.get(item.unit) || 0) + item.pendingQuantity,
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
