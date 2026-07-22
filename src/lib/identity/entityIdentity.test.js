import { describe, expect, it } from 'vitest';
import {
  assertStableEntityId,
  detectDuplicateBusinessReferences,
  detectDuplicateIds,
  findEntityById,
  hasStableEntityId,
  indexEntitiesById,
  normalizeEntityId,
  preserveEntityIdentity,
  sameEntity,
} from './entityIdentity.js';

const ID_A = '31516012-1489-41d5-a78c-4ef92328e39d';
const ID_B = '11111111-2222-4333-8444-555555555555';

describe('contrato canónico de identidad', () => {
  it('reconoce y normaliza únicamente UUID estables', () => {
    expect(normalizeEntityId(`  ${ID_A} `)).toBe(ID_A);
    expect(hasStableEntityId({ id: ID_A })).toBe(true);
    expect(hasStableEntityId({ id: 'ALX-20260720-001' })).toBe(false);
    expect(() => assertStableEntityId({}, 'Cotización')).toThrow(/UUID estable/);
  });

  it('sameEntity compara UUID y nunca folio', () => {
    expect(sameEntity({ id: ID_A, folio: 'ALX-1' }, { id: ID_A, folio: 'ALX-2' })).toBe(true);
    expect(sameEntity({ id: ID_A, folio: 'ALX-1' }, { id: ID_B, folio: 'ALX-1' })).toBe(false);
  });

  it('preserva la identidad actual frente a un UUID entrante distinto', () => {
    const current = { id: ID_A, folio: 'ALX-1' };
    const incoming = { id: ID_B, folio: 'ALX-2' };
    expect(preserveEntityIdentity(current, incoming)).toEqual({ id: ID_A, folio: 'ALX-2' });
    expect(current.id).toBe(ID_A);
    expect(incoming.id).toBe(ID_B);
  });

  it('indexa y detecta duplicados de forma determinística', () => {
    const entities = [{ id: ID_A }, { id: ID_A }, { id: ID_B }];
    expect(findEntityById(entities, ID_B)).toBe(entities[2]);
    expect(indexEntitiesById(entities).size).toBe(2);
    expect(detectDuplicateIds(entities)[0].id).toBe(ID_A);
    expect(detectDuplicateBusinessReferences([
      { id: ID_A, workspaceId: 'ws', folio: 'ALX-1' },
      { id: ID_B, workspaceId: 'ws', folio: 'ALX-1' },
    ], (entity) => entity.folio)[0].reference).toBe('ALX-1');
  });
});
