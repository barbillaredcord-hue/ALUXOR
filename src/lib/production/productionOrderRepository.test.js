import { describe, expect, it } from 'vitest';
import { ProductionOrderRepository } from './productionOrderRepository.js';

describe('ProductionOrderRepository identidad', () => {
  it('rechaza una creación sin UUID estable antes de escribir', async () => {
    const result = await ProductionOrderRepository.createProductionOrderRemote('ws', {
      id: 'production-legacy', quoteId: 'quote', folio: 'OT-1',
    });
    expect(result.error?.code).toBe('MISSING_STABLE_ENTITY_ID');
    expect(result.data).toBeNull();
  });
});
