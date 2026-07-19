import { QUOTE_STATUSES, quoteRecordStatus } from './quoteAdapter.js';

const summaryFieldByStatus = new Map([
  [QUOTE_STATUSES.PENDING, 'pending'],
  [QUOTE_STATUSES.SENT, 'sent'],
  [QUOTE_STATUSES.ACCEPTED, 'accepted'],
  [QUOTE_STATUSES.IN_PRODUCTION, 'inProduction'],
  [QUOTE_STATUSES.INSTALLATION, 'installation'],
  [QUOTE_STATUSES.COMPLETED, 'completed'],
  [QUOTE_STATUSES.CANCELLED, 'cancelled'],
]);

function timestamp(record) {
  const value = record?.updatedAt ?? record?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

export function getQuotesSummary(quotes = []) {
  const summary = {
    total: 0,
    pending: 0,
    sent: 0,
    accepted: 0,
    inProduction: 0,
    installation: 0,
    completed: 0,
    cancelled: 0,
    updatedAt: null,
  };

  if (!Array.isArray(quotes)) return summary;

  let latestTimestamp = null;

  quotes.forEach((quote) => {
    if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return;

    const field = summaryFieldByStatus.get(quoteRecordStatus(quote));
    summary.total += 1;
    if (field) {
      summary[field] += 1;
    }

    const quoteTimestamp = timestamp(quote);
    if (quoteTimestamp !== null && (latestTimestamp === null || quoteTimestamp > latestTimestamp)) {
      latestTimestamp = quoteTimestamp;
    }
  });

  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
