import {
  calcularAreaConMerma,
  calcularCantidadConMerma,
  calcularHojasNecesarias,
  calcularLinealConMerma,
  calcularMaterial,
} from '../br-engine/materials.js';
import { optimizeCuts } from '../cut-optimizer/optimizer.js';
import {
  createSmartCutCandidateSnapshot,
  createSmartCutInputSignature,
  createSmartCutOptimizationState,
} from '../smart-cut-application/active-mode.js';

export const CALCULATION_TYPES = Object.freeze({
  SHEET: 'sheet',
  GLASS: 'glass',
  LINEAR: 'linear',
  SURFACE: 'surface',
  HARDWARE: 'hardware',
});

const LENGTH_TO_CM = Object.freeze({
  mm: 0.1,
  cm: 1,
  m: 100,
});

function finite(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegative(value) {
  const number = finite(value);
  return number === null ? 0 : Math.max(0, number);
}

export function convertLength(value, fromUnit = 'cm', toUnit = 'cm') {
  const number = finite(value);
  const fromFactor = LENGTH_TO_CM[fromUnit];
  const toFactor = LENGTH_TO_CM[toUnit];
  if (number === null || !fromFactor || !toFactor) return null;
  return (number * fromFactor) / toFactor;
}

export function normalizeCalculatorPiece(piece, unit = 'cm') {
  return {
    ...piece,
    id: String(piece?.id || ''),
    name: String(piece?.name ?? piece?.nombre ?? '').trim(),
    groupId: String(piece?.groupId || ''),
    width: convertLength(piece?.width ?? piece?.ancho, unit, 'cm'),
    height: convertLength(piece?.height ?? piece?.alto, unit, 'cm'),
    length: convertLength(
      piece?.length ?? piece?.largo ?? piece?.height ?? piece?.alto,
      unit,
      'cm',
    ),
    quantity: finite(piece?.quantity ?? piece?.cantidad),
    materialAssignments: Array.isArray(piece?.materialAssignments)
      ? piece.materialAssignments
      : [],
  };
}

export function selectedCalculatorPieces(pieces = [], selectedPieceIds = [], unit = 'cm') {
  const selected = new Set(selectedPieceIds);
  return (Array.isArray(pieces) ? pieces : [])
    .filter((piece) => selected.has(piece?.id))
    .map((piece) => normalizeCalculatorPiece(piece, unit));
}

export function pieceIdsForGroups(pieces = [], groupIds = []) {
  const selectedGroups = new Set(groupIds);
  return (Array.isArray(pieces) ? pieces : [])
    .filter((piece) => selectedGroups.has(piece?.groupId))
    .map((piece) => piece.id);
}

export function pieceIdsForMaterial(pieces = [], materialId = '') {
  return (Array.isArray(pieces) ? pieces : [])
    .filter((piece) => (
      Array.isArray(piece?.materialAssignments)
      && piece.materialAssignments.some((assignment) => (
        (typeof assignment === 'string' ? assignment : assignment?.materialId) === materialId
      ))
    ))
    .map((piece) => piece.id);
}

export function validateMaterialCalculation(input = {}) {
  const type = input.type || CALCULATION_TYPES.SHEET;
  const pieces = selectedCalculatorPieces(
    input.pieces,
    input.selectedPieceIds,
    input.pieceUnit ?? input.unit,
  );
  const errors = [];

  if (!pieces.length) errors.push('Selecciona al menos una pieza.');
  pieces.forEach((piece) => {
    if (!piece.id) errors.push('Hay una pieza sin identificación.');
    if (!piece.quantity || piece.quantity <= 0) {
      errors.push(`La cantidad de ${piece.name || 'la pieza'} debe ser mayor que cero.`);
    }
    if ([CALCULATION_TYPES.SHEET, CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE]
      .includes(type)) {
      if (!piece.width || piece.width <= 0) {
        errors.push(`Ingresa el ancho de ${piece.name || 'la pieza'}.`);
      }
      if (!piece.height || piece.height <= 0) {
        errors.push(`El alto de ${piece.name || 'la pieza'} debe ser mayor que cero.`);
      }
    }
    if (type === CALCULATION_TYPES.LINEAR && (!piece.length || piece.length <= 0)) {
      errors.push(`El largo de ${piece.name || 'la pieza'} debe ser mayor que cero.`);
    }
  });

  if (finite(input.wastePercent) === null || Number(input.wastePercent) < 0) {
    errors.push('La merma no puede ser negativa.');
  }
  if (finite(input.price) === null || Number(input.price) < 0) {
    errors.push('El precio no puede ser negativo.');
  }
  if (type === CALCULATION_TYPES.SHEET) {
    if (!finite(input.formatWidth) || Number(input.formatWidth) <= 0) {
      errors.push('Ingresa el ancho de la hoja.');
    }
    if (!finite(input.formatHeight) || Number(input.formatHeight) <= 0) {
      errors.push('Ingresa el largo de la hoja.');
    }
  }
  if (type === CALCULATION_TYPES.LINEAR
    && (!finite(input.barLength) || Number(input.barLength) <= 0)) {
    errors.push('Ingresa el largo comercial de la barra.');
  }
  if (type === CALCULATION_TYPES.HARDWARE
    && (!finite(input.quantityPerPiece) || Number(input.quantityPerPiece) <= 0)) {
    errors.push('La cantidad de herrajes por pieza debe ser mayor que cero.');
  }

  return [...new Set(errors)];
}

function baseMetrics(pieces) {
  return pieces.reduce((summary, piece) => {
    const quantity = Math.max(0, piece.quantity || 0);
    summary.selectedRows += 1;
    summary.pieceCount += quantity;
    summary.netArea += ((piece.width || 0) / 100) * ((piece.height || 0) / 100) * quantity;
    summary.netLength += Number.isFinite(Number(piece.linearTotal))
      ? Math.max(0, Number(piece.linearTotal))
      : ((piece.length || 0) / 100) * quantity;
    return summary;
  }, {
    selectedRows: 0,
    pieceCount: 0,
    netArea: 0,
    netLength: 0,
  });
}

function oversizedPieces(pieces, width, height, allowRotation) {
  return pieces.filter((piece) => {
    const direct = piece.width <= width && piece.height <= height;
    const rotated = allowRotation && piece.height <= width && piece.width <= height;
    return !direct && !rotated;
  });
}

function withCommercialMetrics(result, input) {
  const marginPercent = nonNegative(input.marginPercent);
  return {
    ...result,
    marginPercent,
    proposedPrice: result.material?.precioSugerido
      ?? result.cost * (1 + marginPercent / 100),
  };
}

export function calculateMaterial(input = {}) {
  const type = input.type || CALCULATION_TYPES.SHEET;
  const errors = validateMaterialCalculation(input);
  const pieces = selectedCalculatorPieces(
    input.pieces,
    input.selectedPieceIds,
    input.pieceUnit ?? input.unit,
  );
  const metrics = baseMetrics(pieces);
  const wastePercent = nonNegative(input.wastePercent);
  const price = nonNegative(input.price);
  const result = {
    status: errors.length ? 'invalid' : 'calculated',
    type,
    errors,
    warnings: [],
    pieces,
    ...metrics,
    wastePercent,
    areaWithWaste: calcularAreaConMerma(metrics.netArea, wastePercent),
    lengthWithWaste: calcularLinealConMerma(metrics.netLength, wastePercent),
    quantityWithWaste: calcularCantidadConMerma(metrics.pieceCount, wastePercent),
    cost: 0,
    optimization: null,
    grainDirection: Boolean(input.grainDirection),
  };
  if (errors.length) return result;

  if (type === CALCULATION_TYPES.SHEET) {
    const formatWidth = convertLength(input.formatWidth, input.unit, 'cm');
    const formatHeight = convertLength(input.formatHeight, input.unit, 'cm');
    const sheetArea = (formatWidth / 100) * (formatHeight / 100);
    const theoreticalSheets = sheetArea > 0 ? result.areaWithWaste / sheetArea : 0;
    const areaSheets = calcularHojasNecesarias(metrics.netArea, sheetArea, wastePercent);
    const allowRotation = input.grainDirection ? false : input.allowRotation !== false;
    const tooLarge = oversizedPieces(pieces, formatWidth, formatHeight, allowRotation);
    if (tooLarge.length) {
      result.warnings.push(
        ...tooLarge.map((piece) => `Esta pieza es más larga que la hoja seleccionada: ${piece.name}.`),
      );
    }
    result.warnings.push(
      'La estimación por área puede subestimar hojas por dimensiones, veta, giro, kerf o márgenes de seguridad.',
    );
    if (input.grainDirection) {
      result.warnings.push('La orientación de veta está activa; las piezas no se rotarán.');
    }

    const optimizationInput = {
      sheetWidth: formatWidth,
      sheetHeight: formatHeight,
      allowRotation,
      kerf: convertLength(input.kerf || 0, input.unit, 'cm') || 0,
      strategy: input.strategy || 'largest-first',
      margins: input.margins,
      blockedRegions: input.blockedRegions,
      reservedRegions: input.reservedRegions,
      pieces: pieces.map((piece) => ({
        id: piece.id,
        name: piece.name,
        width: piece.width,
        height: piece.height,
        quantity: piece.quantity,
        grainDirection: input.grainDirection ? 'vertical' : null,
      })),
    };
    const optimization = input.optimize
      ? {
        ...optimizeCuts(optimizationInput),
        inputSignature: createSmartCutInputSignature(optimizationInput),
      }
      : null;
    const material = calcularMaterial({
      tipoCompra: 'hoja',
      areaNecesaria: metrics.netArea,
      ancho: formatWidth / 100,
      alto: formatHeight / 100,
      precioUnidad: price,
      merma: wastePercent,
      margen: nonNegative(input.marginPercent),
      optimization,
    });
    const commercialSheets = optimization?.summary?.requiredSheets ?? areaSheets;
    return withCommercialMetrics({
      ...result,
      formatWidth,
      formatHeight,
      sheetArea,
      theoreticalSheets,
      commercialSheets,
      cost: material.costoInterno,
      estimatedWaste: optimization?.summary?.wasteArea !== undefined
        ? optimization.summary.wasteArea / 10000
        : Math.max(0, (commercialSheets * sheetArea) - result.areaWithWaste),
      utilization: optimization?.summary?.utilization
        ?? (commercialSheets > 0
          ? (result.areaWithWaste / (commercialSheets * sheetArea)) * 100
          : 0),
      optimization,
      material,
    }, input);
  }

  if ([CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE].includes(type)) {
    const material = calcularMaterial({
      tipoCompra: 'area',
      areaNecesaria: metrics.netArea,
      precioMetroCuadrado: price,
      merma: wastePercent,
      margen: nonNegative(input.marginPercent),
    });
    return withCommercialMetrics({
      ...result,
      cost: material.costoInterno,
      treatment: String(input.treatment || '').trim(),
      material,
    }, input);
  }

  if (type === CALCULATION_TYPES.LINEAR) {
    const barLength = convertLength(input.barLength, input.unit, 'm');
    const barsNeeded = Math.ceil(result.lengthWithWaste / barLength);
    return withCommercialMetrics({
      ...result,
      barLength,
      barsNeeded,
      cost: barsNeeded * price,
      estimatedWaste: Math.max(0, (barsNeeded * barLength) - metrics.netLength),
    }, input);
  }

  const quantityPerPiece = nonNegative(input.quantityPerPiece);
  const reserveQuantity = nonNegative(input.reserveQuantity);
  const requiredQuantity = metrics.pieceCount * quantityPerPiece;
  const purchaseQuantity = Math.ceil(requiredQuantity + reserveQuantity);
  return withCommercialMetrics({
    ...result,
    requiredQuantity,
    reserveQuantity,
    purchaseQuantity,
    cost: purchaseQuantity * price,
  }, input);
}

export function buildMaterialProposal({
  form = {},
  material = {},
  calculation,
  selectedPieceIds = [],
} = {}) {
  const selectedIds = [...new Set(selectedPieceIds)];
  const measures = Array.isArray(form.measureItems) ? form.measureItems : [];
  const isHardware = calculation?.type === CALCULATION_TYPES.HARDWARE;
  const assignmentKind = isHardware ? 'hardware' : 'material';
  const targetCollection = isHardware ? form.accessoryItems : form.materialItems;
  const normalizedName = String(material.nombre || material.name || '').trim().toLocaleLowerCase('es-MX');
  const sameNamed = (Array.isArray(targetCollection) ? targetCollection : []).find((item) => (
    normalizedName
    && String(item?.nombre || '').trim().toLocaleLowerCase('es-MX') === normalizedName
  ));
  const sameNamedAlreadyAssigned = sameNamed && selectedIds.length > 0 && selectedIds.every((pieceId) => {
    const piece = measures.find((item) => item.id === pieceId);
    return Array.isArray(piece?.materialAssignments)
      && piece.materialAssignments.some((assignment) => (
        (typeof assignment === 'string' ? assignment : assignment?.materialId) === sameNamed.id
        && (typeof assignment === 'string'
          ? assignmentKind === 'material'
          : (assignment?.kind || 'material') === assignmentKind)
      ));
  });
  const materialId = String(
    sameNamedAlreadyAssigned ? sameNamed.id : material.id || '',
  );
  const selectedCandidate = calculation?.optimization?.selectedCandidate || null;
  const optimizationConfig = calculation?.optimization?.config || {};
  const inputSignature = calculation?.optimization?.inputSignature || null;
  const candidateSnapshot = createSmartCutCandidateSnapshot({
    candidate: selectedCandidate,
    recommendedCandidateId: calculation?.optimization?.recommendedCandidateId,
    configuration: optimizationConfig,
    inputSignature,
  });
  const previousOptimization = (
    sameNamedAlreadyAssigned ? sameNamed?.optimization : material?.optimization
  ) || {};
  const optimization = selectedCandidate && candidateSnapshot
    ? {
      ...previousOptimization,
      ...createSmartCutOptimizationState({
        activeCandidateId: selectedCandidate.id,
        engineVersion: selectedCandidate.metadata?.contractVersion,
        inputSignature,
        candidateSnapshot,
      }),
    }
    : previousOptimization;
  const conflicts = measures
    .filter((piece) => selectedIds.includes(piece.id))
    .flatMap((piece) => (Array.isArray(piece.materialAssignments)
      ? piece.materialAssignments
      : []).filter((assignment) => (
      (typeof assignment === 'string' ? assignmentKind === 'material' : (
        (assignment?.kind || 'material') === assignmentKind
      ))
      && (typeof assignment === 'string' ? assignment : assignment?.materialId) !== materialId
    )).map((assignment) => ({
      pieceId: piece.id,
      pieceName: piece.nombre,
      materialId: typeof assignment === 'string' ? assignment : assignment?.materialId,
    })));

  return {
    materialId,
    selectedPieceIds: selectedIds,
    calculation,
    conflicts,
    requiresConfirmation: conflicts.length > 0,
    materialItem: {
      ...material,
      id: materialId,
      baseCalculo: material.baseCalculo || 'medidas_area',
      usarArea: material.usarArea ?? true,
      precioManual: false,
      ...(selectedCandidate ? {
        optimization,
        cutConfig: {
          ...(material.cutConfig || {}),
          allowRotation: optimizationConfig.allowRotation ?? true,
          kerf: optimizationConfig.kerf ?? 0,
          strategy: optimizationConfig.strategy || 'largest-first',
        },
      } : {}),
    },
    target: isHardware ? 'accessory' : 'material',
  };
}

export function applyMaterialProposal(form = {}, proposal = {}, { replace = false } = {}) {
  if (!proposal.materialId || !proposal.selectedPieceIds?.length) {
    return { applied: false, reason: 'invalid-proposal', form };
  }
  if (proposal.requiresConfirmation && !replace) {
    return {
      applied: false,
      reason: 'confirmation-required',
      conflicts: proposal.conflicts,
      form,
    };
  }

  const selected = new Set(proposal.selectedPieceIds);
  const measureItems = (Array.isArray(form.measureItems) ? form.measureItems : []).map((piece) => {
    if (!selected.has(piece.id)) return piece;
    const current = Array.isArray(piece.materialAssignments)
      ? piece.materialAssignments
      : [];
    const withoutTarget = current.filter((assignment) => (
      (typeof assignment === 'string' ? assignment : assignment?.materialId) !== proposal.materialId
      && (!replace || (typeof assignment === 'string'
        ? proposal.target !== 'material'
        : (assignment?.kind || 'material') !== (
          proposal.target === 'accessory' ? 'hardware' : 'material'
        )))
    ));
    const materialAssignments = [
      ...withoutTarget,
      {
        materialId: proposal.materialId,
        kind: proposal.target === 'accessory' ? 'hardware' : 'material',
      },
    ];
    return { ...piece, materialAssignments };
  });
  const collectionKey = proposal.target === 'accessory' ? 'accessoryItems' : 'materialItems';
  const collection = Array.isArray(form[collectionKey]) ? form[collectionKey] : [];
  const existing = collection.some((item) => item.id === proposal.materialId);
  const nextCollection = existing
    ? collection.map((item) => (
      item.id === proposal.materialId ? { ...item, ...proposal.materialItem } : item
    ))
    : [...collection, proposal.materialItem];

  return {
    applied: true,
    form: {
      ...form,
      measureItems,
      [collectionKey]: nextCollection,
    },
  };
}
