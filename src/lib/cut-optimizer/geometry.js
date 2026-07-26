import { ZERO_MARGINS } from './normalization.js';

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rectangleEdges(rect = {}) {
  const x = number(rect.x);
  const y = number(rect.y);
  const width = number(rect.width ?? rect.ancho);
  const height = number(rect.height ?? rect.alto);
  return {
    left: x,
    top: y,
    right: x + width,
    bottom: y + height,
    width,
    height,
  };
}

export function usableAreaAfterMargins(width, height, margins = ZERO_MARGINS) {
  const sheetWidth = number(width);
  const sheetHeight = number(height);
  const top = number(margins?.top);
  const right = number(margins?.right);
  const bottom = number(margins?.bottom);
  const left = number(margins?.left);
  const usableWidth = Math.max(0, sheetWidth - left - right);
  const usableHeight = Math.max(0, sheetHeight - top - bottom);
  return {
    x: left,
    y: top,
    width: usableWidth,
    height: usableHeight,
    right: left + usableWidth,
    bottom: top + usableHeight,
    area: usableWidth * usableHeight,
  };
}

export function pointWithinBounds(point = {}, bounds = {}) {
  const x = number(point.x);
  const y = number(point.y);
  const area = rectangleEdges(bounds);
  return x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}

export function rectangleWithinBounds(rect = {}, bounds = {}) {
  const candidate = rectangleEdges(rect);
  const area = rectangleEdges(bounds);
  return candidate.width >= 0
    && candidate.height >= 0
    && candidate.left >= area.left
    && candidate.top >= area.top
    && candidate.right <= area.right
    && candidate.bottom <= area.bottom;
}

export function rectanglesIntersect(first = {}, second = {}) {
  const left = rectangleEdges(first);
  const right = rectangleEdges(second);
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

export function rectanglesSeparatedByKerf(first = {}, second = {}, kerf = 0) {
  const left = rectangleEdges(first);
  const right = rectangleEdges(second);
  const gap = Math.max(0, number(kerf));
  return left.right + gap <= right.left
    || right.right + gap <= left.left
    || left.bottom + gap <= right.top
    || right.bottom + gap <= left.top;
}

export function piecesCollide(first, second, kerf = 0) {
  return !rectanglesSeparatedByKerf(first, second, kerf);
}

export function collidingRegion(rect, regions = []) {
  if (!Array.isArray(regions)) return null;
  return regions.find((region) => rectanglesIntersect(rect, region)) || null;
}

export function collidesWithBlockedRegions(rect, regions = []) {
  return Boolean(collidingRegion(rect, regions));
}

export function collidesWithReservedRegions(rect, regions = []) {
  return Boolean(collidingRegion(rect, regions));
}

export function orientationAllowed(piece = {}, rotated = false, config = {}) {
  const rotation = piece.rotation || (piece.allowRotation === false ? 'forbidden' : 'allowed');
  if (rotated && config.allowRotation === false) return false;
  if (rotation === 'required') return rotated;
  if (rotation === 'forbidden') return !rotated;
  return true;
}

export function physicalVariants(piece = {}, config = {}) {
  const direct = {
    ...piece,
    width: piece.originalWidth ?? piece.width,
    height: piece.originalHeight ?? piece.height,
    rotated: false,
  };
  const rotated = {
    ...piece,
    width: piece.originalHeight ?? piece.height,
    height: piece.originalWidth ?? piece.width,
    rotated: true,
  };
  const variants = [];
  if (orientationAllowed(piece, false, config)) variants.push(direct);
  if (
    orientationAllowed(piece, true, config)
    && (rotated.width !== direct.width || rotated.height !== direct.height || piece.rotation === 'required')
  ) {
    variants.push(rotated);
  }
  return variants;
}

export function placementFits({
  piece,
  sheet,
  margins = ZERO_MARGINS,
  kerf = 0,
  blockedRegions = [],
  reservedRegions = [],
  placedPieces = [],
} = {}) {
  const bounds = usableAreaAfterMargins(sheet?.width, sheet?.height, margins);
  if (!rectangleWithinBounds(piece, bounds)) return false;
  if (collidesWithBlockedRegions(piece, blockedRegions)) return false;
  if (collidesWithReservedRegions(piece, reservedRegions)) return false;
  return !placedPieces.some((placed) => piecesCollide(piece, placed, kerf));
}

export function pieceFitsInSheet(piece, sheet, config = {}) {
  const bounds = usableAreaAfterMargins(
    sheet?.width ?? config.sheetWidth,
    sheet?.height ?? config.sheetHeight,
    config.margins,
  );
  return physicalVariants(piece, config).some((variant) => (
    variant.width <= bounds.width && variant.height <= bounds.height
  ));
}
