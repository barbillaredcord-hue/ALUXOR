import { describe, expect, it } from 'vitest';
import {
  collidesWithBlockedRegions,
  collidesWithReservedRegions,
  orientationAllowed,
  physicalVariants,
  pieceFitsInSheet,
  piecesCollide,
  placementFits,
  pointWithinBounds,
  rectanglesIntersect,
  rectanglesSeparatedByKerf,
  rectangleWithinBounds,
  usableAreaAfterMargins,
} from '../geometry.js';

describe('cut optimizer geometry', () => {
  it('comprueba puntos y rectángulos dentro de límites', () => {
    const bounds = { x: 10, y: 5, width: 80, height: 60 };

    expect(pointWithinBounds({ x: 10, y: 5 }, bounds)).toBe(true);
    expect(pointWithinBounds({ x: 91, y: 5 }, bounds)).toBe(false);
    expect(rectangleWithinBounds({ x: 10, y: 5, width: 80, height: 60 }, bounds)).toBe(true);
    expect(rectangleWithinBounds({ x: 89, y: 5, width: 2, height: 10 }, bounds)).toBe(false);
  });

  it('distingue intersección real de contacto entre bordes', () => {
    const first = { x: 0, y: 0, width: 50, height: 50 };

    expect(rectanglesIntersect(first, { x: 49, y: 0, width: 20, height: 20 })).toBe(true);
    expect(rectanglesIntersect(first, { x: 50, y: 0, width: 20, height: 20 })).toBe(false);
  });

  it('exige separación efectiva por kerf', () => {
    const first = { x: 0, y: 0, width: 50, height: 50 };
    const touching = { x: 50, y: 0, width: 20, height: 20 };
    const separated = { x: 50.3, y: 0, width: 20, height: 20 };

    expect(rectanglesSeparatedByKerf(first, touching, 0)).toBe(true);
    expect(rectanglesSeparatedByKerf(first, touching, 0.3)).toBe(false);
    expect(rectanglesSeparatedByKerf(first, separated, 0.3)).toBe(true);
    expect(piecesCollide(first, touching, 0.3)).toBe(true);
    expect(piecesCollide(first, separated, 0.3)).toBe(false);
  });

  it('calcula el área utilizable después de márgenes', () => {
    expect(usableAreaAfterMargins(100, 80, {
      top: 5,
      right: 10,
      bottom: 15,
      left: 20,
    })).toEqual({
      x: 20,
      y: 5,
      width: 70,
      height: 60,
      right: 90,
      bottom: 65,
      area: 4200,
    });
  });

  it('detecta colisiones con regiones bloqueadas y reservadas', () => {
    const piece = { x: 10, y: 10, width: 20, height: 20 };
    const collision = [{ x: 25, y: 25, width: 10, height: 10 }];
    const clear = [{ x: 30, y: 30, width: 10, height: 10 }];

    expect(collidesWithBlockedRegions(piece, collision)).toBe(true);
    expect(collidesWithBlockedRegions(piece, clear)).toBe(false);
    expect(collidesWithReservedRegions(piece, collision)).toBe(true);
    expect(collidesWithReservedRegions(piece, clear)).toBe(false);
  });

  it('respeta rotación global y por pieza', () => {
    const piece = {
      originalWidth: 90,
      originalHeight: 70,
      rotation: 'allowed',
    };

    expect(orientationAllowed(piece, true, { allowRotation: true })).toBe(true);
    expect(orientationAllowed(piece, true, { allowRotation: false })).toBe(false);
    expect(physicalVariants({ ...piece, rotation: 'forbidden' }, { allowRotation: true }))
      .toHaveLength(1);
    expect(physicalVariants({ ...piece, rotation: 'required' }, { allowRotation: true }))
      .toEqual([
        expect.objectContaining({ width: 70, height: 90, rotated: true }),
      ]);
  });

  it('comprueba encaje físico con orientación, márgenes, kerf y regiones', () => {
    const piece = {
      originalWidth: 90,
      originalHeight: 70,
      rotation: 'allowed',
    };
    const config = {
      sheetWidth: 80,
      sheetHeight: 100,
      allowRotation: true,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
    };

    expect(pieceFitsInSheet(piece, { width: 80, height: 100 }, config)).toBe(true);
    expect(pieceFitsInSheet(
      { ...piece, rotation: 'forbidden' },
      { width: 80, height: 100 },
      config,
    )).toBe(false);
    expect(placementFits({
      piece: { x: 10, y: 10, width: 20, height: 20 },
      sheet: { width: 100, height: 80 },
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      kerf: 1,
      blockedRegions: [{ x: 60, y: 10, width: 10, height: 10 }],
      reservedRegions: [{ x: 75, y: 10, width: 10, height: 10 }],
      placedPieces: [{ x: 40, y: 10, width: 10, height: 10 }],
    })).toBe(true);
    expect(placementFits({
      piece: { x: 59, y: 10, width: 10, height: 10 },
      sheet: { width: 100, height: 80 },
      blockedRegions: [{ x: 60, y: 10, width: 10, height: 10 }],
    })).toBe(false);
  });
});
