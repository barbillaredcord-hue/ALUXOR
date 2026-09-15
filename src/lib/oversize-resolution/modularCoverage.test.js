import { describe, expect, it } from 'vitest';
import {
  modularCoveragePieces,
  resolveModularCoverage,
} from './modularCoverage.js';

describe('modular coverage', () => {
  it('resuelve verticalmente el caso 67 x 263 sobre tira 16 x 290', () => {
    const result = resolveModularCoverage({
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      quantity: 1,
      orientation: 'vertical',
      unit: 'cm',
    });
    expect(result).toMatchObject({
      feasible: true,
      stripsRequired: 5,
      stripsPerSurface: 5,
      cutLengthPerStrip: 263,
      grossCoverage: 80,
      netCoverage: 67,
      trimWidth: 13,
      offcutLengthPerStrip: 27,
      totalLinearLength: 1315,
      finishedLastStripWidth: 3,
    });
  });

  it('resuelve horizontalmente y rechaza giro o largo comercial insuficiente', () => {
    expect(resolveModularCoverage({
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      orientation: 'horizontal',
    })).toMatchObject({
      feasible: true,
      stripsRequired: 17,
      cutLengthPerStrip: 67,
      grossCoverage: 272,
      trimWidth: 9,
    });
    expect(resolveModularCoverage({
      requiredWidth: 300,
      requiredLength: 67,
      plankWidth: 16,
      plankLength: 290,
      orientation: 'horizontal',
    }).feasible).toBe(false);
    expect(resolveModularCoverage({
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      orientation: 'horizontal',
      allowRotation: false,
    }).feasible).toBe(false);
  });

  it('redondea hacia arriba, considera junta, cantidad y unidad normalizada', () => {
    const result = resolveModularCoverage({
      requiredWidth: 670,
      requiredLength: 2630,
      plankWidth: 160,
      plankLength: 2900,
      quantity: 2,
      orientation: 'vertical',
      jointGap: 5,
      kerf: 3,
      unit: 'mm',
    });
    expect(result).toMatchObject({
      feasible: true,
      stripsPerSurface: 5,
      stripsRequired: 10,
      cutLengthPerStrip: 263,
      jointGap: 0.5,
      kerf: 0.3,
      grossCoverage: 82,
      trimWidth: 15,
      offcutLengthPerStrip: 27,
      totalLinearLength: 2630,
      unit: 'cm',
    });
  });

  it('rechaza entradas inválidas y recorte lateral deshabilitado', () => {
    expect(resolveModularCoverage({ requiredWidth: 0 }).feasible).toBe(false);
    expect(resolveModularCoverage({
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      quantity: 1.5,
    }).feasible).toBe(false);
    expect(resolveModularCoverage({
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      allowSideTrim: false,
    }).feasible).toBe(false);
  });

  it('genera tiras físicas deterministas, trazables y sin mutar entradas', () => {
    const input = {
      requiredWidth: 67,
      requiredLength: 263,
      plankWidth: 16,
      plankLength: 290,
      quantity: 2,
      orientation: 'vertical',
    };
    const sourcePiece = { id: 'lambrin', name: 'Lambrín', quantity: 2 };
    const before = structuredClone({ input, sourcePiece });
    const coverage = resolveModularCoverage(input);
    const first = modularCoveragePieces({
      sourcePiece,
      coverage,
      alternativeId: 'modular-vertical',
    });
    const second = modularCoveragePieces({
      sourcePiece,
      coverage,
      alternativeId: 'modular-vertical',
    });
    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(first.every((piece) => (
      piece.width === 16
      && piece.height === 263
      && piece.quantity === 2
      && piece.sourcePieceId === 'lambrin'
      && piece.modularCoverage === true
      && piece.stripCount === 5
    ))).toBe(true);
    expect(first.at(-1)).toMatchObject({
      stripIndex: 5,
      finishedCoverageWidth: 3,
      grossCutWidth: 16,
      trimRequired: true,
      trimWidth: 13,
      installationOrientation: 'vertical',
    });
    expect({ input, sourcePiece }).toEqual(before);
  });
});
