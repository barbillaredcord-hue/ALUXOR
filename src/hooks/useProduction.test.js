import { describe, expect, it } from 'vitest';
import { canAdvanceProductionOrder } from '../lib/production/productionEngine.js';
import {
  productionQuoteDeletionApplied,
  quoteCanGenerateProduction,
  quoteDeletionProductionChanges,
} from './useProduction.js';

describe('continuidad de Producción', () => {
  it('solo permite crear Producción desde una cotización Aceptada', () => {
    expect(quoteCanGenerateProduction('Aceptada')).toBe(true);
    ['Borrador', 'Pendiente', 'Enviada', 'En revisión', 'Cancelada'].forEach((status) => {
      expect(quoteCanGenerateProduction(status)).toBe(false);
    });
  });

  it('elimina lógicamente una OT sin actividad', () => {
    const changes = quoteDeletionProductionChanges(
      { timeline: [], observaciones: '' },
      false,
      '2026-07-22T12:00:00Z',
      'user-1',
    );
    expect(changes).toMatchObject({
      deletedAt: '2026-07-22T12:00:00.000Z',
      observaciones: 'Cotización original eliminada',
    });
    expect(changes.timeline.at(-1).evento).toBe('Orden desactivada');
  });

  it('rechaza y conserva una OT con actividad', () => {
    const changes = quoteDeletionProductionChanges(
      { timeline: [], observaciones: 'Trabajo iniciado' },
      true,
      '2026-07-22T12:00:00Z',
      'user-1',
    );
    expect(changes).not.toHaveProperty('deletedAt');
    expect(changes.estado).toBe('Rechazado');
    expect(changes.timeline.at(-1).evento).toBe('Orden rechazada');
  });

  it('una OT rechazada no puede avanzar a fabricación', () => {
    expect(canAdvanceProductionOrder({ estado: 'Rechazado', deletedAt: '' })).toBe(false);
    expect(canAdvanceProductionOrder({ estado: 'Fabricando', deletedAt: '' })).toBe(true);
  });

  it('la propagación reconoce un eco ya aplicado y evita ciclos', () => {
    expect(productionQuoteDeletionApplied({
      estado: 'Rechazado',
      observaciones: 'Cotización original eliminada',
    })).toBe(true);
    expect(productionQuoteDeletionApplied({ estado: 'Pendiente' })).toBe(false);
  });
});
