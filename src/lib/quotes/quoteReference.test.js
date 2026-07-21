import { describe, expect, it } from 'vitest';
import { quoteRowToHistoryItem } from './quoteAdapter.js';
import {
  findQuoteByReference,
  findQuoteByReferences,
  findQuoteForProductionOrder,
  normalizeQuoteReference,
  normalizeSharedProjectNote,
  productionOrderMatchesQuote,
  quoteReferencesFromProductionOrder,
  resolveSharedProjectNote,
} from './quoteReference.js';

describe('quoteReference', () => {
  it('normaliza números, strings y espacios sin alterar el identificador', () => {
    expect(normalizeQuoteReference(123)).toBe('123');
    expect(normalizeQuoteReference('  quote-ABC  ')).toBe('quote-ABC');
    expect(normalizeQuoteReference(null)).toBe('');
  });

  it('resuelve consecutivamente cotizaciones recientes, antiguas y recuperadas', () => {
    const quotes = [
      { id: 'remote-1', producto: 'Reciente' },
      { id: 42, producto: 'Antigua' },
      { id: 'legacy-local', quoteId: 'legacy-7', producto: 'Recuperada' },
    ];

    expect(findQuoteByReference(quotes, 'remote-1')?.producto).toBe('Reciente');
    expect(findQuoteByReference(quotes, ' 42 ')?.producto).toBe('Antigua');
    expect(findQuoteByReference(quotes, 'legacy-7')?.producto).toBe('Recuperada');
  });

  it('limita la compatibilidad legacy a campos de identificador conocidos', () => {
    expect(findQuoteByReference([{ quote_id: 'legacy-db' }], 'legacy-db')).toEqual({
      quote_id: 'legacy-db',
    });
    expect(findQuoteByReference([{ uuid: 'legacy-uuid' }], 'legacy-uuid')).toEqual({
      uuid: 'legacy-uuid',
    });
    expect(findQuoteByReference([{ id: 'remote-id', legacy_id: 'legacy-id' }], 'legacy-id')).toEqual({
      id: 'remote-id',
      legacy_id: 'legacy-id',
    });
    expect(findQuoteByReference([{ producto: '123' }], '123')).toBeNull();
  });

  it('obtiene referencias reales de OT actuales y heredadas sin usar texto ambiguo', () => {
    expect(quoteReferencesFromProductionOrder({
      quoteId: 123,
      quote_id: ' remote-id ',
      formSnapshot: { legacy_id: 'legacy-id', producto: 'No usar' },
    })).toEqual(['123', 'remote-id', 'legacy-id']);
    expect(quoteReferencesFromProductionOrder({ producto: 'remote-id' })).toEqual([]);
  });

  it('resuelve la primera cotización correspondiente a cualquiera de las referencias de la OT', () => {
    const quotes = [
      { id: 'remote-current', legacyId: 'legacy-original' },
      { id: 'other' },
    ];

    expect(findQuoteByReferences(quotes, ['missing', 'legacy-original'])).toBe(quotes[0]);
    expect(findQuoteByReferences(quotes, ['missing'])).toBeNull();
  });

  it('ofrece una resolución única para Summary y Ver cotización', () => {
    const order = {
      quoteId: 'missing-current',
      formSnapshot: { legacy_id: 'legacy-original' },
    };
    const quotes = [{ id: 'remote-current', legacyId: 'legacy-original' }];

    expect(findQuoteForProductionOrder(quotes, order)).toBe(quotes[0]);
    expect(findQuoteForProductionOrder(quotes, order)).toBe(
      findQuoteByReferences(quotes, quoteReferencesFromProductionOrder(order))
    );
  });

  it('conserva legacy_id al adaptar una cotización remota', () => {
    const historyItem = quoteRowToHistoryItem({
      id: 'remote-id',
      legacy_id: 'hist-123',
      form_data: {},
    });

    expect(historyItem.legacyId).toBe('hist-123');
    expect(findQuoteByReference([historyItem], 'hist-123')).toBe(historyItem);
  });

  it('devuelve null para referencias ausentes o entradas inválidas', () => {
    expect(findQuoteByReference([{ id: 'quote-1' }], 'quote-2')).toBeNull();
    expect(findQuoteByReference([{ id: 'quote-1' }], null)).toBeNull();
    expect(findQuoteByReference(null, 'quote-1')).toBeNull();
  });

  it('normaliza la nota compartida y evita escrituras cuando coincide', () => {
    expect(normalizeSharedProjectNote('  Nota común  ')).toBe('Nota común');
    expect(resolveSharedProjectNote({
      quoteNote: 'Nota común',
      productionNote: ' Nota común ',
    })).toMatchObject({
      value: 'Nota común',
      quoteNeedsUpdate: false,
      productionNeedsUpdate: false,
    });
  });

  it('no permite que un vacío borre una nota válida', () => {
    expect(resolveSharedProjectNote({ quoteNote: 'Válida', productionNote: '' }))
      .toMatchObject({ value: 'Válida', source: 'quote', productionNeedsUpdate: true });
    expect(resolveSharedProjectNote({ quoteNote: '', productionNote: 'Válida' }))
      .toMatchObject({ value: 'Válida', source: 'production', quoteNeedsUpdate: true });
  });

  it('elige el cambio más reciente cuando ambos valores son válidos', () => {
    expect(resolveSharedProjectNote({
      quoteNote: 'Cotización',
      productionNote: 'Producción',
      quoteUpdatedAt: '2026-07-20T10:00:00.000Z',
      productionUpdatedAt: '2026-07-20T11:00:00.000Z',
    }).value).toBe('Producción');
    expect(resolveSharedProjectNote({
      quoteNote: 'Cotización',
      productionNote: 'Producción',
      quoteUpdatedAt: '2026-07-20T12:00:00.000Z',
      productionUpdatedAt: '2026-07-20T11:00:00.000Z',
    }).value).toBe('Cotización');
  });

  it('reutiliza referencias heredadas al relacionar OT y cotización', () => {
    expect(productionOrderMatchesQuote(
      { formSnapshot: { legacy_id: 'quote-legacy' } },
      { id: 'quote-current', legacyId: 'quote-legacy' },
    )).toBe(true);
  });
});
