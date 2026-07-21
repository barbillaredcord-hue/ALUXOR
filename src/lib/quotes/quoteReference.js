export function normalizeQuoteReference(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function uniqueReferences(values) {
  return [...new Set(values.map(normalizeQuoteReference).filter(Boolean))];
}

export function quoteReferencesFromProductionOrder(order) {
  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    return uniqueReferences([order]);
  }

  const snapshot = order.formSnapshot && typeof order.formSnapshot === 'object'
    ? order.formSnapshot
    : {};

  return uniqueReferences([
    order.quoteId,
    order.quote_id,
    order.legacyId,
    order.legacy_id,
    order.uuid,
    snapshot.quoteId,
    snapshot.quote_id,
    snapshot.legacyId,
    snapshot.legacy_id,
    snapshot.uuid,
  ]);
}

export function findQuoteByReferences(quotes = [], references = []) {
  const normalizedReferences = new Set(uniqueReferences(
    Array.isArray(references) ? references : [references]
  ));
  if (!normalizedReferences.size || !Array.isArray(quotes)) return null;

  return quotes.find((quote) => {
    if (!quote || typeof quote !== 'object' || Array.isArray(quote)) return false;

    // Compatibilidad acotada con registros heredados que conservaron la referencia original.
    return [
      quote.id,
      quote.quoteId,
      quote.quote_id,
      quote.legacyId,
      quote.legacy_id,
      quote.uuid,
    ].some((value) => normalizedReferences.has(normalizeQuoteReference(value)));
  }) || null;
}

export function findQuoteByReference(quotes = [], quoteId) {
  return findQuoteByReferences(quotes, [quoteId]);
}

export function findQuoteForProductionOrder(quotes = [], order) {
  return findQuoteByReferences(
    quotes,
    quoteReferencesFromProductionOrder(order),
  );
}

export function normalizeSharedProjectNote(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function timestampValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveSharedProjectNote({
  quoteNote,
  productionNote,
  quoteUpdatedAt,
  productionUpdatedAt,
  preferredSource = 'quote',
} = {}) {
  const quote = normalizeSharedProjectNote(quoteNote);
  const production = normalizeSharedProjectNote(productionNote);

  if (quote === production) {
    return { value: quote, source: 'equal', quoteNeedsUpdate: false, productionNeedsUpdate: false };
  }

  let source;
  if (!quote) source = 'production';
  else if (!production) source = 'quote';
  else {
    const quoteTime = timestampValue(quoteUpdatedAt);
    const productionTime = timestampValue(productionUpdatedAt);
    source = quoteTime === productionTime
      ? preferredSource
      : quoteTime > productionTime ? 'quote' : 'production';
  }

  const value = source === 'production' ? production : quote;
  return {
    value,
    source,
    quoteNeedsUpdate: quote !== value,
    productionNeedsUpdate: production !== value,
  };
}

export function productionOrderMatchesQuote(order, quote) {
  return Boolean(findQuoteForProductionOrder([quote], order));
}
