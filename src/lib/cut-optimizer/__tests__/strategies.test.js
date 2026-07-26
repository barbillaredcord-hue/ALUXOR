import { describe, expect, it } from 'vitest';
import {
  rectanglesIntersect,
  rectanglesSeparatedByKerf,
  rectangleWithinBounds,
  usableAreaAfterMargins,
} from '../geometry.js';
import { normalizeCutInput } from '../normalization.js';
import { runBestFitStrategy } from '../strategies/best-fit.js';
import { runShelfStrategy } from '../strategies/shelf.js';
import { validateCutInput } from '../validation.js';

function strategyInput(input) {
  const normalized = normalizeCutInput(input);
  return {
    ...normalized,
    inputValidation: validateCutInput(input, normalized),
  };
}

function runBoth(input) {
  const normalized = strategyInput(input);
  return [
    runShelfStrategy(normalized),
    runBestFitStrategy(normalized),
  ];
}

function expectPhysicalCandidate(candidate, config) {
  const bounds = usableAreaAfterMargins(
    config.sheetWidth,
    config.sheetHeight,
    config.margins,
  );
  candidate.sheets.forEach((sheet) => {
    sheet.pieces.forEach((piece, index) => {
      expect(rectangleWithinBounds(piece, bounds)).toBe(true);
      expect(config.blockedRegions.some((region) => (
        rectanglesIntersect(piece, region)
      ))).toBe(false);
      expect(config.reservedRegions.some((region) => (
        rectanglesIntersect(piece, region)
      ))).toBe(false);
      sheet.pieces.slice(index + 1).forEach((next) => {
        expect(rectanglesSeparatedByKerf(piece, next, config.kerf)).toBe(true);
      });
    });
  });
}

describe('cut optimizer strategies', () => {
  it('Shelf conserva el comportamiento legacy de orden y coordenadas', () => {
    const input = strategyInput({
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      strategy: 'input-order',
      pieces: [
        { id: 'a', name: 'A', width: 60, height: 40, quantity: 1 },
        { id: 'b', name: 'B', width: 40, height: 40, quantity: 1 },
        { id: 'c', name: 'C', width: 100, height: 60, quantity: 1 },
      ],
    });

    const candidate = runShelfStrategy(input);

    expect(candidate.strategy).toBe('shelf');
    expect(candidate.summary.requiredSheets).toBe(1);
    expect(candidate.sheets[0].pieces).toEqual([
      expect.objectContaining({ id: 'A-0-0', sourceId: 'a', x: 0, y: 0 }),
      expect.objectContaining({ id: 'B-1-0', sourceId: 'b', x: 60, y: 0 }),
      expect.objectContaining({ id: 'C-2-0', sourceId: 'c', x: 0, y: 40 }),
    ]);
  });

  it('ambas estrategias contabilizan exactamente una vez todas las piezas', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0.3,
      pieces: [
        { id: 'a', name: 'A', width: 40, height: 30, quantity: 2 },
        { id: 'b', name: 'B', width: 200, height: 20, quantity: 1 },
      ],
    };
    const expectedIds = normalizeCutInput(input).pieces.map((piece) => piece.id).sort();

    runBoth(input).forEach((candidate) => {
      const accounted = [
        ...candidate.placedPieces,
        ...candidate.unplacedPieces,
      ].map((piece) => piece.id).sort();
      expect(accounted).toEqual(expectedIds);
      expect(new Set(accounted).size).toBe(accounted.length);
      expect(candidate.complete).toBe(true);
      expect(candidate.metadata.inputPieceCount).toBe(3);
    });
  });

  it('ambas estrategias respetan kerf, márgenes, regiones y límites', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 2,
      margins: { top: 5, right: 5, bottom: 5, left: 5 },
      blockedRegions: [{ id: 'damage', x: 5, y: 5, width: 20, height: 20 }],
      reservedRegions: [{ id: 'reserve', x: 70, y: 5, width: 20, height: 20 }],
      pieces: [
        { id: 'a', name: 'A', width: 30, height: 20, quantity: 2 },
        { id: 'b', name: 'B', width: 25, height: 25, quantity: 2 },
      ],
    };
    const normalized = normalizeCutInput(input);

    runBoth(input).forEach((candidate) => {
      expect(candidate.valid).toBe(true);
      expectPhysicalCandidate(candidate, normalized.config);
    });
  });

  it('ambas estrategias respetan rotación obligatoria y veta', () => {
    const requiredInput = {
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        id: 'required',
        name: 'Rotada',
        width: 90,
        height: 70,
        quantity: 1,
        rotation: 'required',
      }],
    };
    const grainInput = {
      sheetWidth: 80,
      sheetHeight: 100,
      pieces: [{
        id: 'grain',
        name: 'Con veta',
        width: 90,
        height: 70,
        quantity: 1,
        grainDirection: 'vertical',
      }],
    };

    runBoth(requiredInput).forEach((candidate) => {
      expect(candidate.placedPieces[0]).toMatchObject({
        sourceId: 'required',
        width: 70,
        height: 90,
        rotated: true,
      });
    });
    runBoth(grainInput).forEach((candidate) => {
      expect(candidate.placedPieces).toEqual([]);
      expect(candidate.unplacedPieces[0]).toMatchObject({
        sourceId: 'grain',
        reason: 'too-large',
        rotated: false,
      });
      expect(candidate.complete).toBe(true);
      expect(candidate.valid).toBe(false);
    });
  });

  it('Best Fit encuentra una solución distinta y usa menos hojas que Shelf', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 100,
      kerf: 0,
      allowRotation: false,
      strategy: 'input-order',
      pieces: [
        { id: 'first', name: 'Primera', width: 70, height: 40, quantity: 1 },
        { id: 'tall', name: 'Alta', width: 30, height: 100, quantity: 1 },
        { id: 'large', name: 'Grande', width: 70, height: 60, quantity: 1 },
      ],
    };
    const [shelf, bestFit] = runBoth(input);

    expect(shelf.summary.requiredSheets).toBe(2);
    expect(bestFit.summary.requiredSheets).toBe(1);
    expect(bestFit.valid).toBe(true);
    expect(bestFit.complete).toBe(true);
    expect(bestFit.placedPieces.map((piece) => ({
      sourceId: piece.sourceId,
      x: piece.x,
      y: piece.y,
    }))).not.toEqual(shelf.placedPieces.map((piece) => ({
      sourceId: piece.sourceId,
      x: piece.x,
      y: piece.y,
    })));
  });
});
