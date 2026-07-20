const FINANCIAL_FIELDS = Object.freeze({
  quotedTotal: ['total', 'totalCliente'],
  internalCost: ['internalTotal', 'costoInterno'],
  projectedProfit: ['profit', 'utilidad'],
  deposit: ['deposit', 'anticipo'],
  balance: ['balance', 'rest', 'resto', 'saldo'],
});

function finiteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstFinancialValue(record, fields) {
  for (const field of fields) {
    const value = finiteNumber(record?.[field]);
    if (value !== null) return value;
  }

  return null;
}

function timestamp(record) {
  const value = record?.updatedAt ?? record?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeFinancialAmount(value) {
  return Math.max(0, finiteNumber(value) ?? 0);
}

export function normalizeProjectedProfit(value) {
  return finiteNumber(value) ?? 0;
}

export function getFinanceSummary(records = []) {
  const summary = {
    quotes: 0,
    quotedTotal: 0,
    internalCost: 0,
    projectedProfit: 0,
    deposit: 0,
    balance: 0,
    updatedAt: null,
  };

  if (!Array.isArray(records)) return summary;

  let latestTimestamp = null;

  records.forEach((record) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;

    const values = {
      quotedTotal: firstFinancialValue(record, FINANCIAL_FIELDS.quotedTotal),
      internalCost: firstFinancialValue(record, FINANCIAL_FIELDS.internalCost),
      projectedProfit: firstFinancialValue(record, FINANCIAL_FIELDS.projectedProfit),
      deposit: firstFinancialValue(record, FINANCIAL_FIELDS.deposit),
      balance: firstFinancialValue(record, FINANCIAL_FIELDS.balance),
    };

    if (Object.values(values).every((value) => value === null)) return;

    summary.quotes += 1;
    summary.quotedTotal += normalizeFinancialAmount(values.quotedTotal);
    summary.internalCost += normalizeFinancialAmount(values.internalCost);
    summary.projectedProfit += normalizeProjectedProfit(values.projectedProfit);
    summary.deposit += normalizeFinancialAmount(values.deposit);
    summary.balance += normalizeFinancialAmount(values.balance);

    const recordTimestamp = timestamp(record);
    if (recordTimestamp !== null && (latestTimestamp === null || recordTimestamp > latestTimestamp)) {
      latestTimestamp = recordTimestamp;
    }
  });

  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
