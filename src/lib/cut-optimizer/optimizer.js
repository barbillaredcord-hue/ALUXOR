function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function expandPieces(pieces = []) {
  return pieces.flatMap((piece) => {
    const cantidad = Math.max(1, Math.floor(toNumber(piece.cantidad) || 1));
    return Array.from({ length: cantidad }, (_, index) => ({
      id: `${piece.nombre || 'Pieza'}-${index}`,
      nombre: piece.nombre || 'Pieza',
      indice: index + 1,
      cantidad,
      ancho: toNumber(piece.ancho),
      alto: toNumber(piece.alto),
    }));
  });
}

function createSheet(index, anchoHoja, altoHoja) {
  return {
    index,
    ancho: anchoHoja,
    alto: altoHoja,
    pieces: [],
    cursorX: 0,
    cursorY: 0,
    shelfHeight: 0,
  };
}

function placePiece(sheet, piece) {
  if (piece.ancho > sheet.ancho || piece.alto > sheet.alto) return false;
  if (sheet.cursorX + piece.ancho > sheet.ancho) {
    sheet.cursorX = 0;
    sheet.cursorY += sheet.shelfHeight;
    sheet.shelfHeight = 0;
  }
  if (sheet.cursorY + piece.alto > sheet.alto) return false;
  sheet.pieces.push({
    ...piece,
    x: sheet.cursorX,
    y: sheet.cursorY,
  });
  sheet.cursorX += piece.ancho;
  sheet.shelfHeight = Math.max(sheet.shelfHeight, piece.alto);
  return true;
}

export function optimizeCuts({ anchoHoja = 0, altoHoja = 0, piezas = [] } = {}) {
  const sheetWidth = toNumber(anchoHoja);
  const sheetHeight = toNumber(altoHoja);
  const expanded = expandPieces(piezas).sort((a, b) => (b.alto * b.ancho) - (a.alto * a.ancho));
  const sheets = [];

  expanded.forEach((piece) => {
    let placed = sheets.some((sheet) => placePiece(sheet, piece));
    if (!placed) {
      const sheet = createSheet(sheets.length + 1, sheetWidth, sheetHeight);
      placePiece(sheet, piece);
      sheets.push(sheet);
    }
  });

  const sheetArea = sheetWidth * sheetHeight;
  const areaUtilizada = expanded.reduce((sum, piece) => sum + piece.ancho * piece.alto, 0);
  const areaTotal = sheetArea * sheets.length;
  const areaDesperdiciada = Math.max(0, areaTotal - areaUtilizada);

  const hojas = sheets.map(({ cursorX, cursorY, shelfHeight, ...sheet }) => {
    const areaUsada = sheet.pieces.reduce((sum, piece) => sum + piece.ancho * piece.alto, 0);
    const areaDesperdiciada = Math.max(0, sheetArea - areaUsada);
    return {
      ...sheet,
      anchoHoja: sheet.ancho,
      altoHoja: sheet.alto,
      piezasColocadas: sheet.pieces,
      areaUsada,
      areaDesperdiciada,
      porcentajeAprovechamiento: sheetArea > 0 ? (areaUsada / sheetArea) * 100 : 0,
    };
  });

  return {
    cantidadHojas: sheets.length,
    hojas,
    areaUtilizada,
    areaDesperdiciada,
    porcentajeAprovechamiento: areaTotal > 0 ? (areaUtilizada / areaTotal) * 100 : 0,
  };
}
