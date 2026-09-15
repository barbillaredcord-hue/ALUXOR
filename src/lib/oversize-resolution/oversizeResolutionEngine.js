import { optimizeCuts } from '../cut-optimizer/optimizer.js';
import { convertLength } from '../material-calculator/engine.js';
import {
  MODULAR_COVERAGE_ORIENTATIONS,
  modularCoveragePieces,
  resolveModularCoverage,
} from './modularCoverage.js';

export const MATERIAL_LAYOUT_TYPES = Object.freeze({
  SHEET: 'SHEET',
  MODULAR_PLANK: 'MODULAR_PLANK',
  LINEAR_PROFILE: 'LINEAR_PROFILE',
  SPECIAL: 'SPECIAL',
});

export const OVERSIZE_REASONS = Object.freeze({
  EXCEEDS_SHEET_WIDTH: 'EXCEEDS_SHEET_WIDTH',
  EXCEEDS_SHEET_LENGTH: 'EXCEEDS_SHEET_LENGTH',
  EXCEEDS_BOTH_AXES: 'EXCEEDS_BOTH_AXES',
  GRAIN_CONSTRAINT: 'GRAIN_CONSTRAINT',
  NO_VALID_ORIENTATION: 'NO_VALID_ORIENTATION',
});

export const OVERSIZE_ALTERNATIVE_TYPES = Object.freeze({
  LARGER_FORMAT: 'larger-format',
  BALANCED_SPLIT: 'balanced-split',
  OPTIMIZED_SPLIT: 'optimized-split',
  MODULAR_VERTICAL: 'modular-coverage-vertical',
  MODULAR_HORIZONTAL: 'modular-coverage-horizontal',
  SPECIAL_FABRICATION: 'special-fabrication',
});

const ROUND_FACTOR = 1e9;

function round(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.round(parsed * ROUND_FACTOR) / ROUND_FACTOR
    : null;
}

function finite(value, fallback = null) {
  if (value === '' || value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value) {
  return String(value ?? '').trim();
}

export function suggestMaterialLayoutType(material = {}) {
  const explicit = text(material.materialLayoutType).toUpperCase();
  if (Object.values(MATERIAL_LAYOUT_TYPES).includes(explicit)) return explicit;
  const name = text(material.name ?? material.nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /\b(lambrin|duela|tablilla|liston)\b/.test(name)
    ? MATERIAL_LAYOUT_TYPES.MODULAR_PLANK
    : MATERIAL_LAYOUT_TYPES.SHEET;
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normalizedMargins(margins = {}, unit = 'cm') {
  const source = typeof margins === 'number' ? {
    top: margins,
    right: margins,
    bottom: margins,
    left: margins,
  } : margins || {};
  return {
    top: round(convertLength(source.top ?? source.superior ?? 0, unit, 'cm') ?? 0),
    right: round(convertLength(source.right ?? source.derecho ?? 0, unit, 'cm') ?? 0),
    bottom: round(convertLength(source.bottom ?? source.inferior ?? 0, unit, 'cm') ?? 0),
    left: round(convertLength(source.left ?? source.izquierdo ?? 0, unit, 'cm') ?? 0),
  };
}

function normalizePiece(piece = {}, unit = 'cm') {
  const sourceUnit = piece.unit || unit;
  return {
    ...piece,
    id: text(piece.id),
    name: text(piece.name ?? piece.nombre) || 'Pieza',
    width: round(convertLength(piece.width ?? piece.ancho, sourceUnit, 'cm')),
    height: round(convertLength(
      piece.height ?? piece.length ?? piece.alto ?? piece.largo,
      sourceUnit,
      'cm',
    )),
    quantity: Math.max(1, Math.floor(finite(piece.quantity ?? piece.cantidad, 1))),
  };
}

function normalizeSheet(sheet = {}, unit = 'cm') {
  const sourceUnit = sheet.unit || unit;
  const margins = normalizedMargins(sheet.margins, sourceUnit);
  const width = round(convertLength(sheet.width ?? sheet.ancho, sourceUnit, 'cm'));
  const height = round(convertLength(
    sheet.height ?? sheet.length ?? sheet.alto ?? sheet.largo,
    sourceUnit,
    'cm',
  ));
  return {
    ...sheet,
    id: text(sheet.id) || `${width}x${height}`,
    unit: 'cm',
    width,
    height,
    margins,
    usableWidth: Math.max(0, width - margins.left - margins.right),
    usableHeight: Math.max(0, height - margins.top - margins.bottom),
    price: finite(sheet.price ?? sheet.precio),
    materialId: text(sheet.materialId),
  };
}

function grainRequired(piece, config) {
  const grain = piece.grainDirection ?? piece.veta;
  return config.grainRequired === true
    || (grain !== undefined && grain !== null && grain !== false && text(grain) !== '');
}

function allowedOrientations(piece, sheet, config) {
  const direct = piece.width <= sheet.usableWidth && piece.height <= sheet.usableHeight;
  const rotatedPhysical = piece.height <= sheet.usableWidth && piece.width <= sheet.usableHeight;
  const grain = grainRequired(piece, config);
  const rotationAllowed = config.allowRotation !== false && !grain
    && piece.allowRotation !== false;
  return {
    direct,
    rotatedPhysical,
    rotated: rotationAllowed && rotatedPhysical,
    grain,
    rotationAllowed,
  };
}

function oversizeReason(piece, sheet, config) {
  const orientations = allowedOrientations(piece, sheet, config);
  if (orientations.direct || orientations.rotated) return null;
  if (orientations.rotatedPhysical && orientations.grain) {
    return OVERSIZE_REASONS.GRAIN_CONSTRAINT;
  }
  if (orientations.rotatedPhysical && !orientations.rotationAllowed) {
    return OVERSIZE_REASONS.NO_VALID_ORIENTATION;
  }
  const exceedsWidth = piece.width > sheet.usableWidth;
  const exceedsLength = piece.height > sheet.usableHeight;
  if (exceedsWidth && exceedsLength) return OVERSIZE_REASONS.EXCEEDS_BOTH_AXES;
  if (exceedsWidth) return OVERSIZE_REASONS.EXCEEDS_SHEET_WIDTH;
  if (exceedsLength) return OVERSIZE_REASONS.EXCEEDS_SHEET_LENGTH;
  return OVERSIZE_REASONS.NO_VALID_ORIENTATION;
}

function excessFor(piece, sheet) {
  return {
    width: round(Math.max(0, piece.width - sheet.usableWidth)),
    length: round(Math.max(0, piece.height - sheet.usableHeight)),
    unit: 'cm',
  };
}

function optimizerPiece(piece, grain) {
  return {
    id: piece.id,
    name: piece.name,
    width: piece.width,
    height: piece.height,
    quantity: piece.quantity,
    allowRotation: piece.allowRotation,
    grainDirection: grain ? (piece.grainDirection || 'vertical') : null,
  };
}

function selectedCandidate(result) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  return candidates.find((candidate) => candidate.id === result.recommendedCandidateId)
    || candidates.find((candidate) => candidate.strategy === 'shelf')
    || null;
}

function evaluateWithSmartCut(pieces, sheet, config) {
  const result = optimizeCuts({
    sheetWidth: sheet.width,
    sheetHeight: sheet.height,
    allowRotation: config.allowRotation !== false,
    kerf: config.kerf,
    strategy: config.pieceOrder || 'largest-first',
    margins: sheet.margins,
    blockedRegions: config.blockedRegions,
    reservedRegions: config.reservedRegions,
    pieces: pieces.map((piece) => optimizerPiece(piece, grainRequired(piece, config))),
  });
  const candidate = selectedCandidate(result);
  const feasible = Boolean(
    candidate
    && candidate.valid === true
    && candidate.complete === true
    && candidate.validation?.isPhysicallyValid === true
    && candidate.unplacedPieces?.length === 0
  );
  return {
    feasible,
    candidateId: candidate?.id || null,
    strategy: candidate?.strategy || null,
    estimatedSheets: candidate?.summary?.requiredSheets ?? null,
    estimatedWaste: candidate?.summary?.wasteArea ?? null,
    utilization: candidate?.summary?.utilization ?? null,
    diagnostics: candidate?.validation?.diagnostics || result?.validation?.diagnostics || [],
  };
}

function resultingPiece(piece, axis, size, index, alternativeId) {
  return {
    id: `${piece.id}:${alternativeId}:section-${index}`,
    name: `${piece.name} · sección ${index}`,
    width: axis === 'width' ? round(size) : piece.width,
    height: axis === 'height' ? round(size) : piece.height,
    quantity: piece.quantity,
    sourcePieceId: piece.id,
    sectionIndex: index,
    sectionCount: 2,
    allowRotation: piece.allowRotation,
    grainDirection: piece.grainDirection ?? piece.veta ?? null,
  };
}

function splitPieces(piece, axis, firstSize, alternativeId) {
  const total = axis === 'width' ? piece.width : piece.height;
  const first = round(firstSize);
  const second = round(total - first);
  if (first <= 0 || second <= 0 || round(first + second) !== round(total)) return [];
  return [
    resultingPiece(piece, axis, first, 1, alternativeId),
    resultingPiece(piece, axis, second, 2, alternativeId),
  ];
}

function splitAxis(piece, sheet) {
  const exceedsWidth = piece.width > sheet.usableWidth;
  const exceedsLength = piece.height > sheet.usableHeight;
  if (exceedsWidth === exceedsLength) return null;
  return exceedsWidth ? 'width' : 'height';
}

function splitAlternative({ piece, sheet, config, type, point, suffix = '' }) {
  const axis = splitAxis(piece, sheet);
  const id = `${type}:${piece.id}${suffix}`;
  const pieces = axis ? splitPieces(piece, axis, point, id) : [];
  const evaluation = pieces.length === 2
    ? evaluateWithSmartCut(pieces, sheet, config)
    : { feasible: false, estimatedSheets: null, estimatedWaste: null, diagnostics: [] };
  const cost = evaluation.estimatedSheets !== null && sheet.price !== null
    ? round(evaluation.estimatedSheets * sheet.price)
    : null;
  return {
    id,
    type,
    feasible: evaluation.feasible,
    resultingPieces: pieces,
    sheetFormat: { id: sheet.id, width: sheet.width, height: sheet.height, unit: 'cm' },
    joints: pieces.length === 2 ? 1 : 0,
    estimatedSheets: evaluation.estimatedSheets,
    estimatedWaste: evaluation.estimatedWaste,
    estimatedCost: cost,
    respectsGrain: pieces.length === 2 && pieces.every((section) => (
      section.grainDirection === (piece.grainDirection ?? piece.veta ?? null)
    )),
    requiresSpecialFabrication: false,
    explanation: evaluation.feasible
      ? type === OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT
        ? 'Divide la pieza en dos secciones iguales y conserva sus dimensiones terminadas.'
        : 'Usa el formato actual y selecciona el punto con mejor resultado físico evaluado por Smart Cut.'
      : 'La división de una sola unión no produce dos secciones físicamente válidas.',
    warnings: evaluation.feasible ? ['Requiere una unión confirmada por el usuario.'] : [],
    rank: null,
    evaluation,
  };
}

function compatibleFormat(format, currentMaterialId) {
  if (format.active === false) return false;
  const formatMaterialId = text(format.materialId);
  const compatibleIds = Array.isArray(format.compatibleMaterialIds)
    ? format.compatibleMaterialIds.map(text)
    : [];
  return Boolean(
    currentMaterialId
    && (formatMaterialId === currentMaterialId || compatibleIds.includes(currentMaterialId))
  );
}

function largerFormatAlternatives(piece, currentSheet, formats, config) {
  return formats
    .map((format) => normalizeSheet(format, config.unit))
    .filter((format) => compatibleFormat(format, currentSheet.materialId))
    .filter((format) => (
      format.usableWidth > currentSheet.usableWidth
      || format.usableHeight > currentSheet.usableHeight
    ))
    .map((format) => {
      const evaluation = evaluateWithSmartCut([piece], format, config);
      return {
        id: `larger-format:${format.id}:${piece.id}`,
        type: OVERSIZE_ALTERNATIVE_TYPES.LARGER_FORMAT,
        feasible: evaluation.feasible,
        resultingPieces: [{ ...piece }],
        sheetFormat: {
          id: format.id,
          width: format.width,
          height: format.height,
          unit: 'cm',
        },
        joints: 0,
        estimatedSheets: evaluation.estimatedSheets,
        estimatedWaste: evaluation.estimatedWaste,
        estimatedCost: evaluation.estimatedSheets !== null && format.price !== null
          ? round(evaluation.estimatedSheets * format.price)
          : null,
        respectsGrain: evaluation.feasible,
        requiresSpecialFabrication: false,
        explanation: evaluation.feasible
          ? 'Conserva la pieza completa en un formato comercial compatible configurado.'
          : 'El formato configurado no resuelve todas las restricciones físicas.',
        warnings: [],
        rank: null,
        evaluation,
      };
    });
}

function modularCoverageAlternative(piece, sheet, config, orientation) {
  const type = orientation === MODULAR_COVERAGE_ORIENTATIONS.VERTICAL
    ? OVERSIZE_ALTERNATIVE_TYPES.MODULAR_VERTICAL
    : OVERSIZE_ALTERNATIVE_TYPES.MODULAR_HORIZONTAL;
  const id = `${type}:${piece.id}`;
  const coverage = resolveModularCoverage({
    requiredWidth: piece.width,
    requiredLength: piece.height,
    plankWidth: sheet.width,
    plankLength: sheet.height,
    quantity: piece.quantity,
    orientation,
    kerf: config.kerf,
    jointGap: config.jointGap,
    allowRotation: config.allowRotation,
    allowSideTrim: config.allowSideTrim,
    unit: 'cm',
  });
  const pieces = modularCoveragePieces({
    sourcePiece: piece,
    coverage,
    alternativeId: id,
  });
  const evaluation = coverage.feasible
    ? evaluateWithSmartCut(pieces, sheet, config)
    : { feasible: false, estimatedSheets: null, estimatedWaste: null, diagnostics: [] };
  const feasible = coverage.feasible && evaluation.feasible;
  return {
    id,
    type,
    feasible,
    resultingPieces: pieces,
    sheetFormat: { id: sheet.id, width: sheet.width, height: sheet.height, unit: 'cm' },
    joints: coverage.feasible
      ? Math.max(0, coverage.stripsPerSurface - 1) * coverage.quantity
      : 0,
    estimatedSheets: evaluation.estimatedSheets,
    estimatedWaste: evaluation.estimatedWaste,
    estimatedCost: evaluation.estimatedSheets !== null && sheet.price !== null
      ? round(evaluation.estimatedSheets * sheet.price)
      : null,
    respectsGrain: orientation === MODULAR_COVERAGE_ORIENTATIONS.VERTICAL
      || config.grainRequired !== true,
    requiresSpecialFabrication: false,
    explanation: feasible
      ? coverage.explanation
      : coverage.explanation || 'La cobertura modular no es físicamente válida.',
    warnings: [...coverage.warnings, ...(evaluation.diagnostics || []).map((item) => (
      item.message || item.code
    )).filter(Boolean)],
    rank: null,
    evaluation,
    modularCoverage: coverage,
  };
}

function modularAlternatives(piece, sheet, formats, config) {
  const preferredOrientation = config.installationOrientation
    === MODULAR_COVERAGE_ORIENTATIONS.HORIZONTAL
    ? MODULAR_COVERAGE_ORIENTATIONS.HORIZONTAL
    : MODULAR_COVERAGE_ORIENTATIONS.VERTICAL;
  const orientations = [
    preferredOrientation,
    preferredOrientation === MODULAR_COVERAGE_ORIENTATIONS.VERTICAL
      ? MODULAR_COVERAGE_ORIENTATIONS.HORIZONTAL
      : MODULAR_COVERAGE_ORIENTATIONS.VERTICAL,
  ];
  const modular = orientations
    .map((orientation) => modularCoverageAlternative(piece, sheet, config, orientation))
    .filter((alternative) => alternative.feasible);
  return [
    ...modular,
    ...largerFormatAlternatives(piece, sheet, formats, config),
  ];
}

function optimizedSplitAlternative(piece, sheet, config) {
  const axis = splitAxis(piece, sheet);
  if (!axis) {
    return splitAlternative({
      piece,
      sheet,
      config,
      type: OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT,
      point: 0,
    });
  }
  const total = axis === 'width' ? piece.width : piece.height;
  const usable = axis === 'width' ? sheet.usableWidth : sheet.usableHeight;
  const points = [total / 2, usable, total * 0.75, total * 0.6]
    .map(round)
    .filter((point) => point > 0 && point < total);
  const unique = [...new Set(points)].slice(0, 4);
  const options = unique.map((point, index) => splitAlternative({
    piece,
    sheet,
    config,
    type: OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT,
    point,
    suffix: `:${index + 1}`,
  }));
  const best = [...options].sort(compareAlternatives)[0];
  return best ? {
    ...best,
    id: `${OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT}:${piece.id}`,
    resultingPieces: best.resultingPieces.map((section, index) => ({
      ...section,
      id: `${piece.id}:${OVERSIZE_ALTERNATIVE_TYPES.OPTIMIZED_SPLIT}:section-${index + 1}`,
    })),
    evaluatedSplitPoints: options.map((option) => ({
      id: option.id,
      feasible: option.feasible,
      sizes: option.resultingPieces.map((section) => (
        axis === 'width' ? section.width : section.height
      )),
      estimatedSheets: option.estimatedSheets,
      estimatedWaste: option.estimatedWaste,
    })),
  } : null;
}

function metric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : Number.POSITIVE_INFINITY;
}

export function compareAlternatives(left, right) {
  const leftValues = [
    left.feasible ? 0 : 1,
    left.joints === 0 ? 0 : 1,
    metric(left.estimatedSheets),
    metric(left.estimatedWaste),
    metric(left.estimatedCost),
    metric(left.joints),
    left.respectsGrain ? 0 : 1,
  ];
  const rightValues = [
    right.feasible ? 0 : 1,
    right.joints === 0 ? 0 : 1,
    metric(right.estimatedSheets),
    metric(right.estimatedWaste),
    metric(right.estimatedCost),
    metric(right.joints),
    right.respectsGrain ? 0 : 1,
  ];
  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] !== rightValues[index]) return leftValues[index] - rightValues[index];
  }
  return left.type.localeCompare(right.type) || left.id.localeCompare(right.id);
}

function recommendationExplanation(alternative, currentSheetId) {
  if (!alternative) return 'No existe una alternativa disponible.';
  if (alternative.modularCoverage) return alternative.explanation;
  if (alternative.requiresSpecialFabrication) {
    return 'No existe una solución física automática; conserva la pieza para fabricación especial.';
  }
  if (alternative.joints === 0) {
    return `Recomendada porque conserva la pieza completa y requiere ${alternative.estimatedSheets} hoja(s).`;
  }
  return alternative.sheetFormat?.id === currentSheetId
    ? 'Recomendada porque utiliza el formato actual y genera el menor desperdicio entre las divisiones válidas.'
    : 'Recomendada por su resultado físico determinista y menor consumo entre las alternativas válidas.';
}

export function resolveOversizePiece({
  piece: rawPiece,
  sheet: rawSheet,
  alternativeFormats = [],
  config: rawConfig = {},
} = {}) {
  const unit = rawConfig.unit || rawSheet?.unit || rawPiece?.unit || 'cm';
  const piece = normalizePiece(rawPiece, unit);
  const sheet = normalizeSheet(rawSheet, unit);
  const config = {
    ...rawConfig,
    unit: 'cm',
    allowRotation: rawConfig.allowRotation !== false,
    allowSplit: rawConfig.allowSplit === true,
    maxJoints: finite(rawConfig.maxJoints, 1),
    kerf: round(convertLength(rawConfig.kerf ?? 0, unit, 'cm') ?? 0),
    grainRequired: grainRequired(piece, rawConfig),
    materialLayoutType: Object.values(MATERIAL_LAYOUT_TYPES).includes(
      text(rawConfig.materialLayoutType).toUpperCase(),
    ) ? text(rawConfig.materialLayoutType).toUpperCase() : MATERIAL_LAYOUT_TYPES.SHEET,
    installationOrientation: text(rawConfig.installationOrientation).toLowerCase()
      || MODULAR_COVERAGE_ORIENTATIONS.VERTICAL,
    jointGap: round(convertLength(rawConfig.jointGap ?? 0, unit, 'cm') ?? 0),
    allowSideTrim: rawConfig.allowSideTrim !== false,
  };
  const reason = oversizeReason(piece, sheet, config);
  if (!reason) {
    return {
      oversized: false,
      reason: null,
      excess: { width: 0, length: 0, unit: 'cm' },
      alternatives: [],
      recommendationId: null,
      diagnostics: [],
    };
  }

  const formats = Array.isArray(alternativeFormats) ? alternativeFormats : [];
  const alternatives = config.materialLayoutType === MATERIAL_LAYOUT_TYPES.MODULAR_PLANK
    ? modularAlternatives(piece, sheet, formats, config)
    : config.materialLayoutType === MATERIAL_LAYOUT_TYPES.SHEET
      ? largerFormatAlternatives(piece, sheet, formats, config)
      : [];
  if (
    config.materialLayoutType === MATERIAL_LAYOUT_TYPES.SHEET
    && config.allowSplit
    && config.maxJoints === 1
  ) {
    const axis = splitAxis(piece, sheet);
    const total = axis === 'width' ? piece.width : piece.height;
    alternatives.push(splitAlternative({
      piece,
      sheet,
      config,
      type: OVERSIZE_ALTERNATIVE_TYPES.BALANCED_SPLIT,
      point: total / 2,
    }));
    const optimized = optimizedSplitAlternative(piece, sheet, config);
    if (optimized) alternatives.push(optimized);
  }
  alternatives.push({
    id: `special-fabrication:${piece.id}`,
    type: OVERSIZE_ALTERNATIVE_TYPES.SPECIAL_FABRICATION,
    feasible: false,
    resultingPieces: [{ ...piece }],
    sheetFormat: null,
    joints: 0,
    estimatedSheets: null,
    estimatedWaste: null,
    estimatedCost: null,
    respectsGrain: true,
    requiresSpecialFabrication: true,
    explanation: 'Conserva la pieza original fuera de la optimización automática y pendiente de solución especial.',
    warnings: ['Requiere definición manual de fabricación.'],
    rank: null,
  });

  const rankedSource = config.materialLayoutType === MATERIAL_LAYOUT_TYPES.MODULAR_PLANK
    ? alternatives
    : [...alternatives].sort(compareAlternatives);
  const ranked = rankedSource.map((alternative, index) => ({
    ...alternative,
    rank: index + 1,
  }));
  const recommended = ranked.find((alternative) => alternative.feasible)
    || ranked.find((alternative) => alternative.requiresSpecialFabrication)
    || null;
  const signature = stableHash(JSON.stringify({
    piece: [piece.id, piece.width, piece.height, piece.quantity],
    sheet: [sheet.width, sheet.height, sheet.margins, sheet.materialId],
    config: [config.kerf, config.allowRotation, config.grainRequired, sheet.materialId],
    modular: [
      config.materialLayoutType,
      config.installationOrientation,
      config.jointGap,
      config.allowSideTrim,
    ],
  }));
  return {
    oversized: true,
    reason,
    excess: excessFor(piece, sheet),
    alternatives: ranked,
    recommendationId: recommended?.id || null,
    diagnostics: [{
      code: reason,
      message: recommendationExplanation(recommended, sheet.id),
      inputSignature: `oversize-resolution-v1:${signature}`,
    }],
    sourcePiece: piece,
    sheet,
    inputSignature: `oversize-resolution-v1:${signature}`,
  };
}
