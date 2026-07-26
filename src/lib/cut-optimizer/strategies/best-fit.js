import {
  physicalVariants,
  pieceFitsInSheet,
  placementFits,
  usableAreaAfterMargins,
} from '../geometry.js';
import {
  createStrategyCandidate,
  createStrategySheet,
} from '../strategy-contract.js';

function orderedBestFitPieces(pieces) {
  return pieces
    .map((piece, inputIndex) => ({ piece, inputIndex }))
    .sort((left, right) => {
      const leftArea = left.piece.originalWidth * left.piece.originalHeight;
      const rightArea = right.piece.originalWidth * right.piece.originalHeight;
      const leftSide = Math.max(left.piece.originalWidth, left.piece.originalHeight);
      const rightSide = Math.max(right.piece.originalWidth, right.piece.originalHeight);
      return rightArea - leftArea
        || rightSide - leftSide
        || right.piece.priority - left.piece.priority
        || left.inputIndex - right.inputIndex;
    })
    .map(({ piece }) => piece);
}

function candidatePositions(sheet, config) {
  const usable = usableAreaAfterMargins(sheet.width, sheet.height, config.margins);
  const xValues = new Set([usable.x]);
  const yValues = new Set([usable.y]);

  sheet.pieces.forEach((piece) => {
    xValues.add(piece.x + piece.width + config.kerf);
    yValues.add(piece.y + piece.height + config.kerf);
  });
  [...config.blockedRegions, ...config.reservedRegions].forEach((region) => {
    xValues.add(region.x + region.width);
    yValues.add(region.y + region.height);
  });

  const positions = [];
  [...yValues].sort((left, right) => left - right).forEach((y) => {
    [...xValues].sort((left, right) => left - right).forEach((x) => {
      positions.push({ x, y });
    });
  });
  return positions;
}

function placementRank(placement, sheet, config) {
  const usable = usableAreaAfterMargins(sheet.width, sheet.height, config.margins);
  const remainingWidth = usable.right - (placement.x + placement.width);
  const remainingHeight = usable.bottom - (placement.y + placement.height);
  return [
    Math.min(remainingWidth, remainingHeight),
    Math.max(remainingWidth, remainingHeight),
    placement.y,
    placement.x,
    placement.rotated ? 1 : 0,
    sheet.index,
  ];
}

function compareRank(left, right) {
  for (let index = 0; index < left.rank.length; index += 1) {
    if (left.rank[index] !== right.rank[index]) {
      return left.rank[index] - right.rank[index];
    }
  }
  return 0;
}

function bestPlacementForSheet(sheet, piece, config) {
  const placements = [];
  physicalVariants(piece, config).forEach((variant) => {
    candidatePositions(sheet, config).forEach(({ x, y }) => {
      const placement = { ...variant, x, y };
      if (!placementFits({
        piece: placement,
        sheet,
        margins: config.margins,
        kerf: config.kerf,
        blockedRegions: config.blockedRegions,
        reservedRegions: config.reservedRegions,
        placedPieces: sheet.pieces,
      })) return;
      placements.push({
        placement,
        rank: placementRank(placement, sheet, config),
      });
    });
  });
  return placements.sort(compareRank)[0] || null;
}

export function runBestFitStrategy({
  config,
  pieces,
  sourcePieces,
  inputValidation,
}) {
  const orderedPieces = orderedBestFitPieces(pieces);
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

    const available = sheets
      .map((sheet) => {
        const placement = bestPlacementForSheet(sheet, piece, config);
        return placement ? { sheet, ...placement } : null;
      })
      .filter(Boolean)
      .sort(compareRank);
    if (available.length) {
      available[0].sheet.pieces.push(available[0].placement);
      return;
    }

    const sheet = createStrategySheet(sheets.length + 1, config);
    const firstPlacement = bestPlacementForSheet(sheet, piece, config);
    if (firstPlacement) {
      sheet.pieces.push(firstPlacement.placement);
      sheets.push(sheet);
    } else {
      unplacedPieces.push({ ...piece, reason: 'not-placed' });
    }
  });

  return createStrategyCandidate({
    strategy: 'best-fit',
    config,
    pieces,
    sourcePieces,
    sheets,
    unplacedPieces,
    inputValidation,
    metadata: {
      strategyVersion: 1,
      placementRule: 'best-short-side-fit',
      pieceOrder: 'largest-area-longest-side-priority-input',
    },
  });
}
