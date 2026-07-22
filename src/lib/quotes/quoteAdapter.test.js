import { describe, expect, it } from 'vitest';
import {
  normalizeQuotePayload,
  normalizeQuoteStatus,
  quoteCommercialStatusOptions,
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
});
