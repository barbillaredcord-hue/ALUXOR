import { describe, expect, it, vi } from 'vitest';
import {
  buildLegacyCalculatorTransfer,
  buildMaterialStudioSession,
  canLeaveMaterialStudio,
  resolveLegacyOptimizationInput,
  updateMaterialStudioLegacyWorkingInput,
} from './App.jsx';

describe('navegación de BR Material Studio', () => {
  it('conserva contexto de cotización, origen y selección disponible', () => {
    expect(buildMaterialStudioSession({
      activeSection: 'corte',
      activeQuoteId: 'quote-25',
      hasActiveQuote: true,
      selectedPieceIds: ['piece-a', 'piece-b'],
      timestamp: 100,
    })).toEqual({
      id: '100-quote-25',
      sourceSection: 'corte',
      initialMode: 'project',
      initialSelectedPieceIds: ['piece-a', 'piece-b'],
    });
  });

  it('abre modo rápido cuando no existe una cotización activa', () => {
    expect(buildMaterialStudioSession({
      activeSection: 'cotizador',
      timestamp: 200,
    })).toMatchObject({
      id: '200-quick',
      initialMode: 'quick',
    });
  });

  it('regresa sin preguntar cuando no hay cambios temporales', () => {
    const confirmDiscard = vi.fn();
    expect(canLeaveMaterialStudio({
      hasTemporaryChanges: false,
      confirmDiscard,
    })).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('permite permanecer o descartar cuando hay cambios temporales', () => {
    expect(canLeaveMaterialStudio({
      hasTemporaryChanges: true,
      confirmDiscard: () => false,
    })).toBe(false);
    expect(canLeaveMaterialStudio({
      hasTemporaryChanges: true,
      confirmDiscard: () => true,
    })).toBe(true);
  });

  it('reutiliza el estado temporal existente sin crear una sesión', () => {
    const studio = {
      ...buildMaterialStudioSession({
        activeSection: 'corte',
        activeQuoteId: 'quote-25',
        hasActiveQuote: true,
        timestamp: 300,
      }),
      quoteId: 'quote-25',
      legacyWorkingInput: null,
    };
    const workingInput = {
      materialId: 'material-1',
      selectedPieceIds: ['piece-1'],
      selectedCandidateId: 'best-fit-1',
      thickness: 15,
      formatWidth: 100,
      formatHeight: 200,
      kerf: 0.4,
    };
    const updated = updateMaterialStudioLegacyWorkingInput(studio, workingInput);
    const resolved = resolveLegacyOptimizationInput({
      materialStudioSession: updated,
      quoteId: 'quote-25',
    });
    const transfer = buildLegacyCalculatorTransfer({
      workingInput: resolved,
      quoteId: 'quote-25',
      materials: [{ id: 'material-1', nombre: 'Melamina' }],
    });

    expect(resolved).toBe(workingInput);
    expect(transfer).toMatchObject({
      quoteId: 'quote-25',
      selectedPieceIds: ['piece-1'],
      material: { id: 'material-1', nombre: 'Melamina' },
      config: {
        selectedCandidateId: 'best-fit-1',
        thickness: 15,
        kerf: 0.4,
      },
    });
    expect(updated).not.toHaveProperty('openedSessionId');
    expect(updated).not.toHaveProperty('activeSessionId');
    expect(resolveLegacyOptimizationInput({
      openedSessionInput: { selectedPieceIds: ['session-piece'] },
      materialStudioSession: updated,
      quoteId: 'quote-25',
    })).toBeNull();
    expect(resolveLegacyOptimizationInput({
      materialStudioSession: updated,
      quoteId: 'another-quote',
    })).toBeNull();
    expect(updateMaterialStudioLegacyWorkingInput(updated, null).legacyWorkingInput)
      .toBeNull();
  });
});
