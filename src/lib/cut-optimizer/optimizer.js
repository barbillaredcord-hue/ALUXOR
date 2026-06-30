const DEFAULT_CONFIG = {
  sheetWidth: 122,
  sheetHeight: 244,
  allowRotation: true,
  kerf: 0.3,
  strategy: 'largest-first',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function expandPieces(pieces = []) {
  return pieces.flatMap((piece, pieceIndex) => {
    const quantity = Math.max(1, Math.floor(toNumber(piece.cantidad ?? piece.quantity) || 1));
    const originalWidth = toNumber(piece.ancho ?? piece.width);
    const originalHeight = toNumber(piece.alto ?? piece.height);
    return Array.from({ length: quantity }, (_, index) => ({
      id: `${piece.nombre || piece.name || 'Pieza'}-${pieceIndex}-${index}`,
      name: piece.nombre || piece.name || 'Pieza',
      index: index + 1,
      quantity,
      originalWidth,
      originalHeight,
      width: originalWidth,
      height: originalHeight,
      rotated: false,
    }));
  });
}

function createSheet(index, width, height) {
  return {
    index,
    width,
    height,
    pieces: [],
    cursorX: 0,
    cursorY: 0,
    shelfHeight: 0,
  };
}

function fitsInSheet(piece, width, height) {
  return piece.width <= width && piece.height <= height;
}

function variantsFor(piece, config) {
  const variants = [piece];
  if (config.allowRotation && piece.originalWidth !== piece.originalHeight) {
    variants.push({
      ...piece,
      width: piece.originalHeight,
      height: piece.originalWidth,
      rotated: true,
    });
  }
  return variants;
}

function placePiece(sheet, piece, config) {
  for (const variant of variantsFor(piece, config)) {
    let x = sheet.cursorX;
    let y = sheet.cursorY;
    let shelfHeight = sheet.shelfHeight;

    if (x > 0) {
      x += config.kerf;
    }

    if (x + variant.width > sheet.width) {
      x = 0;
      y += shelfHeight + config.kerf;
      shelfHeight = 0;
    }

    if (x + variant.width > sheet.width) continue;
    if (y + variant.height > sheet.height) continue;

    sheet.pieces.push({ ...variant, x, y });
    sheet.cursorX = x + variant.width;
    sheet.cursorY = y;
    sheet.shelfHeight = Math.max(shelfHeight, variant.height);
    return true;
  }
  return false;
}

function summarizeSheet(sheet) {
  const sheetArea = sheet.width * sheet.height;
  const usedArea = sheet.pieces.reduce((sum, piece) => sum + piece.width * piece.height, 0);
  const wasteArea = Math.max(0, sheetArea - usedArea);
  const efficiencyPercent = sheetArea > 0 ? Math.min(100, (usedArea / sheetArea) * 100) : 0;
  return {
    ...sheet,
    ancho: sheet.width,
    alto: sheet.height,
    anchoHoja: sheet.width,
    altoHoja: sheet.height,
    pieces: sheet.pieces.map((piece) => ({
      ...piece,
      nombre: piece.name,
      ancho: piece.width,
      alto: piece.height,
      indice: piece.index,
      cantidad: piece.quantity,
    })),
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

function piecesOverlap(piece, next) {
  return piece.x < next.x + next.width
    && piece.x + piece.width > next.x
    && piece.y < next.y + next.height
    && piece.y + piece.height > next.y;
}

function validateSheets(sheets, unplacedPieces, utilization, wasteArea) {
  const warnings = [];
  if (utilization > 100) warnings.push('Aprovechamiento mayor a 100%.');
  if (wasteArea < 0) warnings.push('Merma negativa.');
  sheets.forEach((sheet) => {
    sheet.pieces.forEach((piece, index) => {
      if (piece.x < 0 || piece.y < 0 || piece.x + piece.width > sheet.width || piece.y + piece.height > sheet.height) {
        warnings.push(`Pieza fuera de hoja: ${piece.name}.`);
      }
      sheet.pieces.slice(index + 1).forEach((next) => {
        if (piecesOverlap(piece, next)) warnings.push(`Piezas sobrepuestas: ${piece.name} / ${next.name}.`);
      });
    });
  });
  unplacedPieces.forEach((piece) => {
    if (piece.reason === 'too-large') warnings.push(`No cabe por tamaño físico: ${piece.name}.`);
    if (piece.reason === 'not-placed') warnings.push(`Pendiente de acomodar: ${piece.name}.`);
  });
  return {
    isPhysicallyValid: warnings.length === 0,
    warnings,
  };
}

export function optimizeCuts(input = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...input,
    sheetWidth: toNumber(input.sheetWidth ?? input.anchoHoja ?? DEFAULT_CONFIG.sheetWidth),
    sheetHeight: toNumber(input.sheetHeight ?? input.altoHoja ?? DEFAULT_CONFIG.sheetHeight),
    kerf: toNumber(input.kerf ?? DEFAULT_CONFIG.kerf),
    allowRotation: input.allowRotation ?? DEFAULT_CONFIG.allowRotation,
    strategy: input.strategy || DEFAULT_CONFIG.strategy,
  };
  let pieces = expandPieces(input.piezas ?? input.pieces);
  if (config.strategy === 'largest-first') {
    pieces = pieces.sort((a, b) => (b.originalWidth * b.originalHeight) - (a.originalWidth * a.originalHeight));
  }

  const sheets = [];
  const unplacedPieces = [];

  pieces.forEach((piece) => {
    if (!variantsFor(piece, config).some((variant) => fitsInSheet(variant, config.sheetWidth, config.sheetHeight))) {
      unplacedPieces.push({ ...piece, reason: 'too-large' });
      return;
    }

    const placed = sheets.some((sheet) => placePiece(sheet, piece, config));
    if (!placed) {
      const sheet = createSheet(sheets.length + 1, config.sheetWidth, config.sheetHeight);
      if (placePiece(sheet, piece, config)) {
        sheets.push(sheet);
      } else {
        unplacedPieces.push({ ...piece, reason: 'not-placed' });
      }
    }
  });

  const summarizedSheets = sheets.map(summarizeSheet);
  const placedPieces = summarizedSheets.flatMap((sheet) => sheet.pieces.map((piece) => ({ ...piece, sheetIndex: sheet.index })));
  const usedArea = summarizedSheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
  const totalSheetArea = config.sheetWidth * config.sheetHeight * summarizedSheets.length;
  const wasteArea = Math.max(0, totalSheetArea - usedArea);
  const utilization = totalSheetArea > 0 ? Math.min(100, (usedArea / totalSheetArea) * 100) : 0;
  const summary = {
    requiredSheets: summarizedSheets.length,
    totalSheetArea,
    usedArea,
    wasteArea,
    utilization,
  };
  const purchasing = {
    sheetsToBuy: summary.requiredSheets,
  };
  const manufacturing = {
    totalCuts: placedPieces.length,
  };
  const validation = validateSheets(summarizedSheets, unplacedPieces, summary.utilization, summary.wasteArea);

  return {
    config,
    sheets: summarizedSheets,
    placedPieces,
    hojas: summarizedSheets,
    unplacedPieces,
    summary,
    purchasing,
    manufacturing,
    validation,
    totalUsedArea: summary.usedArea,
    totalWasteArea: summary.wasteArea,
    efficiencyPercent: summary.utilization,
    sheetCount: summary.requiredSheets,
    cantidadHojas: summary.requiredSheets,
    areaUtilizada: summary.usedArea,
    areaDesperdiciada: summary.wasteArea,
    porcentajeAprovechamiento: summary.utilization,
  };
}
