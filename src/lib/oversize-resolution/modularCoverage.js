import { convertLength } from '../material-calculator/engine.js';

export const MODULAR_COVERAGE_ORIENTATIONS = Object.freeze({
  VERTICAL: 'vertical',
  HORIZONTAL: 'horizontal',
});

const ROUND_FACTOR = 1e9;

function round(value) {
  return Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;
}

function length(value, unit) {
  if (value === '' || value === null || value === undefined) return null;
  const normalized = convertLength(value, unit, 'cm');
  return Number.isFinite(normalized) ? round(normalized) : null;
}

function invalid(message, orientation) {
  return {
    feasible: false,
    orientation,
    stripsRequired: 0,
    stripsPerSurface: 0,
    cutLengthPerStrip: 0,
    grossCoverage: 0,
    netCoverage: 0,
    trimWidth: 0,
    offcutLengthPerStrip: 0,
    totalLinearLength: 0,
    warnings: [message],
    explanation: message,
    unit: 'cm',
  };
}

export function resolveModularCoverage(input = {}) {
  const unit = String(input.unit || 'cm').trim().toLowerCase();
  const orientation = String(
    input.orientation || MODULAR_COVERAGE_ORIENTATIONS.VERTICAL,
  ).trim().toLowerCase();
  if (!Object.values(MODULAR_COVERAGE_ORIENTATIONS).includes(orientation)) {
    return invalid('Selecciona una orientación modular válida.', orientation);
  }

  const requiredWidth = length(input.requiredWidth, unit);
  const requiredLength = length(input.requiredLength, unit);
  const plankWidth = length(input.plankWidth, unit);
  const plankLength = length(input.plankLength, unit);
  const kerf = length(input.kerf ?? 0, unit);
  const jointGap = length(input.jointGap ?? 0, unit);
  const quantity = Number(input.quantity ?? 1);
  const allowRotation = input.allowRotation !== false;
  const allowSideTrim = input.allowSideTrim !== false;

  if (
    ![requiredWidth, requiredLength, plankWidth, plankLength].every((value) => value > 0)
    || !Number.isInteger(quantity)
    || quantity <= 0
    || kerf < 0
    || jointGap < 0
  ) {
    return invalid('Las dimensiones, cantidad, kerf y junta deben ser físicamente válidos.', orientation);
  }
  if (orientation === MODULAR_COVERAGE_ORIENTATIONS.HORIZONTAL && !allowRotation) {
    return invalid('La orientación horizontal requiere permitir el giro de instalación.', orientation);
  }

  const coverageSpan = orientation === MODULAR_COVERAGE_ORIENTATIONS.VERTICAL
    ? requiredWidth
    : requiredLength;
  const cutLengthPerStrip = orientation === MODULAR_COVERAGE_ORIENTATIONS.VERTICAL
    ? requiredLength
    : requiredWidth;
  if (cutLengthPerStrip > plankLength) {
    return invalid(
      `El largo comercial de ${plankLength} cm no alcanza el corte transversal de ${cutLengthPerStrip} cm.`,
      orientation,
    );
  }

  const stripsPerSurface = Math.ceil((coverageSpan + jointGap) / (plankWidth + jointGap));
  const grossCoverage = round(
    stripsPerSurface * plankWidth + Math.max(0, stripsPerSurface - 1) * jointGap,
  );
  const trimWidth = round(Math.max(0, grossCoverage - coverageSpan));
  if (trimWidth > 0 && !allowSideTrim) {
    return invalid('La cobertura requiere recorte lateral y esa operación está deshabilitada.', orientation);
  }

  const stripsRequired = stripsPerSurface * quantity;
  const offcutLengthPerStrip = round(plankLength - cutLengthPerStrip);
  const totalLinearLength = round(cutLengthPerStrip * stripsRequired);
  const finishedLastStripWidth = round(plankWidth - trimWidth);
  const warnings = [];
  if (trimWidth > 0) warnings.push('La última tira requiere recorte lateral.');
  if (jointGap > 0) warnings.push(`La cobertura incluye juntas de ${jointGap} cm.`);
  if (kerf > 0) warnings.push(`Considera un kerf de ${kerf} cm en cada corte longitudinal.`);

  return {
    feasible: true,
    orientation,
    stripsRequired,
    stripsPerSurface,
    cutLengthPerStrip: round(cutLengthPerStrip),
    grossCoverage,
    netCoverage: round(coverageSpan),
    trimWidth,
    finishedLastStripWidth,
    offcutLengthPerStrip,
    totalLinearLength,
    quantity,
    plankWidth,
    plankLength,
    jointGap,
    kerf,
    warnings,
    explanation: `La superficie se obtiene ensamblando ${stripsPerSurface} tira(s) comerciales${
      trimWidth > 0 ? '; la última requiere recorte lateral' : ''
    }.`,
    unit: 'cm',
  };
}

export function modularCoveragePieces({
  sourcePiece = {},
  coverage,
  alternativeId,
} = {}) {
  if (!coverage?.feasible || !sourcePiece.id || !alternativeId) return [];
  return Array.from({ length: coverage.stripsPerSurface }, (_, offset) => {
    const stripIndex = offset + 1;
    const last = stripIndex === coverage.stripsPerSurface;
    return {
      id: `${sourcePiece.id}:${alternativeId}:strip-${stripIndex}`,
      name: `${sourcePiece.name || sourcePiece.nombre || 'Pieza'} · tira ${stripIndex}`,
      width: coverage.plankWidth,
      height: coverage.cutLengthPerStrip,
      quantity: coverage.quantity,
      sourcePieceId: sourcePiece.id,
      stripIndex,
      stripCount: coverage.stripsPerSurface,
      sectionIndex: stripIndex,
      sectionCount: coverage.stripsPerSurface,
      modularCoverage: true,
      finishedCoverageWidth: last
        ? coverage.finishedLastStripWidth
        : coverage.plankWidth,
      grossCutWidth: coverage.plankWidth,
      trimRequired: last && coverage.trimWidth > 0,
      trimWidth: last ? coverage.trimWidth : 0,
      installationOrientation: coverage.orientation,
      allowRotation: false,
      grainDirection: sourcePiece.grainDirection ?? sourcePiece.veta ?? null,
    };
  });
}
