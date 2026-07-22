import {
  PRODUCTION_STATUSES,
  normalizeProductionStatus,
} from './productionEngine.js';

const inProgressStatuses = new Set([
  PRODUCTION_STATUSES.SCHEDULED,
  PRODUCTION_STATUSES.CUTTING,
  PRODUCTION_STATUSES.FABRICATING,
  PRODUCTION_STATUSES.ASSEMBLY,
  PRODUCTION_STATUSES.INSTALLING,
]);

const summaryFieldByStatus = new Map([
  [PRODUCTION_STATUSES.PENDING, 'pending'],
  [PRODUCTION_STATUSES.SCHEDULED, 'scheduled'],
  [PRODUCTION_STATUSES.CUTTING, 'cutting'],
  [PRODUCTION_STATUSES.FABRICATING, 'fabricating'],
  [PRODUCTION_STATUSES.ASSEMBLY, 'assembly'],
  [PRODUCTION_STATUSES.READY, 'ready'],
  [PRODUCTION_STATUSES.INSTALLING, 'installation'],
  [PRODUCTION_STATUSES.DELIVERED, 'delivered'],
  [PRODUCTION_STATUSES.REJECTED, 'rejected'],
]);

function timestamp(order) {
  const value = order?.updatedAt ?? order?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

export function isProductionInProgressStatus(status) {
  return inProgressStatuses.has(normalizeProductionStatus(status));
}

export function getProductionSummary(orders = []) {
  const summary = {
    total: 0,
    pending: 0,
    scheduled: 0,
    cutting: 0,
    fabricating: 0,
    assembly: 0,
    inProcess: 0,
    ready: 0,
    installation: 0,
    delivered: 0,
    rejected: 0,
    active: 0,
    updatedAt: null,
  };

  if (!Array.isArray(orders)) return summary;

  let latestTimestamp = null;

  orders.forEach((order) => {
    if (!order || typeof order !== 'object' || Array.isArray(order)) return;

    const status = normalizeProductionStatus(order.estado ?? order.status);
const field = summaryFieldByStatus.get(status);

summary.total += 1;

if (status !== PRODUCTION_STATUSES.REJECTED) summary.active += 1;

if (field) {
  summary[field] += 1;
}

if (inProgressStatuses.has(status)) {
  summary.inProcess += 1;
}
    const orderTimestamp = timestamp(order);
    if (orderTimestamp !== null && (latestTimestamp === null || orderTimestamp > latestTimestamp)) {
      latestTimestamp = orderTimestamp;
    }
  });

  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
