import { usableAreaAfterMargins } from './geometry.js';
import { validateOptimizationResult } from './validation.js';

const CANDIDATE_CONTRACT_VERSION = 1;

function stableCandidateSignature(strategy, config, pieces) {
  return JSON.stringify([
    strategy,
    config.sheetWidth,
    config.sheetHeight,
    config.kerf,
    config.allowRotation,
    [
      config.margins?.top,
      config.margins?.right,
      config.margins?.bottom,
      config.margins?.left,
    ],
    (config.blockedRegions || []).map((region) => [
      region.id,
      region.sourceId ?? null,
      region.x,
      region.y,
      region.width,
      region.height,
    ]),
    (config.reservedRegions || []).map((region) => [
      region.id,
      region.sourceId ?? null,
      region.x,
      region.y,
      region.width,
      region.height,
    ]),
    pieces.map((piece) => [
      piece.id,
      piece.sourceId ?? null,
      piece.originalWidth,
      piece.originalHeight,
      piece.quantity,
      piece.index,
      piece.rotation,
      piece.grainDirection ?? null,
      piece.priority,
    ]),
  ]);
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function candidateId(strategy, config, pieces) {
  return `${strategy}-${stableHash(stableCandidateSignature(strategy, config, pieces))}`;
}

export function createStrategySheet(index, config) {
  const usable = usableAreaAfterMargins(
    config.sheetWidth,
    config.sheetHeight,
    config.margins,
  );
  return {
    index,
    width: config.sheetWidth,
    height: config.sheetHeight,
    pieces: [],
    cursorX: usable.x,
    cursorY: usable.y,
    shelfHeight: 0,
  };
}

export function summarizeStrategySheet(sheet) {
  const sheetArea = sheet.width * sheet.height;
  const usedArea = sheet.pieces.reduce((sum, piece) => (
    sum + piece.width * piece.height
  ), 0);
  const wasteArea = Math.max(0, sheetArea - usedArea);
  const efficiencyPercent = sheetArea > 0
    ? Math.min(100, (usedArea / sheetArea) * 100)
    : 0;
  const pieces = sheet.pieces.map((piece) => ({
    ...piece,
    nombre: piece.name,
    ancho: piece.width,
    alto: piece.height,
    indice: piece.index,
    cantidad: piece.quantity,
  }));
  return {
    ...sheet,
    ancho: sheet.width,
    alto: sheet.height,
    anchoHoja: sheet.width,
    altoHoja: sheet.height,
    pieces,
    piezasColocadas: sheet.pieces.map((piece) => ({
      ...piece,
      nombre: piece.name,
      ancho: piece.width,
      alto: piece.height,
      indice: piece.index,
      cantidad: piece.quantity,
    })),
    usedArea,
    wasteArea,
    efficiencyPercent,
    areaUsada: usedArea,
    areaDesperdiciada: wasteArea,
    porcentajeAprovechamiento: efficiencyPercent,
  };
}

function accountingDiagnostics(pieces, placedPieces, unplacedPieces) {
  const expected = new Map(pieces.map((piece) => [piece.id, piece]));
  const actual = new Map();
  [...placedPieces, ...unplacedPieces].forEach((piece) => {
    actual.set(piece.id, (actual.get(piece.id) || 0) + 1);
  });
  const diagnostics = [];

  expected.forEach((piece, id) => {
    const count = actual.get(id) || 0;
    if (count === 0) {
      diagnostics.push({
        code: 'PIECE_ACCOUNTING_MISSING',
        category: 'physical',
        message: `La pieza ${piece.name} no fue contabilizada.`,
        pieceId: id,
        ...(piece.sourceId !== undefined ? { sourceId: piece.sourceId } : {}),
      });
    } else if (count > 1) {
      diagnostics.push({
        code: 'PIECE_ACCOUNTING_DUPLICATE',
        category: 'physical',
        message: `La pieza ${piece.name} fue contabilizada más de una vez.`,
        pieceId: id,
        ...(piece.sourceId !== undefined ? { sourceId: piece.sourceId } : {}),
      });
    }
  });
  actual.forEach((count, id) => {
    if (!expected.has(id)) {
      diagnostics.push({
        code: 'PIECE_ACCOUNTING_UNEXPECTED',
        category: 'physical',
        message: `La pieza ${id} no pertenece a la entrada normalizada.`,
        pieceId: id,
        count,
      });
    }
  });
  return diagnostics;
}

export function createStrategyCandidate({
  strategy,
  config,
  pieces,
  sourcePieces,
  sheets,
  unplacedPieces,
  inputValidation,
  metadata = {},
}) {
  const summarizedSheets = sheets.map(summarizeStrategySheet);
  const placedPieces = summarizedSheets.flatMap((sheet) => (
    sheet.pieces.map((piece) => ({ ...piece, sheetIndex: sheet.index }))
  ));
  const usedArea = summarizedSheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  const totalSheetArea = config.sheetWidth * config.sheetHeight * summarizedSheets.length;
  const wasteArea = Math.max(0, totalSheetArea - usedArea);
  const utilization = totalSheetArea > 0
    ? Math.min(100, (usedArea / totalSheetArea) * 100)
    : 0;
  const summary = {
    requiredSheets: summarizedSheets.length,
    totalSheetArea,
    usedArea,
    wasteArea,
    utilization,
    totalPieceCount: pieces.length,
    placedPieceCount: placedPieces.length,
    unplacedPieceCount: unplacedPieces.length,
  };
  const physicalValidation = validateOptimizationResult({
    sheets: summarizedSheets,
    unplacedPieces,
    utilization,
    wasteArea,
    config,
    inputValidation,
  });
  const accounting = accountingDiagnostics(pieces, placedPieces, unplacedPieces);
  const complete = accounting.length === 0;
  const accountingWarnings = accounting.map((item) => item.message);
  const validation = {
    ...physicalValidation,
    isPhysicallyValid: physicalValidation.isPhysicallyValid && complete,
    warnings: [...new Set([...physicalValidation.warnings, ...accountingWarnings])],
    errors: [...physicalValidation.errors, ...accounting],
    diagnostics: [...physicalValidation.diagnostics, ...accounting],
  };

  return {
    id: candidateId(strategy, config, pieces),
    strategy,
    sheets: summarizedSheets,
    placedPieces,
    unplacedPieces: unplacedPieces.map((piece) => ({ ...piece })),
    validation,
    diagnostics: validation.diagnostics,
    summary,
    metadata: {
      contractVersion: CANDIDATE_CONTRACT_VERSION,
      inputPieceCount: pieces.length,
      sourcePieceCount: Array.isArray(sourcePieces) ? sourcePieces.length : 0,
      placedPieceCount: placedPieces.length,
      unplacedPieceCount: unplacedPieces.length,
      allPlaced: unplacedPieces.length === 0,
      ...metadata,
    },
    valid: validation.isPhysicallyValid,
    complete,
  };
}
