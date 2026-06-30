import { describe, expect, it } from 'vitest';
import { getFabricationCutPlan } from '../FabricationSection.jsx';

describe('FabricationSection cut plan', () => {
  it('devuelve estado pendiente si no hay optimizacion', () => {
    const plan = getFabricationCutPlan(null);

    expect(plan.status).toBe('pending');
    expect(plan.summary).toBeNull();
    expect(plan.placedPieces).toEqual([]);
    expect(plan.unplacedPieces).toEqual([]);
  });

  it('consume el contrato del Cut Optimizer sin recalcular', () => {
    const optimization = {
      sheets: [{ index: 1 }],
      placedPieces: [{ id: 'p1', sheetIndex: 1 }],
      unplacedPieces: [{ id: 'p2', reason: 'too-large' }],
      summary: { requiredSheets: 1, utilization: 80, wasteArea: 2000 },
      validation: { isPhysicallyValid: false, warnings: ['No cabe por tamaño físico: p2.'] },
    };

    const plan = getFabricationCutPlan({ cutOptimization: optimization });

    expect(plan.status).toBe('ready');
    expect(plan.summary).toBe(optimization.summary);
    expect(plan.validation.warnings).toEqual(['No cabe por tamaño físico: p2.']);
    expect(plan.placedPieces).toBe(optimization.placedPieces);
    expect(plan.unplacedPieces).toBe(optimization.unplacedPieces);
  });
});
