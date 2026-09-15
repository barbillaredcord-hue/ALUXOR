import {
  getOriginalQuotedQuantity,
  getPurchaseItemFulfillment,
} from '../purchases/materialFulfillment.js';
import { projectEffectiveReceptionItems } from './receptionEffectiveItems.js';

function values(input) {
  return Array.isArray(input) ? input : [];
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundMoney(value) {
  return Math.round((number(value) + Number.EPSILON) * 100) / 100;
}

export function getReceptionItemActualCost(item = {}, purchaseItem = {}) {
  const unitCost = item.actualUnitCost === null
    || item.actualUnitCost === undefined
    || item.actualUnitCost === ''
    ? number(purchaseItem.unitCost)
    : number(item.actualUnitCost);
  return Math.max(0, roundMoney(
    (number(item.acceptedQuantity) * unitCost)
      + number(item.additionalCharges)
      - number(item.discounts),
  ));
}

export function getReceptionItemPrice(item = {}, purchaseItem = {}) {
  if (item.actualUnitCost !== null && item.actualUnitCost !== undefined && item.actualUnitCost !== '') {
    return { unitPrice: number(item.actualUnitCost), source: 'confirmed_reception' };
  }
  if (item.invoiceUnitCost !== null && item.invoiceUnitCost !== undefined && item.invoiceUnitCost !== '') {
    return { unitPrice: number(item.invoiceUnitCost), source: 'invoice' };
  }
  if (purchaseItem.unitCost !== null && purchaseItem.unitCost !== undefined && purchaseItem.unitCost !== '') {
    return { unitPrice: number(purchaseItem.unitCost), source: 'purchase' };
  }
  return { unitPrice: number(purchaseItem.estimatedUnitCost), source: 'estimated' };
}

export function getReceptionFinancialSummary({ purchases = [], receptions = [], corrections = [] } = {}) {
  const purchaseItems = new Map(values(purchases).flatMap((purchase) => values(purchase?.items)
    .map((item) => [item.id, item])));
  const summary = {
    registeredPurchaseCost: 0, receivedValue: 0, acceptedValue: 0, rejectedValue: 0,
    returnedValue: 0, damagedValue: 0, realAdditionalCharges: 0, realDiscounts: 0,
    invoiceDifference: 0, confirmedRealSpend: 0, purchasedItems: 0, receivedItems: 0,
    completedItems: 0, partialItems: 0, pendingReceptionItems: 0, itemsWithNotes: 0,
    itemsWithPriceDifference: 0, itemsWithReturns: 0, blockingIncidents: 0,
  };
  const itemStates = new Map();
  values(receptions).filter((reception) => !reception?.revertedAt).forEach((reception) => {
    projectEffectiveReceptionItems({ receptionItems: values(reception.items), corrections }).forEach((item) => {
      const purchaseItem = purchaseItems.get(item.purchaseItemId) || {};
      const { unitPrice, source } = getReceptionItemPrice(item, purchaseItem);
      const received = number(item.receivedQuantity);
      const accepted = number(item.acceptedQuantity);
      const rejected = number(item.rejectedQuantity);
      const returned = number(item.returnedQuantity);
      const damaged = number(item.damagedQuantity);
      summary.receivedValue += received * unitPrice;
      summary.acceptedValue += accepted * unitPrice;
      summary.rejectedValue += rejected * unitPrice;
      summary.returnedValue += returned * unitPrice;
      summary.damagedValue += damaged * unitPrice;
      summary.realAdditionalCharges += number(item.additionalCharges);
      summary.realDiscounts += number(item.discounts);
      summary.invoiceDifference += item.invoiceTotal === null || item.invoiceTotal === undefined
        ? 0 : number(item.invoiceTotal) - (accepted * unitPrice);
      if (item.observations || reception.observations) summary.itemsWithNotes += 1;
      if (source !== 'purchase' && source !== 'estimated') summary.itemsWithPriceDifference += 1;
      if (returned > 0) summary.itemsWithReturns += 1;
      if (damaged > 0 || rejected > 0 || returned > 0) summary.blockingIncidents += 1;
      const state = itemStates.get(item.purchaseItemId) || { received: 0, accepted: 0, shortageClosed: false };
      state.received += received;
      state.accepted += accepted;
      state.shortageClosed ||= item.shortageClosed === true;
      itemStates.set(item.purchaseItemId, state);
    });
  });
  purchaseItems.forEach((purchaseItem, purchaseItemId) => {
    const state = itemStates.get(purchaseItemId) || { received: 0, accepted: 0, shortageClosed: false };
    const fulfillment = getPurchaseItemFulfillment(purchaseItem, state.accepted);
    summary.registeredPurchaseCost += fulfillment.purchasedQuantity * number(purchaseItem.unitCost);
    if (fulfillment.purchasedQuantity > 0) summary.purchasedItems += 1;
    if (state.received > 0) summary.receivedItems += 1;
    if (fulfillment.receptionPendingQuantity === 0 || state.shortageClosed) summary.completedItems += 1;
    else if (state.received > 0) summary.partialItems += 1;
    else if (fulfillment.purchasedQuantity > 0) summary.pendingReceptionItems += 1;
  });
  summary.confirmedRealSpend = summary.acceptedValue + summary.realAdditionalCharges - summary.realDiscounts;
  Object.keys(summary).forEach((key) => {
    if (typeof summary[key] === 'number' && /Cost|Value|Charges|Discounts|Difference|Spend/.test(key)) summary[key] = roundMoney(summary[key]);
  });
  return Object.freeze(summary);
}

export function getReceptionReceiptReadiness({ purchase = {}, receptions = [], corrections = [], inbox = [], pendingOperations = [], conflicts = [] } = {}) {
  const related = values(receptions).filter((reception) => reception?.purchaseId === purchase?.id && !reception?.revertedAt);
  const effectiveItems = related.flatMap((reception) => projectEffectiveReceptionItems({
    receptionItems: values(reception.items), corrections,
  }));
  const shortageClosed = new Set(effectiveItems
    .filter((item) => item.shortageClosed).map((item) => item.purchaseItemId));
  const rows = values(purchase?.items).map((item) => {
    const accepted = effectiveItems.filter((entry) => entry.purchaseItemId === item.id)
      .reduce((total, entry) => total + number(entry.acceptedQuantity), 0);
    return { id: item.id, fulfillment: getPurchaseItemFulfillment(item, accepted) };
  }).filter((row) => row.fulfillment.purchasedQuantity > 0);
  const completed = rows.every((row) => row.fulfillment.receptionPendingQuantity === 0 || shortageClosed.has(row.id));
  const blockingIncidents = values(inbox).some((row) => row.purchaseId === purchase?.id && row.hasBlockingIncidents);
  const hasPendingOperations = values(pendingOperations).length > 0;
  const hasConflicts = values(conflicts).length > 0;
  return Object.freeze({
    completed,
    definitive: completed && !blockingIncidents && !hasPendingOperations && !hasConflicts,
    draft: completed && (blockingIncidents || hasPendingOperations || hasConflicts),
    blockingIncidents,
    hasPendingOperations,
    hasConflicts,
  });
}

export function getPurchaseCostSummary({ purchase = {}, receptions = [], corrections = [], traceEvents = [] } = {}) {
  const related = values(receptions).filter((reception) => (
    reception?.purchaseId === purchase?.id && !reception?.revertedAt
  ));
  const items = values(purchase?.items).map((purchaseItem) => {
    const receptionItems = related.flatMap((reception) => projectEffectiveReceptionItems({
      receptionItems: values(reception.items), corrections,
    })
      .filter((item) => item.purchaseItemId === purchaseItem.id));
    const acceptedQuantity = receptionItems.reduce(
      (sum, item) => sum + number(item.acceptedQuantity), 0,
    );
    const actualTotal = receptionItems.reduce(
      (sum, item) => sum + getReceptionItemActualCost(item, purchaseItem), 0,
    );
    const originalQuotedQuantity = getOriginalQuotedQuantity(purchaseItem, traceEvents);
    const fulfillment = getPurchaseItemFulfillment({
      ...purchaseItem, originalQuotedQuantity,
    }, acceptedQuantity);
    const estimatedUnitCost = number(purchaseItem.estimatedUnitCost ?? purchaseItem.unitCost);
    const actualPurchasedCost = roundMoney(
      (fulfillment.purchasedQuantity * number(purchaseItem.unitCost))
      + number(purchaseItem.additionalCharges) - number(purchaseItem.discounts),
    );
    return {
      purchaseItemId: purchaseItem.id,
      estimatedTotal: roundMoney(
        purchaseItem.estimatedTotalCost
          ?? originalQuotedQuantity * estimatedUnitCost,
      ),
      estimatedOriginalCost: roundMoney(originalQuotedQuantity * estimatedUnitCost),
      currentRequiredEstimatedCost: roundMoney(fulfillment.requiredQuantity * estimatedUnitCost),
      actualPurchasedCost,
      actualAcceptedCost: roundMoney(actualTotal),
      materialAddedAfterQuote: originalQuotedQuantity === 0 && fulfillment.requiredQuantity > 0,
      orderedTotal: roundMoney(
        fulfillment.orderedQuantity * number(purchaseItem.unitCost),
      ),
      purchasedTotal: roundMoney(fulfillment.purchasedQuantity * number(purchaseItem.unitCost)),
      ...fulfillment,
      orderedUnitPrice: number(purchaseItem.unitCost),
      pendingTotal: Math.max(0, roundMoney(
        fulfillment.purchasePendingQuantity * number(purchaseItem.unitCost),
      )),
      receptionPendingTotal: Math.max(0, roundMoney(
        fulfillment.receptionPendingQuantity * number(purchaseItem.unitCost),
      )),
      acceptedTotal: roundMoney(acceptedQuantity * number(purchaseItem.unitCost)),
      actualTotal: roundMoney(actualTotal),
    };
  });
  const total = (field) => roundMoney(items.reduce((sum, item) => sum + item[field], 0));
  return Object.freeze({
    purchaseId: purchase?.id || null,
    purchaseEstimatedTotal: total('estimatedTotal'),
    purchaseOrderedTotal: total('orderedTotal'),
    purchasePurchasedTotal: total('purchasedTotal'),
    purchaseAcceptedTotal: total('acceptedTotal'),
    purchaseActualTotal: total('actualTotal'),
    estimatedOriginalCost: total('estimatedOriginalCost'),
    currentRequiredEstimatedCost: total('currentRequiredEstimatedCost'),
    actualPurchasedCost: total('actualPurchasedCost'),
    actualAcceptedCost: total('actualAcceptedCost'),
    requiredQuantity: total('requiredQuantity'),
    orderedQuantity: total('orderedQuantity'),
    purchasedQuantity: total('purchasedQuantity'),
    acceptedQuantity: total('acceptedQuantity'),
    purchasePendingQuantity: total('purchasePendingQuantity'),
    purchasePendingTotal: total('pendingTotal'),
    receptionPendingQuantity: total('receptionPendingQuantity'),
    receptionPendingTotal: total('receptionPendingTotal'),
    projectMissingQuantity: total('projectMissingQuantity'),
    surplusPurchasedQuantity: total('surplusPurchasedQuantity'),
    surplusReceivedQuantity: total('surplusReceivedQuantity'),
    items,
  });
}

function quoteForm(quote) {
  return quote?.form || quote?.form_data || quote || {};
}

function quoteNumber(quote, ...fields) {
  const form = quoteForm(quote);
  for (const field of fields) {
    const candidate = quote?.[field] ?? form?.[field];
    if (candidate !== '' && candidate !== null && candidate !== undefined
      && Number.isFinite(Number(candidate))) return Number(candidate);
  }
  return 0;
}

function margin(profit, sale) {
  return sale > 0 ? roundMoney((profit / sale) * 100) : 0;
}

export function getProjectProfitabilitySummary({
  quote = {}, purchases = [], receptions = [],
} = {}) {
  const quoteId = quote?.id;
  const relatedPurchases = values(purchases).filter((purchase) => (
    purchase?.quoteId === quoteId || purchase?.quote_id === quoteId
  ));
  const purchaseSummaries = relatedPurchases.map((purchase) => (
    getPurchaseCostSummary({ purchase, receptions })
  ));
  const sum = (field) => roundMoney(
    purchaseSummaries.reduce((total, summary) => total + summary[field], 0),
  );
  const saleTotal = roundMoney(quoteNumber(quote, 'total', 'totalCliente'));
  const purchaseEstimatedTotal = sum('purchaseEstimatedTotal');
  const projectEstimatedCost = roundMoney(
    quoteNumber(quote, 'internalTotal', 'costoInterno') || purchaseEstimatedTotal,
  );
  const projectActualCost = sum('purchaseActualTotal');
  const estimatedProfit = roundMoney(saleTotal - projectEstimatedCost);
  const actualProfit = roundMoney(saleTotal - projectActualCost);
  return Object.freeze({
    saleTotal,
    purchaseEstimatedTotal,
    purchaseOrderedTotal: sum('purchaseOrderedTotal'),
    purchaseAcceptedTotal: sum('purchaseAcceptedTotal'),
    purchaseActualTotal: projectActualCost,
    projectEstimatedCost,
    projectActualCost,
    estimatedProfit,
    actualProfit,
    estimatedMargin: margin(estimatedProfit, saleTotal),
    actualMargin: margin(actualProfit, saleTotal),
    costVariance: roundMoney(projectActualCost - projectEstimatedCost),
    profitVariance: roundMoney(actualProfit - estimatedProfit),
    purchases: purchaseSummaries,
  });
}
