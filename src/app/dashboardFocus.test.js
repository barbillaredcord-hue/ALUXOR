import { describe, expect, it, vi } from 'vitest';
import { applyFocusedProjectSelection } from './App.jsx';

describe('applyFocusedProjectSelection', () => {
  it('sincroniza foco, cotización y producción sin abandonar Inicio', () => {
    const setFocusedProjectId = vi.fn();
    const setSelectedProductionOrderId = vi.fn();
    const setSelectedPurchaseId = vi.fn();
    const loadHistoryItem = vi.fn();
    const setActiveSection = vi.fn();
    const project = {
      id: 'q2',
      quoteId: 'q2',
      productionOrderId: 'ot2',
      purchaseIds: ['p2'],
    };
    const quote = { id: 'q2', form: { producto: 'Cancel' } };

    expect(applyFocusedProjectSelection({
      projectId: 'q2',
      projects: [project],
      history: [quote],
      setFocusedProjectId,
      setSelectedProductionOrderId,
      setSelectedPurchaseId,
      loadHistoryItem,
      preserveSection: 'inicio',
      setActiveSection,
    })).toBe(project);
    expect(setFocusedProjectId).toHaveBeenCalledWith('q2');
    expect(setSelectedProductionOrderId).toHaveBeenCalledWith('ot2');
    expect(setSelectedPurchaseId).toHaveBeenCalledWith('p2');
    expect(loadHistoryItem).toHaveBeenCalledWith(quote);
    expect(setActiveSection).toHaveBeenCalledWith('inicio');
  });

  it('no cambia el contexto si el proyecto solicitado no existe', () => {
    const setFocusedProjectId = vi.fn();

    expect(applyFocusedProjectSelection({
      projectId: 'missing',
      projects: [],
      history: [],
      setFocusedProjectId,
      setSelectedProductionOrderId: vi.fn(),
      loadHistoryItem: vi.fn(),
      setActiveSection: vi.fn(),
    })).toBeNull();
    expect(setFocusedProjectId).not.toHaveBeenCalled();
  });
});
