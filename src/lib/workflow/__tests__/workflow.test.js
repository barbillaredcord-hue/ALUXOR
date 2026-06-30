import { describe, expect, it } from 'vitest';
import {
  getAvailableActions,
  getNextRecommendation,
  getProjectStage,
  getWarnings,
} from '../workflow.js';

const baseForm = {
  clienteTelefono: '8111111111',
  entrega: 'Viernes',
  producto: 'Clóset',
};

const quoteWithoutDeposit = {
  deposit: 0,
  materialRows: [],
  measureRows: [{ id: 'm1' }],
};

const quoteWithDeposit = {
  deposit: 500,
  materialRows: [{ id: 'mat1', nombre: 'Melamina' }],
  measureRows: [{ id: 'm1' }],
};

describe('workflow engine', () => {
  it('mantiene proyecto sin anticipo en cotizacion', () => {
    const context = { form: baseForm, quote: quoteWithoutDeposit };

    expect(getProjectStage(context)).toBe('Cotización');
    expect(getNextRecommendation(context)).toMatch(/anticipo/i);
    expect(getAvailableActions(context)).not.toContain('Crear orden de producción');
  });

  it('permite avanzar hacia produccion con anticipo', () => {
    const context = { form: baseForm, quote: quoteWithDeposit };

    expect(getProjectStage(context)).toBe('Producción');
    expect(getAvailableActions(context)).toContain('Crear orden de producción');
    expect(getNextRecommendation(context)).toMatch(/comprar|orden|compra/i);
  });

  it('advierte materiales pendientes y recomienda compras', () => {
    const context = { form: baseForm, quote: { ...quoteWithDeposit, materialRows: [] } };

    expect(getWarnings(context)).toContain('Material faltante');
    expect(getNextRecommendation(context)).toMatch(/materiales|compra/i);
  });

  it('recomienda recibir materiales cuando compras existen pero recepcion no', () => {
    const context = {
      form: baseForm,
      quote: quoteWithDeposit,
      workflow: { compraItems: [{ status: 'comprado' }], recepcionItems: [] },
    };

    expect(getNextRecommendation(context)).toMatch(/recibir|verificar/i);
  });

  it('habilita inventario y fabricacion con materiales recibidos', () => {
    const context = {
      form: baseForm,
      quote: quoteWithDeposit,
      workflow: { recepcionItems: [{ status: 'recibido' }] },
    };

    expect(getProjectStage(context)).toBe('Inventario');
    expect(getAvailableActions(context)).toContain('Actualizar inventario');
  });

  it('recomienda continuar fabricacion con checklist incompleto', () => {
    const context = {
      form: baseForm,
      quote: quoteWithDeposit,
      workflow: { inventarioCompleto: true, fabricacionChecklist: 60 },
    };

    expect(getProjectStage(context)).toBe('Fabricación');
    expect(getNextRecommendation(context)).toMatch(/continuar|checklist/i);
  });

  it('indica proyecto cerrado cuando entrega esta firmada', () => {
    const context = {
      form: baseForm,
      quote: quoteWithDeposit,
      workflow: { entregaFirmada: true, proyectoCerrado: true },
    };

    expect(getProjectStage(context)).toBe('Garantía');
    expect(getNextRecommendation(context)).toMatch(/cerrado|garant/i);
  });
});
