import { describe, expect, it } from 'vitest';
import { optimizationSessionFixture } from './testFixtures.js';
import {
  normalizeOptimizationSessionWorkingInput,
  optimizationSessionCandidateStrategy,
  optimizationSessionPieceOrder,
  optimizationSessionWorkingInputFromSession,
  optimizationSessionWorkingInputSignature,
  sessionWithOptimizationWorkingInput,
} from './workingInput.js';

const input = {
  type: 'sheet',
  materialId: 'material-001',
  thickness: 15,
  selectedPieceIds: Array.from({ length: 13 }, (_, index) => `piece-${index + 1}`),
  unit: 'cm',
  formatWidth: 122,
  formatHeight: 244,
  kerf: 0.3,
  allowRotation: true,
  grainDirection: true,
  margins: { top: 1, right: 2, bottom: 1, left: 2 },
  blockedRegions: [{ x: 0, y: 0, width: 2, height: 3 }],
  reservedRegions: [{ x: 120, y: 240, width: 2, height: 4 }],
  selectedCandidateId: 'best-fit-bbb',
};

describe('Optimization Session working input', () => {
  it('conserva selección y configuración completa sin copiar piezas ni geometría', () => {
    const session = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture(),
      input,
    );
    const restored = optimizationSessionWorkingInputFromSession(session);

    expect(restored).toMatchObject({
      materialId: 'material-001',
      thickness: 15,
      selectedPieceIds: [...input.selectedPieceIds].sort((left, right) => (
        left.localeCompare(right)
      )),
      formatWidth: 122,
      formatHeight: 244,
      kerf: 0.3,
      allowRotation: true,
      grainDirection: true,
      margins: input.margins,
      blockedRegions: input.blockedRegions,
      reservedRegions: input.reservedRegions,
    });
    expect(JSON.stringify(session)).not.toContain('"pieces"');
    expect(JSON.stringify(session)).not.toContain('"sheets"');
  });

  it('normaliza selección y firma de forma determinista', () => {
    const left = normalizeOptimizationSessionWorkingInput({
      ...input,
      selectedPieceIds: ['piece-1', 'piece-2', 'piece-1'],
    });
    const right = normalizeOptimizationSessionWorkingInput({
      ...input,
      selectedPieceIds: ['piece-1', 'piece-2'],
    });

    expect(left.selectedPieceIds).toEqual(['piece-1', 'piece-2']);
    expect(optimizationSessionWorkingInputSignature(left))
      .toBe(optimizationSessionWorkingInputSignature(right));
  });

  it('incluye el espesor en la firma canónica', () => {
    expect(optimizationSessionWorkingInputSignature({
      ...input,
      thickness: 15,
    })).not.toBe(optimizationSessionWorkingInputSignature({
      ...input,
      thickness: 16,
    }));
    expect(normalizeOptimizationSessionWorkingInput({
      ...input,
      thickness: undefined,
    }).thickness).toBe(16);
  });

  it('separa estrategia física y orden de piezas sin romper entradas legacy', () => {
    const bestFit = normalizeOptimizationSessionWorkingInput({
      ...input,
      strategy: 'best-fit',
      pieceOrder: 'input-order',
    });
    const legacy = normalizeOptimizationSessionWorkingInput({
      ...input,
      strategy: 'input-order',
      selectedCandidateId: 'shelf-legacy',
    });

    expect(bestFit).toMatchObject({
      strategy: 'best-fit',
      pieceOrder: 'input-order',
    });
    expect(optimizationSessionCandidateStrategy(bestFit)).toBe('best-fit');
    expect(optimizationSessionPieceOrder(bestFit)).toBe('input-order');
    expect(optimizationSessionCandidateStrategy(legacy)).toBe('shelf');
    expect(optimizationSessionPieceOrder(legacy)).toBe('input-order');
  });
});
