import { describe, expect, it } from 'vitest';
import {
  historyItemToQuotePayload,
  normalizeQuotePayload,
  normalizeQuoteStatus,
  quoteCommercialStatusOptions,
  quoteRowToHistoryItem,
} from './quoteAdapter.js';

describe('estado comercial canónico de Cotización', () => {
  it('expone únicamente estados comerciales editables', () => {
    expect(quoteCommercialStatusOptions()).toEqual([
      'Borrador', 'Pendiente', 'Enviada', 'En revisión', 'Aceptada', 'Cancelada',
    ]);
  });

  it('normaliza estados operativos heredados como Aceptada', () => {
    expect(normalizeQuoteStatus('En fabricación')).toBe('Aceptada');
    expect(normalizeQuoteStatus('Instalación')).toBe('Aceptada');
    expect(normalizeQuoteStatus('Terminada')).toBe('Aceptada');
  });

  it('normaliza también payloads offline sin mutarlos', () => {
    const payload = {
      status: 'En fabricación',
      form_data: { estadoCotizacion: 'En fabricación', producto: 'Cocina' },
    };
    const snapshot = structuredClone(payload);
    const normalized = normalizeQuotePayload(payload);

    expect(normalized.status).toBe('Aceptada');
    expect(normalized.form_data.estadoCotizacion).toBe('Aceptada');
    expect(payload).toEqual(snapshot);
  });

  it('conserva identidad, workspace, folio, timestamps, borrado y versión en round trip', () => {
    const row = {
      id: '11111111-1111-4111-8111-111111111111', workspace_id: 'ws', folio: 'ALX-1',
      status: 'Pendiente', form_data: {}, version: 3,
      created_at: '2026-07-22T12:00:00Z', updated_at: '2026-07-22T13:00:00Z',
      deleted_at: '2026-07-23T12:00:00Z',
    };
    const local = quoteRowToHistoryItem(row);
    const payload = historyItemToQuotePayload(local);
    expect(local).toMatchObject({ id: row.id, workspaceId: 'ws', folio: 'ALX-1', version: 3 });
    expect(payload).toMatchObject({
      id: row.id, workspace_id: 'ws', folio: 'ALX-1', version: 3,
      deleted_at: '2026-07-23T12:00:00Z',
    });
  });
});
