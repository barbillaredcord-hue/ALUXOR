import { describe, expect, it } from 'vitest';
import { evaluateCandidates } from '../evaluation.js';
import { selectRecommendedCandidate } from '../selection.js';

function candidate({
  id,
  strategy,
  registryIndex,
  requiredSheets = 1,
  wasteArea = 100,
  utilization = 80,
  usedArea = 400,
  valid = true,
} = {}) {
  return {
    id,
    strategy,
    complete: true,
    valid,
    placedPieces: [],
    unplacedPieces: [],
    diagnostics: [],
    validation: {
      isPhysicallyValid: valid,
      errors: [],
    },
    summary: {
      requiredSheets,
      wasteArea,
      utilization,
      usedArea,
    },
    metadata: { registryIndex },
  };
}

describe('candidate selection', () => {
  it('devuelve exclusivamente recomendación, explicación y ranking', () => {
    const evaluated = evaluateCandidates([
      candidate({ id: 'shelf', strategy: 'shelf', registryIndex: 0 }),
    ]);
    const selection = selectRecommendedCandidate(evaluated);

    expect(Object.keys(selection)).toEqual([
      'recommendedCandidateId',
      'selectionReason',
      'ranking',
    ]);
    expect(selection.recommendedCandidateId).toBe('shelf');
    expect(selection.selectionReason).toBe('Es el único candidato elegible.');
  });

  it('recomienda menos hojas antes que menor desperdicio', () => {
    const evaluated = evaluateCandidates([
      candidate({
        id: 'shelf',
        strategy: 'shelf',
        registryIndex: 0,
        requiredSheets: 2,
        wasteArea: 10,
      }),
      candidate({
        id: 'best-fit',
        strategy: 'best-fit',
        registryIndex: 1,
        requiredSheets: 1,
        wasteArea: 100,
      }),
    ]);
    const selection = selectRecommendedCandidate(evaluated);

    expect(selection.recommendedCandidateId).toBe('best-fit');
    expect(selection.selectionReason).toBe('Utiliza 1 hoja(s) menos que shelf.');
    expect(selection.ranking.map((item) => item.candidateId)).toEqual([
      'best-fit',
      'shelf',
    ]);
  });

  it('recomienda Shelf en empate físico por el orden estable', () => {
    const evaluated = evaluateCandidates([
      candidate({ id: 'shelf', strategy: 'shelf', registryIndex: 0 }),
      candidate({ id: 'best-fit', strategy: 'best-fit', registryIndex: 1 }),
    ]);
    const selection = selectRecommendedCandidate(evaluated);

    expect(selection.recommendedCandidateId).toBe('shelf');
    expect(selection.selectionReason)
      .toBe('Empate físico resuelto por el orden estable de estrategias.');
  });

  it('nunca recomienda candidatos descartados', () => {
    const evaluated = evaluateCandidates([
      candidate({
        id: 'invalid',
        strategy: 'shelf',
        registryIndex: 0,
        valid: false,
      }),
      candidate({
        id: 'valid',
        strategy: 'best-fit',
        registryIndex: 1,
      }),
    ]);
    const selection = selectRecommendedCandidate(evaluated);

    expect(selection.recommendedCandidateId).toBe('valid');
    expect(selection.ranking.find((item) => item.candidateId === 'invalid').eligible)
      .toBe(false);
  });

  it('explica cuando no existe un candidato elegible', () => {
    const evaluated = evaluateCandidates([
      candidate({
        id: 'invalid',
        strategy: 'shelf',
        registryIndex: 0,
        valid: false,
      }),
    ]);

    expect(selectRecommendedCandidate(evaluated)).toMatchObject({
      recommendedCandidateId: null,
      selectionReason: 'No existe un candidato elegible.',
    });
  });

  it('no modifica candidatos evaluados', () => {
    const evaluated = evaluateCandidates([
      candidate({ id: 'shelf', strategy: 'shelf', registryIndex: 0 }),
      candidate({ id: 'best-fit', strategy: 'best-fit', registryIndex: 1 }),
    ]);
    const snapshot = structuredClone(evaluated);

    expect(selectRecommendedCandidate(evaluated)).toEqual(
      selectRecommendedCandidate(evaluated),
    );
    expect(evaluated).toEqual(snapshot);
  });
});
