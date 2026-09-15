import { describe, expect, it } from 'vitest';
import { validatePurchasedQuantityAmendment } from './purchaseAmendment.js';

describe('protección de cantidad comprada frente a recepción', () => {
  it('permite reducir sin recepción y hasta la cantidad aceptada', () => {
    expect(validatePurchasedQuantityAmendment({ currentPurchasedQuantity: 15, acceptedQuantity: 0, requestedPurchasedQuantity: 8 }).valid).toBe(true);
    expect(validatePurchasedQuantityAmendment({ currentPurchasedQuantity: 15, acceptedQuantity: 10, requestedPurchasedQuantity: 10 }).valid).toBe(true);
  });
  it('bloquea una reducción por debajo de lo aceptado antes de persistir', () => {
    const result = validatePurchasedQuantityAmendment({ currentPurchasedQuantity: 10, acceptedQuantity: 10, requestedPurchasedQuantity: 8 });
    expect(result).toMatchObject({ valid: false, reviewRequired: true, minimum: 10 });
    expect(result.message).toContain('Solicita una revisión administrativa');
  });
});
