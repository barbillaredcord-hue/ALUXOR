import { describe, expect, it } from 'vitest';
import {
  getFabricationSummary,
  normalizeFabricationCount,
} from './fabricationSummary.js';

describe('getFabricationSummary', () => {
  it('devuelve un resumen vacío sin inventar procesos', () => {
    expect(getFabricationSummary()).toEqual({
      projects: 0,
      pieces: 0,
      materials: 0,
      requiredSheets: 0,
      placedPieces: 0,
      unplacedPieces: 0,
      optimized: 0,
      pendingOptimization: 0,
      invalidPlans: 0,
      updatedAt: null,
    });
  });

  it('agrega datos reales del proyecto y del Cut Optimizer', () => {
    const projects = [
      {
        cantidad: 4,
        measureRows: [{ id: 'm1' }],
        materialRows: [{
          id: 'material-1',
          cutOptimization: {
            summary: { requiredSheets: 2 },
            placedPieces: [{ id: 'p1' }, { id: 'p2' }],
            unplacedPieces: [{ id: 'p3' }],
            validation: { isPhysicallyValid: false },
          },
        }, { id: 'material-2' }],
        updatedAt: '2026-07-10T10:00:00.000Z',
      },
      {
        cantidad: '1',
        measureRows: [{ id: 'm2' }],
        materialRows: [{ id: 'material-3' }],
        updated_at: '2026-07-12T10:00:00.000Z',
      },
    ];

    expect(getFabricationSummary(projects)).toEqual({
      projects: 2,
      pieces: 5,
      materials: 3,
      requiredSheets: 2,
      placedPieces: 2,
      unplacedPieces: 1,
      optimized: 1,
      pendingOptimization: 1,
      invalidPlans: 1,
      updatedAt: '2026-07-12T10:00:00.000Z',
    });
  });

  it('normaliza conteos reales sin aceptar negativos o fracciones', () => {
    expect(normalizeFabricationCount('3.9')).toBe(3);
    expect(normalizeFabricationCount(-2)).toBe(0);
    expect(normalizeFabricationCount(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeFabricationCount('dato inválido')).toBe(0);
  });

  it('no modifica la entrada', () => {
    const projects = [{
      cantidad: 1,
      materialRows: [{ cutOptimization: { placedPieces: [{ id: 'p1' }] } }],
    }];

    getFabricationSummary(projects);

    expect(projects).toEqual([{
      cantidad: 1,
      materialRows: [{ cutOptimization: { placedPieces: [{ id: 'p1' }] } }],
    }]);
  });

  it('ignora entradas inválidas y conserva proyectos con datos vacíos reales', () => {
    const summary = getFabricationSummary([
      null,
      [],
      {},
      { cantidad: Number.NaN },
      { measureRows: [], materialRows: [] },
    ]);

    expect(summary.projects).toBe(1);
    expect(summary.pendingOptimization).toBe(1);
  });

  it('ignora timestamps inválidos y conserva el más reciente', () => {
    const summary = getFabricationSummary([
      { cantidad: 1, updatedAt: 'fecha inválida' },
      { cantidad: 1, updatedAt: Date.UTC(2026, 6, 11) },
      { cantidad: 1, updated_at: '2026-07-12T00:00:00.000Z' },
    ]);

    expect(summary.updatedAt).toBe('2026-07-12T00:00:00.000Z');
  });

  it('acepta cero y valores finitos límite', () => {
    const summary = getFabricationSummary([
      { cantidad: 0 },
      { cantidad: Number.MAX_SAFE_INTEGER },
    ]);

    expect(summary.projects).toBe(2);
    expect(summary.pieces).toBe(Number.MAX_SAFE_INTEGER);
  });
});
