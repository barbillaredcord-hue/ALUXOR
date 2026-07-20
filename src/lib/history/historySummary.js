import { getQuotesSummary } from '../quotes/quoteSummary.js';

export const RECEPTION_STATUSES = Object.freeze({
  PENDING: 'pendiente',
  PARTIAL: 'parcial',
  RECEIVED: 'recibido',
});

const receptionStatuses = new Set(Object.values(RECEPTION_STATUSES));

export function normalizeReceptionStatus(status) {
  if (typeof status !== 'string') return RECEPTION_STATUSES.PENDING;

  const normalized = status.trim().toLocaleLowerCase('es-MX');
  return receptionStatuses.has(normalized)
    ? normalized
    : RECEPTION_STATUSES.PENDING;
}

export function getReceptionSummary(items = [], rows = {}) {
  const summary = {
    total: 0,
    pending: 0,
    partial: 0,
    received: 0,
    progress: 0,
  };

  if (!Array.isArray(items)) return summary;

  items.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !item.id) return;

    const status = normalizeReceptionStatus(rows?.[item.id]?.status);
    summary.total += 1;

    if (status === RECEPTION_STATUSES.PARTIAL) summary.partial += 1;
    else if (status === RECEPTION_STATUSES.RECEIVED) summary.received += 1;
    else summary.pending += 1;
  });

  summary.progress = summary.total > 0
    ? (summary.received / summary.total) * 100
    : 0;

  return summary;
}

export function getHistorySummary(records = []) {
  const validRecords = Array.isArray(records)
    ? records.filter((record) => (
      record
      && typeof record === 'object'
      && !Array.isArray(record)
      && record.id
    ))
    : [];
  const quoteSummary = getQuotesSummary(validRecords);

  return {
    records: quoteSummary.total,
    pending: quoteSummary.pending,
    sent: quoteSummary.sent,
    accepted: quoteSummary.accepted,
    inProduction: quoteSummary.inProduction,
    installation: quoteSummary.installation,
    completed: quoteSummary.completed,
    cancelled: quoteSummary.cancelled,
    updatedAt: quoteSummary.updatedAt,
  };
}
