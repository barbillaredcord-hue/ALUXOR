import { describe, expect, it } from 'vitest';
import {
  candidateMetrics,
  criticalCandidateDiagnostics,
  evaluateCandidate,
  evaluateCandidates,
} from '../evaluation.js';

function candidate({
  id = 'candidate',
  strategy = 'shelf',
  registryIndex = 0,
  complete = true,
  valid = true,
  physicallyValid = true,
  diagnostics = [],
  errors = [],
  unplacedPieces = 0,
  requiredSheets = 1,
  wasteArea = 100,
  utilization = 80,
  usedArea = 400,
} = {}) {
  return {
    id,
    strategy,
    complete,
    valid,
    placedPieces: [],
    unplacedPieces: Array.from({ length: unplacedPieces }, (_, index) => ({
      id: `unplaced-${index}`,
    })),
    diagnostics,
    validation: {
      isPhysicallyValid: physicallyValid,
      errors,
    },
    summary: {
      requiredSheets,
      wasteArea,
      utilization,
      usedArea,
      unplacedPieceCount: unplacedPieces,
    },
    metadata: { registryIndex },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

describe('candidate evaluation', () => {
  it('evalúa un candidato elegible mediante una tupla transparente', () => {
    const source = candidate({
      requiredSheets: 2,
      wasteArea: 150,
      utilization: 75,
      usedArea: 450,
    });
    const evaluation = evaluateCandidate(source, 0);

    expect(candidateMetrics(source)).toEqual({
      unplacedPieces: 0,
      requiredSheets: 2,
      physicalWaste: 150,
      utilization: 75,
      usedArea: 450,
      wasteArea: 150,
    });
    expect(evaluation).toMatchObject({
      eligible: true,
      score: [0, 2, 150, -75, -450, 150, 0],
      rank: null,
      strategyOrder: 0,
    });
    expect(evaluation.reasons).toContain('Todas las piezas fueron colocadas.');
  });

  it.each([
    ['incompleto', { complete: false }],
    ['físicamente inválido', { valid: false, physicallyValid: false }],
    ['pieza duplicada', {
      diagnostics: [{
        code: 'PIECE_ACCOUNTING_DUPLICATE',
        category: 'physical',
        message: 'Pieza duplicada.',
      }],
    }],
    ['pieza desaparecida', {
      diagnostics: [{
        code: 'PIECE_ACCOUNTING_MISSING',
        category: 'physical',
        message: 'Pieza desaparecida.',
      }],
    }],
    ['error geométrico', {
      diagnostics: [{
        code: 'PIECE_COLLISION',
        category: 'physical',
        message: 'Piezas sobrepuestas.',
      }],
    }],
  ])('descarta un candidato %s antes de puntuar', (_label, overrides) => {
    const evaluation = evaluateCandidate(candidate(overrides), 0);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.score).toBeNull();
    expect(evaluation.reasons.some((reason) => reason.startsWith('Descartado'))).toBe(true);
  });

  it('deduplica diagnósticos críticos procedentes de validation y diagnostics', () => {
    const error = {
      code: 'PIECE_COLLISION',
      category: 'physical',
      message: 'Colisión.',
      pieceId: 'p1',
    };
    const source = candidate({ diagnostics: [error], errors: [error] });

    expect(criticalCandidateDiagnostics(source)).toEqual([error]);
  });

  it('aplica el orden lexicográfico y conserva el arreglo original', () => {
    const source = [
      candidate({
        id: 'more-sheets',
        strategy: 'shelf',
        registryIndex: 0,
        requiredSheets: 2,
        wasteArea: 10,
        utilization: 95,
      }),
      candidate({
        id: 'fewer-sheets',
        strategy: 'best-fit',
        registryIndex: 1,
        requiredSheets: 1,
        wasteArea: 100,
        utilization: 70,
      }),
    ];
    const evaluated = evaluateCandidates(source);

    expect(evaluated.map((item) => item.id)).toEqual(['more-sheets', 'fewer-sheets']);
    expect(evaluated.find((item) => item.id === 'fewer-sheets').evaluation.rank).toBe(1);
    expect(evaluated.find((item) => item.id === 'more-sheets').evaluation.rank).toBe(2);
    expect(source.every((item) => !Object.hasOwn(item, 'evaluation'))).toBe(true);
  });

  it('desempata por desperdicio, aprovechamiento y área utilizada en ese orden', () => {
    const lowerWaste = evaluateCandidates([
      candidate({
        id: 'more-waste',
        registryIndex: 0,
        wasteArea: 100,
        utilization: 90,
        usedArea: 900,
      }),
      candidate({
        id: 'less-waste',
        registryIndex: 1,
        wasteArea: 80,
        utilization: 70,
        usedArea: 700,
      }),
    ]);
    const higherUtilization = evaluateCandidates([
      candidate({
        id: 'less-utilization',
        registryIndex: 0,
        wasteArea: 80,
        utilization: 70,
        usedArea: 900,
      }),
      candidate({
        id: 'more-utilization',
        registryIndex: 1,
        wasteArea: 80,
        utilization: 80,
        usedArea: 700,
      }),
    ]);
    const higherUsedArea = evaluateCandidates([
      candidate({
        id: 'less-used-area',
        registryIndex: 0,
        wasteArea: 80,
        utilization: 80,
        usedArea: 700,
      }),
      candidate({
        id: 'more-used-area',
        registryIndex: 1,
        wasteArea: 80,
        utilization: 80,
        usedArea: 800,
      }),
    ]);

    expect(lowerWaste.find((item) => item.id === 'less-waste').evaluation.rank).toBe(1);
    expect(higherUtilization.find((item) => (
      item.id === 'more-utilization'
    )).evaluation.rank).toBe(1);
    expect(higherUsedArea.find((item) => item.id === 'more-used-area').evaluation.rank)
      .toBe(1);
  });

  it('resuelve empates mediante el orden estable de estrategia', () => {
    const evaluated = evaluateCandidates([
      candidate({ id: 'best-fit', strategy: 'best-fit', registryIndex: 1 }),
      candidate({ id: 'shelf', strategy: 'shelf', registryIndex: 0 }),
    ]);

    expect(evaluated.find((item) => item.id === 'shelf').evaluation.rank).toBe(1);
    expect(evaluated.find((item) => item.id === 'best-fit').evaluation.rank).toBe(2);
  });

  it('descarta métricas físicas fuera de contrato', () => {
    const evaluation = evaluateCandidate(candidate({ utilization: 101 }), 0);

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.score).toBeNull();
    expect(evaluation.reasons)
      .toContain('Descartado por métricas físicas inválidas o incompletas.');
  });

  it('es determinista y no modifica candidatos congelados', () => {
    const source = deepFreeze([
      candidate({ id: 'shelf', strategy: 'shelf', registryIndex: 0 }),
      candidate({
        id: 'best-fit',
        strategy: 'best-fit',
        registryIndex: 1,
        requiredSheets: 2,
      }),
    ]);
    const snapshot = structuredClone(source);

    expect(evaluateCandidates(source)).toEqual(evaluateCandidates(source));
    expect(source).toEqual(snapshot);
  });
});
