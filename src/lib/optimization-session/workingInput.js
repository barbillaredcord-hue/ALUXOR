import {
  cloneOptimizationSessionValue,
  optimizationSessionHash,
  optimizationSessionText,
} from './helpers.js';

export const OPTIMIZATION_SESSION_WORKING_INPUT_VERSION = 1;
export const OPTIMIZATION_SESSION_WORKING_INPUT_KEY = 'workingInputV1';
const OPTIMIZATION_CANDIDATE_STRATEGIES = new Set(['shelf', 'best-fit']);
const OPTIMIZATION_PIECE_ORDERS = new Set(['largest-first', 'input-order']);

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalFinite(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalValue(entry)]),
  );
}

export function optimizationSessionCandidateStrategy(input = {}) {
  const strategy = optimizationSessionText(input.strategy);
  if (OPTIMIZATION_CANDIDATE_STRATEGIES.has(strategy)) return strategy;
  const candidateId = optimizationSessionText(input.selectedCandidateId);
  if (candidateId.startsWith('best-fit-')) return 'best-fit';
  if (candidateId.startsWith('shelf-')) return 'shelf';
  return null;
}

export function optimizationSessionPieceOrder(input = {}) {
  const pieceOrder = optimizationSessionText(input.pieceOrder);
  if (OPTIMIZATION_PIECE_ORDERS.has(pieceOrder)) return pieceOrder;
  const legacyStrategy = optimizationSessionText(input.strategy);
  return OPTIMIZATION_PIECE_ORDERS.has(legacyStrategy)
    ? legacyStrategy
    : 'largest-first';
}

export function normalizeOptimizationSessionWorkingInput(input = {}) {
  const selectedPieceIds = [...new Set(
    (Array.isArray(input.selectedPieceIds) ? input.selectedPieceIds : [])
      .map(optimizationSessionText)
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right));
  return canonicalValue({
    version: OPTIMIZATION_SESSION_WORKING_INPUT_VERSION,
    type: optimizationSessionText(input.type) || 'sheet',
    materialId: optimizationSessionText(input.materialId) || null,
    selectedPieceIds,
    selectedCandidateId: optimizationSessionText(input.selectedCandidateId) || null,
    unit: optimizationSessionText(input.unit) || 'cm',
    thickness: finite(input.thickness, 16),
    formatWidth: finite(input.formatWidth),
    formatHeight: finite(input.formatHeight),
    barLength: finite(input.barLength),
    price: finite(input.price),
    wastePercent: finite(input.wastePercent),
    marginPercent: finite(input.marginPercent),
    allowRotation: input.allowRotation !== false,
    grainDirection: Boolean(input.grainDirection),
    kerf: finite(input.kerf),
    strategy: optimizationSessionText(input.strategy) || 'largest-first',
    pieceOrder: optimizationSessionPieceOrder(input),
    treatment: optimizationSessionText(input.treatment),
    quantityPerPiece: finite(input.quantityPerPiece, 1),
    reserveQuantity: finite(input.reserveQuantity),
    margins: input.margins && typeof input.margins === 'object'
      ? canonicalValue(input.margins)
      : null,
    blockedRegions: Array.isArray(input.blockedRegions)
      ? canonicalValue(input.blockedRegions)
      : [],
    reservedRegions: Array.isArray(input.reservedRegions)
      ? canonicalValue(input.reservedRegions)
      : [],
    grainAngle: optionalFinite(input.grainAngle),
  });
}

export function serializeOptimizationSessionWorkingInput(input) {
  return JSON.stringify(normalizeOptimizationSessionWorkingInput(input));
}

export function optimizationSessionWorkingInputSignature(input) {
  return `optimization-working-input-v1:${
    optimizationSessionHash(serializeOptimizationSessionWorkingInput(input))
  }`;
}

export function optimizationSessionWorkingInputFromSession(
  session,
  fallback = null,
) {
  const serialized = session?.configuration?.[OPTIMIZATION_SESSION_WORKING_INPUT_KEY];
  if (typeof serialized === 'string' && serialized.trim()) {
    try {
      return normalizeOptimizationSessionWorkingInput(JSON.parse(serialized));
    } catch {
      return fallback ? normalizeOptimizationSessionWorkingInput(fallback) : null;
    }
  }
  return fallback ? normalizeOptimizationSessionWorkingInput(fallback) : null;
}

export function sessionWithOptimizationWorkingInput(session, input) {
  const workingInput = normalizeOptimizationSessionWorkingInput(input);
  return {
    ...cloneOptimizationSessionValue(session),
    configuration: {
      ...cloneOptimizationSessionValue(session?.configuration || {}),
      [OPTIMIZATION_SESSION_WORKING_INPUT_KEY]:
        serializeOptimizationSessionWorkingInput(workingInput),
    },
  };
}
