import { describe, expect, it } from 'vitest';
import {
  RECEPTION_ERROR_CODES,
  RECEPTION_STATUSES,
  createReception,
  getReceptionAccumulatedQuantities,
  getReceptionStatus,
  normalizeLegacyReceptionRows,
  updateReception,
  validateReception,
} from './receptionEngine.js';

const now = '2026-07-30T18:00:00.000Z';
const purchase = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: '22222222-2222-4222-8222-222222222222',
  productionOrderId: '33333333-3333-4333-8333-333333333333',
  quoteId: '44444444-4444-4444-8444-444444444444',
  items: [{
    id: '55555555-5555-4555-8555-555555555555',
    quantity: 10,
    name: 'Perfil',
  }],
};

function reception({
  id = '66666666-6666-4666-8666-666666666666',
  accepted = 4,
  damaged = 0,
  rejected = 0,
  missing = 0,
  received = accepted + damaged + rejected + missing,
} = {}) {
  return createReception({
    id,
    workspaceId: purchase.workspaceId,
    purchaseId: purchase.id,
    productionOrderId: purchase.productionOrderId,
    quoteId: purchase.quoteId,
    receivedAt: now,
    receivedBy: '77777777-7777-4777-8777-777777777777',
    observations: '',
    evidence: [],
    createdAt: now,
    createdBy: '77777777-7777-4777-8777-777777777777',
    items: [{
      id: `${id.slice(0, -1)}8`,
      workspaceId: purchase.workspaceId,
      receptionId: id,
      purchaseId: purchase.id,
      purchaseItemId: purchase.items[0].id,
      receivedQuantity: received,
      acceptedQuantity: accepted,
      damagedQuantity: damaged,
      rejectedQuantity: rejected,
      missingQuantity: missing,
      observations: '',
      evidence: [],
      createdAt: now,
      updatedAt: now,
      createdBy: '77777777-7777-4777-8777-777777777777',
    }],
  }, { purchase });
}

describe('receptionEngine', () => {
  it('crea una recepción parcial ligada por UUID', () => {
    const result = reception();
    expect(result.error).toBeNull();
    expect(result.data.items[0].acceptedQuantity).toBe(4);
    expect(getReceptionStatus({
      purchase,
      receptions: [result.data],
    })).toBe(RECEPTION_STATUSES.PARTIAL);
  });

  it('deriva una recepción completa mediante múltiples eventos', () => {
    const first = reception({ accepted: 4 }).data;
    const second = reception({
      id: '88888888-8888-4888-8888-888888888888',
      accepted: 3,
      damaged: 1,
    }).data;
    const third = reception({
      id: '99999999-9999-4999-8999-999999999999',
      accepted: 3,
    }).data;
    const accumulated = getReceptionAccumulatedQuantities(
      [first, second, third],
      purchase.items[0].id,
    );
    expect(accumulated).toMatchObject({ accepted: 10, damaged: 1 });
    expect(getReceptionStatus({
      purchase,
      receptions: [first, second, third],
    })).toBe(RECEPTION_STATUSES.COMPLETE);
  });

  it('rechaza cantidades negativas e incoherentes', () => {
    const invalid = reception({ accepted: -1 });
    expect(invalid.error?.code).toBe(RECEPTION_ERROR_CODES.INVALID_QUANTITY);

    const over = reception({ accepted: 8, damaged: 3, received: 10 });
    expect(over.error?.code).toBe(RECEPTION_ERROR_CODES.INVALID_QUANTITY);
  });

  it('impide aceptar acumuladamente más de lo comprado', () => {
    const first = reception({ accepted: 8 }).data;
    const second = reception({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      accepted: 3,
    }).data;
    const validation = validateReception(second, {
      purchase,
      existingReceptions: [first],
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((item) => (
      item.code === RECEPTION_ERROR_CODES.OVER_RECEIPT
    ))).toBe(true);
  });

  it('bloquea mutaciones cuando Producción está Entregado', () => {
    const value = reception().data;
    const validation = validateReception(value, {
      purchase,
      productionOrder: { estado: 'Entregado' },
    });
    expect(validation.errors[0].code).toBe(RECEPTION_ERROR_CODES.READ_ONLY);
  });

  it('versiona con expectedVersion y preserva relaciones', () => {
    const current = reception().data;
    const updated = updateReception(current, {
      observations: 'Revisado',
    }, {
      expectedVersion: 1,
      changedAt: '2026-07-30T19:00:00.000Z',
      changedBy: '77777777-7777-4777-8777-777777777777',
      purchase,
    });
    expect(updated.error).toBeNull();
    expect(updated.data).toMatchObject({
      id: current.id,
      purchaseId: purchase.id,
      version: 2,
      observations: 'Revisado',
    });
    expect(updateReception(current, {}, {
      expectedVersion: 2,
      changedAt: now,
      changedBy: current.createdBy,
      purchase,
    }).error.code).toBe(RECEPTION_ERROR_CODES.VERSION_CONFLICT);
  });

  it('normaliza filas legacy sin convertir acumulados en fuente editable', () => {
    const migrated = normalizeLegacyReceptionRows({
      rows: {
        [purchase.items[0].id]: {
          status: 'recibido',
          observaciones: 'Correcto',
        },
      },
      purchase,
      receptionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      workspaceId: purchase.workspaceId,
      receivedAt: now,
      receivedBy: '77777777-7777-4777-8777-777777777777',
      itemIdFactory: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    expect(migrated.error).toBeNull();
    expect(migrated.data.items[0]).toMatchObject({
      purchaseItemId: purchase.items[0].id,
      acceptedQuantity: 10,
    });
  });

  it('no muta la compra ni las entradas', () => {
    const input = {
      ...reception().data,
      observations: 'Original',
    };
    const before = JSON.stringify({ input, purchase });
    validateReception(input, { purchase });
    expect(JSON.stringify({ input, purchase })).toBe(before);
  });
});
