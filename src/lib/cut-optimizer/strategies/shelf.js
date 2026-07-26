import {
  collidingRegion,
  physicalVariants,
  pieceFitsInSheet,
  piecesCollide,
  placementFits,
  usableAreaAfterMargins,
} from '../geometry.js';
import {
  createStrategyCandidate,
  createStrategySheet,
} from '../strategy-contract.js';

function orderedShelfPieces(pieces, config) {
  if (config.strategy !== 'largest-first') return [...pieces];
  return pieces
    .map((piece, inputIndex) => ({ piece, inputIndex }))
    .sort((left, right) => (
      (right.piece.originalWidth * right.piece.originalHeight)
      - (left.piece.originalWidth * left.piece.originalHeight)
      || left.inputIndex - right.inputIndex
    ))
    .map(({ piece }) => piece);
}

function placeOnShelf(sheet, piece, config) {
  const usable = usableAreaAfterMargins(sheet.width, sheet.height, config.margins);
  const regions = [...config.blockedRegions, ...config.reservedRegions];
  for (const variant of physicalVariants(piece, config)) {
    let x = sheet.cursorX;
    let y = sheet.cursorY;
    let shelfHeight = sheet.shelfHeight;

    if (x > usable.x) x += config.kerf;

    const maxAttempts = regions.length + sheet.pieces.length + 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (x + variant.width > usable.right) {
        x = usable.x;
        y += shelfHeight + config.kerf;
        shelfHeight = 0;
      }
      if (x + variant.width > usable.right || y + variant.height > usable.bottom) break;

      const candidate = { ...variant, x, y };
      const obstruction = collidingRegion(candidate, regions)
        || sheet.pieces.find((current) => piecesCollide(candidate, current, config.kerf));
      if (obstruction) {
        x = obstruction.x + obstruction.width + config.kerf;
        continue;
      }
      if (!placementFits({
        piece: candidate,
        sheet,
        margins: config.margins,
        kerf: config.kerf,
        blockedRegions: config.blockedRegions,
        reservedRegions: config.reservedRegions,
        placedPieces: sheet.pieces,
      })) break;

      sheet.pieces.push(candidate);
      sheet.cursorX = x + variant.width;
      sheet.cursorY = y;
      sheet.shelfHeight = Math.max(shelfHeight, variant.height);
      return true;
    }
  }
  return false;
}

export function runShelfStrategy({
  config,
  pieces,
  sourcePieces,
  inputValidation,
}) {
  const orderedPieces = orderedShelfPieces(pieces, config);
  const sheets = [];
  const unplacedPieces = [];

  orderedPieces.forEach((piece) => {
    if (!pieceFitsInSheet(piece, {
      width: config.sheetWidth,
      height: config.sheetHeight,
    }, config)) {
      unplacedPieces.push({ ...piece, reason: 'too-large' });
      return;
    }

    const placed = sheets.some((sheet) => placeOnShelf(sheet, piece, config));
    if (placed) return;

    const sheet = createStrategySheet(sheets.length + 1, config);
    if (placeOnShelf(sheet, piece, config)) {
      sheets.push(sheet);
    } else {
      unplacedPieces.push({ ...piece, reason: 'not-placed' });
    }
  });

  return createStrategyCandidate({
    strategy: 'shelf',
    config,
    pieces,
    sourcePieces,
    sheets,
    unplacedPieces,
    inputValidation,
    metadata: {
      strategyVersion: 1,
      placementRule: 'shelf',
      pieceOrder: config.strategy,
    },
  });
}
