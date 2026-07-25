import { describe, expect, it, vi } from 'vitest';
import {
  buildMaterialStudioSession,
  canLeaveMaterialStudio,
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
});
