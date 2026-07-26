import { describe, expect, it } from 'vitest';
import {
  CUT_STRATEGY_REGISTRY,
  generateCutCandidates,
} from '../candidates.js';
import { normalizeCutInput } from '../normalization.js';
import { optimizeCuts } from '../optimizer.js';
import { candidateId } from '../strategy-contract.js';
import { validateCutInput } from '../validation.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function candidatesFor(input) {
  const normalized = normalizeCutInput(input);
  return generateCutCandidates(
    normalized,
    validateCutInput(input, normalized),
  );
}

describe('cut optimizer candidate generator', () => {
  it('expone un contrato común completo para cada estrategia', () => {
    const candidates = candidatesFor({
      sheetWidth: 100,
      sheetHeight: 80,
      pieces: [{ id: 'p1', name: 'Panel', width: 20, height: 30, quantity: 1 }],
    });

    candidates.forEach((candidate) => {
      expect(candidate).toEqual(expect.objectContaining({
        id: expect.any(String),
        strategy: expect.any(String),
        sheets: expect.any(Array),
        placedPieces: expect.any(Array),
        unplacedPieces: expect.any(Array),
        validation: expect.any(Object),
        diagnostics: expect.any(Array),
        summary: expect.objectContaining({
          requiredSheets: expect.any(Number),
          usedArea: expect.any(Number),
          wasteArea: expect.any(Number),
          utilization: expect.any(Number),
        }),
        metadata: expect.objectContaining({
          contractVersion: 1,
          registryIndex: expect.any(Number),
        }),
        valid: expect.any(Boolean),
        complete: expect.any(Boolean),
      }));
    });
  });

  it('mantiene orden estable de estrategias e IDs deterministas', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0.3,
      pieces: [
        { id: 'a', name: 'A', width: 40, height: 30, quantity: 2 },
        { id: 'b', name: 'B', width: 20, height: 20, quantity: 1 },
      ],
    };
    const first = candidatesFor(input);
    const second = candidatesFor(input);

    expect(CUT_STRATEGY_REGISTRY.map((entry) => entry.id)).toEqual(['shelf', 'best-fit']);
    expect(first.map((candidate) => candidate.strategy)).toEqual(['shelf', 'best-fit']);
    expect(first.map((candidate) => candidate.id)).toEqual(second.map((candidate) => candidate.id));
    expect(first).toEqual(second);
  });

  it('calcula IDs sin depender del orden incidental de propiedades de config', () => {
    const pieces = normalizeCutInput({
      pieces: [{ id: 'a', name: 'A', width: 20, height: 30, quantity: 1 }],
    }).pieces;
    const firstConfig = normalizeCutInput({
      sheetWidth: 100,
      sheetHeight: 80,
      pieces: [],
    }).config;
    const secondConfig = {
      ...firstConfig,
      sheetHeight: firstConfig.sheetHeight,
      sheetWidth: firstConfig.sheetWidth,
    };

    expect(candidateId('shelf', firstConfig, pieces))
      .toBe(candidateId('shelf', secondConfig, pieces));
  });

  it('no modifica la entrada normalizada ni la entrada pública', () => {
    const input = deepFreeze({
      sheetWidth: 100,
      sheetHeight: 80,
      margins: { top: 2, right: 2, bottom: 2, left: 2 },
      pieces: [{
        id: 'source',
        name: 'Panel',
        width: 20,
        height: 30,
        quantity: 2,
      }],
    });
    const snapshot = structuredClone(input);
    const normalized = deepFreeze(normalizeCutInput(input));
    const normalizedSnapshot = structuredClone(normalized);
    const validation = validateCutInput(input, normalized);

    expect(() => generateCutCandidates(normalized, validation)).not.toThrow();
    expect(input).toEqual(snapshot);
    expect(normalized).toEqual(normalizedSnapshot);
  });

  it('optimizeCuts conserva Shelf como resultado principal y solo añade candidates', () => {
    const result = optimizeCuts({
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      pieces: [{ id: 'p1', name: 'Panel', width: 50, height: 40, quantity: 2 }],
    });
    const shelf = result.candidates[0];

    expect(shelf.strategy).toBe('shelf');
    expect(result.sheets).toBe(shelf.sheets);
    expect(result.hojas).toBe(result.sheets);
    expect(result.placedPieces).toBe(shelf.placedPieces);
    expect(result.unplacedPieces).toBe(shelf.unplacedPieces);
    expect(result.summary).toBe(shelf.summary);
    expect(result.validation).toBe(shelf.validation);
    expect(result.sheetCount).toBe(shelf.summary.requiredSheets);
    expect(result.cantidadHojas).toBe(shelf.summary.requiredSheets);
    expect(result.areaUtilizada).toBe(shelf.summary.usedArea);
    expect(result.areaDesperdiciada).toBe(shelf.summary.wasteArea);
    expect(result.porcentajeAprovechamiento).toBe(shelf.summary.utilization);
    expect(result.recommendedCandidateId).toEqual(expect.any(String));
    expect(result.selectionReason).toEqual(expect.any(String));
    expect(result.candidateRanking).toEqual(expect.any(Array));
    expect(result.candidates.every((candidate) => (
      candidate.evaluation && Number.isInteger(candidate.evaluation.rank)
    ))).toBe(true);
  });

  it('recomienda Best Fit sin sustituir la salida pública Shelf', () => {
    const result = optimizeCuts({
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
    });
    const shelf = result.candidates.find((candidate) => candidate.strategy === 'shelf');
    const bestFit = result.candidates.find((candidate) => candidate.strategy === 'best-fit');

    expect(shelf.summary.requiredSheets).toBe(2);
    expect(bestFit.summary.requiredSheets).toBe(1);
    expect(result.recommendedCandidateId).toBe(bestFit.id);
    expect(result.selectionReason).toBe('Utiliza 1 hoja(s) menos que shelf.');
    expect(result.sheetCount).toBe(2);
    expect(result.sheets).toBe(shelf.sheets);
  });

  it('recomienda Shelf en empate y mantiene determinismo absoluto', () => {
    const input = {
      sheetWidth: 100,
      sheetHeight: 80,
      kerf: 0,
      pieces: [{ id: 'p1', name: 'Panel', width: 20, height: 20, quantity: 1 }],
    };
    const first = optimizeCuts(input);
    const second = optimizeCuts(input);
    const shelf = first.candidates.find((candidate) => candidate.strategy === 'shelf');

    expect(first.recommendedCandidateId).toBe(shelf.id);
    expect(first.selectionReason)
      .toBe('Empate físico resuelto por el orden estable de estrategias.');
    expect(first.candidateRanking[0].strategy).toBe('shelf');
    expect(first).toEqual(second);
  });
});
