import {
  collidesWithBlockedRegions,
  collidesWithReservedRegions,
  pieceFitsInSheet,
  piecesCollide,
  rectangleWithinBounds,
  usableAreaAfterMargins,
} from './geometry.js';
import { finiteNumber, normalizePieceRestrictions } from './normalization.js';

export const VALIDATION_CATEGORIES = Object.freeze({
  INPUT: 'input',
  CONFIGURATION: 'configuration',
  PHYSICAL: 'physical',
  CONSTRAINT: 'constraint',
});

export const VALIDATION_CODES = Object.freeze({
  PIECES_INVALID: 'PIECES_INVALID',
  SHEET_DIMENSIONS_INVALID: 'SHEET_DIMENSIONS_INVALID',
  PIECE_DIMENSIONS_INVALID: 'PIECE_DIMENSIONS_INVALID',
  PIECE_QUANTITY_INVALID: 'PIECE_QUANTITY_INVALID',
  KERF_INVALID: 'KERF_INVALID',
  MARGIN_INVALID: 'MARGIN_INVALID',
  MARGINS_EXCEED_SHEET: 'MARGINS_EXCEED_SHEET',
  REGIONS_INVALID: 'REGIONS_INVALID',
  REGION_INVALID: 'REGION_INVALID',
  REGION_OUT_OF_BOUNDS: 'REGION_OUT_OF_BOUNDS',
  ROTATION_INVALID: 'ROTATION_INVALID',
  ROTATION_CONFLICT: 'ROTATION_CONFLICT',
  PIECE_DOES_NOT_FIT: 'PIECE_DOES_NOT_FIT',
  GRAIN_RESTRICTS_ROTATION: 'GRAIN_RESTRICTS_ROTATION',
  UTILIZATION_INVALID: 'UTILIZATION_INVALID',
  WASTE_INVALID: 'WASTE_INVALID',
  PLACEMENT_OUT_OF_BOUNDS: 'PLACEMENT_OUT_OF_BOUNDS',
  BLOCKED_REGION_COLLISION: 'BLOCKED_REGION_COLLISION',
  RESERVED_REGION_COLLISION: 'RESERVED_REGION_COLLISION',
  PIECE_COLLISION: 'PIECE_COLLISION',
  PIECE_UNPLACED: 'PIECE_UNPLACED',
});

function diagnostic(code, category, message, details = {}) {
  return {
    code,
    category,
    message,
    ...details,
  };
}

function sourcePiecesFrom(input) {
  return input?.piezas ?? input?.pieces ?? [];
}

function validateRegions(rawRegions, regions, kind, config, errors) {
  if (rawRegions !== undefined && rawRegions !== null && !Array.isArray(rawRegions)) {
    errors.push(diagnostic(
      VALIDATION_CODES.REGIONS_INVALID,
      VALIDATION_CATEGORIES.CONFIGURATION,
      `Las regiones ${kind === 'blocked' ? 'bloqueadas' : 'reservadas'} deben ser una lista.`,
      { path: kind === 'blocked' ? 'blockedRegions' : 'reservedRegions' },
    ));
    return;
  }
  const sheetBounds = {
    x: 0,
    y: 0,
    width: config.sheetWidth,
    height: config.sheetHeight,
  };
  regions.forEach((region, index) => {
    const values = [region.x, region.y, region.width, region.height];
    if (
      values.some((value) => value === null)
      || region.x < 0
      || region.y < 0
      || region.width <= 0
      || region.height <= 0
    ) {
      errors.push(diagnostic(
        VALIDATION_CODES.REGION_INVALID,
        VALIDATION_CATEGORIES.CONFIGURATION,
        `La región ${kind === 'blocked' ? 'bloqueada' : 'reservada'} ${index + 1} es inválida.`,
        { path: `${kind}Regions.${index}`, regionId: region.sourceId ?? region.id },
      ));
      return;
    }
    if (!rectangleWithinBounds(region, sheetBounds)) {
      errors.push(diagnostic(
        VALIDATION_CODES.REGION_OUT_OF_BOUNDS,
        VALIDATION_CATEGORIES.PHYSICAL,
        `La región ${kind === 'blocked' ? 'bloqueada' : 'reservada'} ${index + 1} está fuera de la hoja.`,
        { path: `${kind}Regions.${index}`, regionId: region.sourceId ?? region.id },
      ));
    }
  });
}

export function validateCutInput(input = {}, normalized = {}) {
  const config = normalized.config || {};
  const expandedPieces = normalized.pieces || [];
  const sourcePieces = sourcePiecesFrom(input);
  const errors = [];
  const warnings = [];
  const rawWidth = input.sheetWidth ?? input.anchoHoja ?? config.sheetWidth;
  const rawHeight = input.sheetHeight ?? input.altoHoja ?? config.sheetHeight;
  const rawKerf = input.kerf ?? config.kerf;
  const sheetDimensionsValid = finiteNumber(rawWidth) !== null
    && finiteNumber(rawHeight) !== null
    && finiteNumber(rawWidth) > 0
    && finiteNumber(rawHeight) > 0;

  if (!sheetDimensionsValid) {
    errors.push(diagnostic(
      VALIDATION_CODES.SHEET_DIMENSIONS_INVALID,
      VALIDATION_CATEGORIES.CONFIGURATION,
      'Las dimensiones de la hoja deben ser números mayores que cero.',
      { path: 'sheet' },
    ));
  }

  if (finiteNumber(rawKerf) === null || finiteNumber(rawKerf) < 0) {
    errors.push(diagnostic(
      VALIDATION_CODES.KERF_INVALID,
      VALIDATION_CATEGORIES.CONFIGURATION,
      'El kerf debe ser un número mayor o igual que cero.',
      { path: 'kerf' },
    ));
  }

  const marginEntries = Object.entries(config.margins || {});
  const marginsValid = marginEntries.every(([, value]) => value !== null && value >= 0);
  marginEntries.forEach(([side, value]) => {
    if (value === null || value < 0) {
      errors.push(diagnostic(
        VALIDATION_CODES.MARGIN_INVALID,
        VALIDATION_CATEGORIES.CONFIGURATION,
        `El margen ${side} debe ser un número mayor o igual que cero.`,
        { path: `margins.${side}` },
      ));
    }
  });
  const usable = usableAreaAfterMargins(config.sheetWidth, config.sheetHeight, config.margins);
  if (sheetDimensionsValid && marginsValid && (usable.width <= 0 || usable.height <= 0)) {
    errors.push(diagnostic(
      VALIDATION_CODES.MARGINS_EXCEED_SHEET,
      VALIDATION_CATEGORIES.PHYSICAL,
      'Los márgenes eliminan completamente el área utilizable de la hoja.',
      { path: 'margins' },
    ));
  }

  const blockedRaw = input.blockedRegions ?? input.zonasBloqueadas;
  const reservedRaw = input.reservedRegions ?? input.zonasReservadas;
  validateRegions(blockedRaw, config.blockedRegions || [], 'blocked', config, errors);
  validateRegions(reservedRaw, config.reservedRegions || [], 'reserved', config, errors);

  if (!Array.isArray(sourcePieces)) {
    errors.push(diagnostic(
      VALIDATION_CODES.PIECES_INVALID,
      VALIDATION_CATEGORIES.INPUT,
      'Las piezas deben ser una lista.',
      { path: 'pieces' },
    ));
  } else {
    sourcePieces.forEach((piece, index) => {
      const source = piece && typeof piece === 'object' ? piece : {};
      const width = finiteNumber(source.ancho ?? source.width);
      const height = finiteNumber(source.alto ?? source.height);
      const rawQuantity = source.cantidad ?? source.quantity;
      const quantity = rawQuantity === undefined
        || rawQuantity === null
        || (typeof rawQuantity === 'string' && rawQuantity.trim() === '')
        ? 1
        : finiteNumber(rawQuantity);
      const sourceId = source.id;
      const details = {
        path: `pieces.${index}`,
        pieceIndex: index,
        ...(sourceId !== undefined && sourceId !== null ? { sourceId } : {}),
      };

      if (width === null || height === null || width <= 0 || height <= 0) {
        errors.push(diagnostic(
          VALIDATION_CODES.PIECE_DIMENSIONS_INVALID,
          VALIDATION_CATEGORIES.INPUT,
          `Las dimensiones de ${source.nombre || source.name || `la pieza ${index + 1}`} deben ser mayores que cero.`,
          details,
        ));
      }
      if (quantity === null || quantity <= 0 || !Number.isInteger(quantity)) {
        errors.push(diagnostic(
          VALIDATION_CODES.PIECE_QUANTITY_INVALID,
          VALIDATION_CATEGORIES.INPUT,
          `La cantidad de ${source.nombre || source.name || `la pieza ${index + 1}`} debe ser un entero mayor que cero.`,
          details,
        ));
      }

      const restrictions = normalizePieceRestrictions(source);
      const rawRotation = source.rotation ?? source.rotacion;
      if (rawRotation !== undefined && restrictions.rotationExplicit && restrictions.rawRotation !== undefined) {
        const recognized = ['allowed', 'forbidden', 'required'].includes(restrictions.rotation);
        const normalizedRaw = String(rawRotation).trim().toLowerCase();
        const knownRaw = [
          'allowed', 'permitida', 'permitido', 'allow',
          'forbidden', 'prohibited', 'prohibida', 'prohibido', 'none',
          'required', 'mandatory', 'obligatoria', 'obligatorio',
          'true', 'false',
        ].includes(normalizedRaw);
        if (!recognized || !knownRaw) {
          errors.push(diagnostic(
            VALIDATION_CODES.ROTATION_INVALID,
            VALIDATION_CATEGORIES.CONSTRAINT,
            `La restricción de rotación de ${source.nombre || source.name || `la pieza ${index + 1}`} no es válida.`,
            details,
          ));
        }
      }
      if (
        restrictions.rotation === 'required'
        && (config.allowRotation === false || restrictions.grainRestricted)
      ) {
        errors.push(diagnostic(
          VALIDATION_CODES.ROTATION_CONFLICT,
          VALIDATION_CATEGORIES.CONSTRAINT,
          `La rotación obligatoria de ${source.nombre || source.name || `la pieza ${index + 1}`} contradice otra restricción.`,
          details,
        ));
      } else if (restrictions.grainRestricted) {
        warnings.push(diagnostic(
          VALIDATION_CODES.GRAIN_RESTRICTS_ROTATION,
          VALIDATION_CATEGORIES.CONSTRAINT,
          `La veta bloquea la rotación de ${source.nombre || source.name || `la pieza ${index + 1}`}.`,
          details,
        ));
      }
    });
  }

  expandedPieces
    .filter((piece) => !pieceFitsInSheet(piece, {
      width: config.sheetWidth,
      height: config.sheetHeight,
    }, config))
    .forEach((piece) => {
      errors.push(diagnostic(
        VALIDATION_CODES.PIECE_DOES_NOT_FIT,
        VALIDATION_CATEGORIES.PHYSICAL,
        `No cabe por tamaño físico: ${piece.name}.`,
        {
          path: `pieces.${piece.sourceIndex}`,
          pieceId: piece.id,
          ...(piece.sourceId !== undefined ? { sourceId: piece.sourceId } : {}),
        },
      ));
    });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    diagnostics: [...errors, ...warnings],
  };
}

export function validateOptimizationResult({
  sheets = [],
  unplacedPieces = [],
  utilization = 0,
  wasteArea = 0,
  config = {},
  inputValidation = { errors: [], warnings: [] },
} = {}) {
  const legacyWarnings = [];
  const physicalErrors = [];
  if (utilization > 100) {
    legacyWarnings.push('Aprovechamiento mayor a 100%.');
    physicalErrors.push(diagnostic(
      VALIDATION_CODES.UTILIZATION_INVALID,
      VALIDATION_CATEGORIES.PHYSICAL,
      'Aprovechamiento mayor a 100%.',
      { path: 'summary.utilization' },
    ));
  }
  if (wasteArea < 0) {
    legacyWarnings.push('Merma negativa.');
    physicalErrors.push(diagnostic(
      VALIDATION_CODES.WASTE_INVALID,
      VALIDATION_CATEGORIES.PHYSICAL,
      'Merma negativa.',
      { path: 'summary.wasteArea' },
    ));
  }
  const bounds = usableAreaAfterMargins(config.sheetWidth, config.sheetHeight, config.margins);

  sheets.forEach((sheet, sheetIndex) => {
    sheet.pieces.forEach((piece, index) => {
      const pieceDetails = {
        path: `sheets.${sheetIndex}.pieces.${index}`,
        pieceId: piece.id,
        ...(piece.sourceId !== undefined ? { sourceId: piece.sourceId } : {}),
      };
      if (!rectangleWithinBounds(piece, bounds)) {
        legacyWarnings.push(`Pieza fuera de hoja: ${piece.name}.`);
        physicalErrors.push(diagnostic(
          VALIDATION_CODES.PLACEMENT_OUT_OF_BOUNDS,
          VALIDATION_CATEGORIES.PHYSICAL,
          `Pieza fuera de hoja: ${piece.name}.`,
          pieceDetails,
        ));
      }
      if (collidesWithBlockedRegions(piece, config.blockedRegions)) {
        legacyWarnings.push(`Pieza dentro de zona bloqueada: ${piece.name}.`);
        physicalErrors.push(diagnostic(
          VALIDATION_CODES.BLOCKED_REGION_COLLISION,
          VALIDATION_CATEGORIES.PHYSICAL,
          `Pieza dentro de zona bloqueada: ${piece.name}.`,
          pieceDetails,
        ));
      }
      if (collidesWithReservedRegions(piece, config.reservedRegions)) {
        legacyWarnings.push(`Pieza dentro de zona reservada: ${piece.name}.`);
        physicalErrors.push(diagnostic(
          VALIDATION_CODES.RESERVED_REGION_COLLISION,
          VALIDATION_CATEGORIES.PHYSICAL,
          `Pieza dentro de zona reservada: ${piece.name}.`,
          pieceDetails,
        ));
      }
      sheet.pieces.slice(index + 1).forEach((next, nextOffset) => {
        if (piecesCollide(piece, next, config.kerf)) {
          legacyWarnings.push(`Piezas sobrepuestas: ${piece.name} / ${next.name}.`);
          physicalErrors.push(diagnostic(
            VALIDATION_CODES.PIECE_COLLISION,
            VALIDATION_CATEGORIES.PHYSICAL,
            `Piezas sobrepuestas: ${piece.name} / ${next.name}.`,
            {
              ...pieceDetails,
              nextPath: `sheets.${sheetIndex}.pieces.${index + nextOffset + 1}`,
              nextPieceId: next.id,
            },
          ));
        }
      });
    });
  });
  unplacedPieces.forEach((piece, index) => {
    const message = piece.reason === 'too-large'
      ? `No cabe por tamaño físico: ${piece.name}.`
      : `Pendiente de acomodar: ${piece.name}.`;
    legacyWarnings.push(message);
    physicalErrors.push(diagnostic(
      piece.reason === 'too-large'
        ? VALIDATION_CODES.PIECE_DOES_NOT_FIT
        : VALIDATION_CODES.PIECE_UNPLACED,
      VALIDATION_CATEGORIES.PHYSICAL,
      message,
      {
        path: `unplacedPieces.${index}`,
        pieceId: piece.id,
        ...(piece.sourceId !== undefined ? { sourceId: piece.sourceId } : {}),
      },
    ));
  });
  inputValidation.errors.forEach((error) => legacyWarnings.push(error.message));

  const warnings = [...new Set(legacyWarnings)];
  const errors = [...inputValidation.errors, ...physicalErrors];
  const structuredWarnings = inputValidation.warnings;
  return {
    isPhysicallyValid: warnings.length === 0,
    warnings,
    errors,
    structuredWarnings,
    diagnostics: [
      ...errors,
      ...structuredWarnings,
    ],
    input: inputValidation,
  };
}
