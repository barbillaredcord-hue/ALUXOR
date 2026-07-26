export const DEFAULT_CUT_CONFIG = Object.freeze({
  sheetWidth: 122,
  sheetHeight: 244,
  allowRotation: true,
  kerf: 0.3,
  strategy: 'largest-first',
});

export const ZERO_MARGINS = Object.freeze({
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
});

export function finiteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function legacyNonNegativeNumber(value) {
  const number = finiteNumber(value);
  return number === null ? 0 : Math.max(0, number);
}

function marginValue(source, key, fallback = 0) {
  if (typeof source === 'number' || typeof source === 'string') {
    return finiteNumber(source);
  }
  return finiteNumber(source?.[key] ?? source?.[{
    top: 'superior',
    right: 'derecho',
    bottom: 'inferior',
    left: 'izquierdo',
  }[key]] ?? fallback);
}

export function normalizeMargins(value) {
  const source = value ?? ZERO_MARGINS;
  return {
    top: marginValue(source, 'top'),
    right: marginValue(source, 'right'),
    bottom: marginValue(source, 'bottom'),
    left: marginValue(source, 'left'),
  };
}

export function normalizeRegion(region = {}, index = 0, kind = 'blocked') {
  const sourceId = region.id ?? region.sourceId;
  const normalized = {
    id: `${kind}-region-${index + 1}`,
    kind,
    x: finiteNumber(region.x),
    y: finiteNumber(region.y),
    width: finiteNumber(region.width ?? region.ancho),
    height: finiteNumber(region.height ?? region.alto),
  };
  if (sourceId !== undefined && sourceId !== null && String(sourceId).trim()) {
    normalized.sourceId = sourceId;
  }
  return normalized;
}

export function normalizeRegions(regions, kind) {
  if (regions === undefined || regions === null) return [];
  if (!Array.isArray(regions)) return [];
  return regions.map((region, index) => normalizeRegion(region, index, kind));
}

function normalizeRotationValue(value) {
  if (value === true) return 'allowed';
  if (value === false) return 'forbidden';
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['allowed', 'permitida', 'permitido', 'allow'].includes(normalized)) return 'allowed';
  if (['forbidden', 'prohibited', 'prohibida', 'prohibido', 'none'].includes(normalized)) {
    return 'forbidden';
  }
  if (['required', 'mandatory', 'obligatoria', 'obligatorio'].includes(normalized)) {
    return 'required';
  }
  return null;
}

function hasGrainDirection(value) {
  if (value === undefined || value === null || value === false) return false;
  const normalized = String(value).trim().toLowerCase();
  return !['', 'false', 'none', 'sin veta', 'ninguna'].includes(normalized);
}

export function normalizePieceRestrictions(piece = {}) {
  const rawRotation = piece.rotation ?? piece.rotacion;
  const explicitRotation = normalizeRotationValue(rawRotation);
  const grainDirection = piece.grainDirection ?? piece.veta ?? null;
  const grainRestricted = hasGrainDirection(grainDirection);
  let rotation = explicitRotation;

  if (!rotation && piece.rotationRequired === true) rotation = 'required';
  if (!rotation && piece.allowRotation === false) rotation = 'forbidden';
  if (!rotation && grainRestricted) rotation = 'forbidden';
  if (!rotation) rotation = 'allowed';

  return {
    rotation,
    rotationExplicit: rawRotation !== undefined || piece.rotationRequired === true,
    rawRotation,
    allowRotation: rotation !== 'forbidden',
    rotationRequired: rotation === 'required',
    grainDirection,
    grainRestricted,
    priority: finiteNumber(piece.priority ?? piece.prioridad) ?? 0,
  };
}

export function expandCutPieces(pieces = []) {
  if (!Array.isArray(pieces)) return [];
  return pieces.flatMap((piece, pieceIndex) => {
    const source = piece && typeof piece === 'object' ? piece : {};
    const quantityValue = finiteNumber(source.cantidad ?? source.quantity);
    const quantity = Math.max(1, Math.floor(Math.max(0, quantityValue ?? 0) || 1));
    const originalWidth = legacyNonNegativeNumber(source.ancho ?? source.width);
    const originalHeight = legacyNonNegativeNumber(source.alto ?? source.height);
    const name = source.nombre || source.name || 'Pieza';
    const restrictions = normalizePieceRestrictions(source);
    const hasSourceId = source.id !== undefined
      && source.id !== null
      && String(source.id).trim();

    return Array.from({ length: quantity }, (_, index) => {
      const normalized = {
        id: `${name}-${pieceIndex}-${index}`,
        name,
        index: index + 1,
        quantity,
        originalWidth,
        originalHeight,
        width: originalWidth,
        height: originalHeight,
        rotated: false,
        rotation: restrictions.rotation,
        allowRotation: restrictions.allowRotation,
        rotationRequired: restrictions.rotationRequired,
        grainDirection: restrictions.grainDirection,
        priority: restrictions.priority,
        sourceIndex: pieceIndex,
      };
      if (hasSourceId) normalized.sourceId = source.id;
      return normalized;
    });
  });
}

export function normalizeCutConfig(input = {}) {
  const marginSource = input.margins ?? input.margin ?? input.margenes;
  const blockedSource = input.blockedRegions ?? input.zonasBloqueadas;
  const reservedSource = input.reservedRegions ?? input.zonasReservadas;
  return {
    ...DEFAULT_CUT_CONFIG,
    ...input,
    sheetWidth: legacyNonNegativeNumber(
      input.sheetWidth ?? input.anchoHoja ?? DEFAULT_CUT_CONFIG.sheetWidth,
    ),
    sheetHeight: legacyNonNegativeNumber(
      input.sheetHeight ?? input.altoHoja ?? DEFAULT_CUT_CONFIG.sheetHeight,
    ),
    kerf: legacyNonNegativeNumber(input.kerf ?? DEFAULT_CUT_CONFIG.kerf),
    allowRotation: input.allowRotation ?? DEFAULT_CUT_CONFIG.allowRotation,
    strategy: input.strategy || DEFAULT_CUT_CONFIG.strategy,
    margins: normalizeMargins(marginSource),
    blockedRegions: normalizeRegions(blockedSource, 'blocked'),
    reservedRegions: normalizeRegions(reservedSource, 'reserved'),
  };
}

export function normalizeCutInput(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const sourcePieces = source.piezas ?? source.pieces ?? [];
  return {
    config: normalizeCutConfig(source),
    pieces: expandCutPieces(sourcePieces),
    sourcePieces,
  };
}
