import { describe, expect, it } from 'vitest';
import * as Quote from '../quote.js';
import {
  applyMaterialProposal,
  buildMaterialProposal,
  calculateMaterial,
  CALCULATION_TYPES,
} from '../../material-calculator/engine.js';

const helpers = {
  clean(value, fallback = '') {
    return value === undefined || value === null || value === '' ? fallback : String(value);
  },
  numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  },
  positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  percentValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  },
  money(value) {
    return `$${Number(value || 0).toFixed(2)}`;
  },
  decimal(value, digits = 2) {
    return Number(value || 0).toFixed(digits);
  },
};

const simpleQuote = {
  giro: 'Carpintería',
  materialCotizacion: 'Melamina',
  ancho: 180,
  alto: 240,
  fondo: 60,
  grosorMaterial: 16,
  cantidad: 1,
  precioM2: 650,
  costoMaterialM2: 400,
  merma: 10,
  margenMaterial: 35,
  herrajes: 'Bisagras',
  costoHerrajes: 100,
  precioHerrajes: 150,
  manoObra: 500,
  extras: 100,
  descuento: 5,
  anticipo: 50,
  materialItems: [{
    id: 'mat-1',
    nombre: 'Melamina blanca',
    tipoCompra: 'area',
    baseCalculo: 'medidas_area',
    costoUnitario: 400,
    precioUnitario: 650,
    merma: 10,
    margen: 35,
  }],
  accessoryItems: [{
    id: 'acc-1',
    nombre: 'Bisagras',
    tipoCompra: 'pieza',
    cantidad: 2,
    costoUnitario: 100,
    precioUnitario: 150,
    merma: 0,
    margen: 50,
  }],
};

function smartCutQuoteInput(overrides = {}) {
  const base = {
    giro: 'Carpintería',
    producto: 'Conjunto Smart Cut',
    margenMaterial: 0,
    manoObra: 0,
    extras: 0,
    descuento: 0,
    anticipo: 0,
    measureItems: [
      { id: 'first', nombre: 'Primera', ancho: 70, alto: 40, cantidad: 1 },
      { id: 'tall', nombre: 'Alta', ancho: 30, alto: 100, cantidad: 1 },
      { id: 'large', nombre: 'Grande', ancho: 70, alto: 60, cantidad: 1 },
    ],
    materialItems: [{
      id: 'mat-smart',
      nombre: 'MDF',
      tipoCompra: 'hoja',
      baseCalculo: 'medidas_area',
      ancho: 100,
      alto: 100,
      costoUnitario: 100,
      merma: 0,
      margen: 0,
      cutConfig: {
        strategy: 'input-order',
        allowRotation: false,
        kerf: 0,
        margins: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    }],
    accessoryItems: [],
  };
  return {
    ...base,
    ...overrides,
    materialItems: overrides.materialItems || base.materialItems,
    measureItems: overrides.measureItems || base.measureItems,
  };
}

describe('quote.js', () => {
  it('produce una cotizacion simple con total mayor a cero', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.total).toBeGreaterThan(0);
  });

  it('calcula saleTotal y costTotal de materiales', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.materialRows[0].costTotal).toBeGreaterThan(0);
    expect(quote.materialRows[0].saleTotal).toBeGreaterThan(0);
  });

  it('calcula saleTotal y costTotal de accesorios', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.accessoryRows[0].costTotal).toBe(200);
    expect(quote.accessoryRows[0].saleTotal).toBe(300);
  });

  it('calcula total como subtotal menos descuento', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.total).toBeCloseTo(quote.subtotal - quote.discountAmount);
  });

  it('calcula deposit + rest igual a total', () => {
    const quote = Quote.calculateQuote(simpleQuote, helpers);
    expect(quote.deposit + quote.rest).toBeCloseTo(quote.total);
  });

  it('calcula escritorio industrial con melamina por hoja', () => {
    const quote = Quote.calculateQuote({
      giro: 'Carpintería',
      producto: 'Escritorio industrial',
      cantidad: 1,
      ancho: 96,
      alto: 60,
      fondo: 60,
      grosorMaterial: 18,
      merma: 0,
      margenMaterial: 100,
      manoObra: 800,
      extras: 0,
      descuento: 0,
      anticipo: 50,
      materialItems: [{
        id: 'mat-melamina',
        nombre: 'Melamina',
        tipoCompra: 'hoja',
        baseCalculo: 'medidas_area',
        ancho: 122,
        alto: 244,
        cantidad: 1,
        costoUnitario: 1334,
        merma: 0,
        margen: 100,
      }],
      accessoryItems: [],
    }, helpers);

    expect(quote.areaTotal).toBeCloseTo(0.576);
    expect(quote.materialRows[0].areaHoja).toBeCloseTo(2.9768);
    expect(quote.materialRows[0].hojasNecesarias).toBe(1);
    expect(quote.materialRows[0].costTotal).toBe(1334);
    expect(quote.materialRows[0].saleTotal).toBe(2668);
    expect(quote.manoObra).toBe(800);
    expect(quote.subtotal).toBe(3468);
    expect(quote.total).toBe(3468);
    expect(quote.internalTotal).toBe(1334);
    expect(quote.profit).toBe(2134);
    expect(quote.deposit).toBe(1734);
    expect(quote.rest).toBe(1734);
  });

  it('usa hojas del Cut Optimizer para cambiar costo de material', () => {
    const quote = Quote.calculateQuote({
      giro: 'Carpintería',
      producto: 'Cubiertas',
      cantidad: 2,
      ancho: 70,
      alto: 70,
      fondo: 60,
      grosorMaterial: 18,
      merma: 0,
      margenMaterial: 0,
      manoObra: 0,
      extras: 0,
      descuento: 0,
      anticipo: 0,
      measureItems: [{
        id: 'med-1',
        nombre: 'Cubierta',
        ancho: 70,
        alto: 70,
        fondo: 60,
        grosorMaterial: 18,
        cantidad: 2,
      }],
      materialItems: [{
        id: 'mat-1',
        nombre: 'MDF',
        tipoCompra: 'hoja',
        baseCalculo: 'medidas_area',
        ancho: 100,
        alto: 100,
        costoUnitario: 100,
        merma: 0,
        margen: 0,
      }],
      accessoryItems: [],
    }, helpers);

    expect(quote.materialRows[0].cutOptimization.summary.requiredSheets).toBe(2);
    expect(quote.materialRows[0].optimizationSummary.requiredSheets).toBe(2);
    expect(quote.materialRows[0].optimizationStatus).toBe('optimized');
    expect(quote.materialRows[0].optimizationLabel).toContain('Costo basado en 2 hoja(s) optimizadas');
    expect(quote.materialRows[0].hojasNecesarias).toBe(2);
    expect(quote.materialRows[0].costTotal).toBe(200);
    expect(quote.internalMaterialCost).toBe(200);
  });

  it('marca material por hoja como pendiente si no hay optimizacion valida', () => {
    const quote = Quote.calculateQuote({
      giro: 'Carpintería',
      producto: 'Material incompleto',
      cantidad: 1,
      ancho: 70,
      alto: 70,
      margenMaterial: 0,
      manoObra: 0,
      extras: 0,
      descuento: 0,
      anticipo: 0,
      materialItems: [{
        id: 'mat-pending',
        nombre: 'MDF',
        tipoCompra: 'hoja',
        baseCalculo: 'medidas_area',
        ancho: 0,
        alto: 0,
        costoUnitario: 100,
        merma: 0,
        margen: 0,
      }],
      accessoryItems: [],
    }, helpers);

    expect(quote.materialRows[0].cutOptimization).toBeNull();
    expect(quote.materialRows[0].optimizationSummary).toBeNull();
    expect(quote.materialRows[0].optimizationStatus).toBe('pending');
    expect(quote.materialRows[0].optimizationLabel).toBe('Pendiente de optimizar.');
  });

  it('mantiene Legacy como predeterminado y conserva su costo actual', () => {
    const quote = Quote.calculateQuote(smartCutQuoteInput(), helpers);
    const material = quote.materialRows[0];

    expect(material.optimization).toMatchObject({
      mode: 'legacy',
      activeCandidateId: null,
      proposalId: null,
      engineVersion: null,
      status: 'valid',
    });
    expect(material.optimization.inputSignature)
      .toMatch(/^quote-cut-input-v1-[0-9a-f]{8}$/);
    const shelf = material.cutOptimization.candidates
      .find((candidate) => candidate.strategy === 'shelf');
    expect(material.cutOptimization.sheets).toBe(shelf.sheets);
    expect(material.hojasNecesarias).toBe(2);
    expect(material.costTotal).toBe(200);
  });

  it('usa el summary del candidato Smart Cut activo con las mismas reglas de costo', () => {
    const input = smartCutQuoteInput();
    const legacy = Quote.calculateQuote(input, helpers);
    const bestFit = legacy.materialRows[0].cutOptimization.candidates
      .find((candidate) => candidate.strategy === 'best-fit');
    const activeInput = smartCutQuoteInput({
      materialItems: [{
        ...input.materialItems[0],
        optimization: {
          mode: 'smart-cut',
          activeCandidateId: bestFit.id,
          proposalId: 'proposal-best-fit',
          engineVersion: bestFit.metadata.contractVersion,
          inputSignature: legacy.materialRows[0].optimization.inputSignature,
          status: 'valid',
        },
      }],
    });
    const active = Quote.calculateQuote(activeInput, helpers);
    const material = active.materialRows[0];

    expect(material.optimization.status).toBe('valid');
    expect(material.cutOptimization.id).toBe(bestFit.id);
    expect(material.cutOptimization.strategy).toBe('best-fit');
    expect(material.optimizationSummary).toEqual(bestFit.summary);
    expect(material.hojasNecesarias).toBe(1);
    expect(material.costTotal).toBe(
      material.hojasNecesarias * input.materialItems[0].costoUnitario,
    );
    expect(legacy.materialRows[0].costTotal).toBe(
      legacy.materialRows[0].hojasNecesarias * input.materialItems[0].costoUnitario,
    );
  });

  it('aplica desde Material Studio el Best Fit seleccionado y conserva la sesión activa', () => {
    const input = smartCutQuoteInput();
    const calculation = calculateMaterial({
      type: CALCULATION_TYPES.SHEET,
      pieces: input.measureItems,
      selectedPieceIds: input.measureItems.map((piece) => piece.id),
      unit: 'cm',
      formatWidth: 100,
      formatHeight: 100,
      wastePercent: 0,
      marginPercent: 0,
      price: 100,
      allowRotation: false,
      kerf: 0,
      strategy: 'input-order',
      optimize: true,
    });
    const bestFit = calculation.optimization.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const form = {
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        optimization: { activeSessionId: 'session-existing' },
      }],
    };
    const proposal = buildMaterialProposal({
      form,
      material: form.materialItems[0],
      calculation: {
        ...calculation,
        optimization: {
          ...calculation.optimization,
          selectedCandidateId: bestFit.id,
          selectedCandidate: bestFit,
        },
      },
      selectedPieceIds: input.measureItems.map((piece) => piece.id),
    });
    const applied = applyMaterialProposal(form, proposal);
    const quote = Quote.calculateQuote(applied.form, helpers);
    const material = quote.materialRows[0];

    expect(material.optimization).toMatchObject({
      mode: 'smart-cut',
      status: 'valid',
      activeCandidateId: bestFit.id,
      activeSessionId: 'session-existing',
      inputSignature: calculation.optimization.inputSignature,
    });
    expect(material.cutOptimization.id).toBe(bestFit.id);
    expect(material.cutOptimization.strategy).toBe('best-fit');
    expect(material.hojasNecesarias).toBe(1);
    expect(material.optimizationSummary.utilization)
      .toBe(bestFit.summary.utilization);
  });

  it.each([
    ['piezas', (input) => ({
      ...input,
      measureItems: input.measureItems.map((piece, index) => (
        index === 0 ? { ...piece, cantidad: 2 } : piece
      )),
    })],
    ['dimensiones', (input) => ({
      ...input,
      measureItems: input.measureItems.map((piece, index) => (
        index === 0 ? { ...piece, ancho: 69 } : piece
      )),
    })],
    ['configuración', (input) => ({
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        cutConfig: { ...input.materialItems[0].cutConfig, allowRotation: true },
      }],
    })],
    ['orden de estrategia', (input) => ({
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        cutConfig: { ...input.materialItems[0].cutConfig, strategy: 'largest-first' },
      }],
    })],
    ['kerf', (input) => ({
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        cutConfig: { ...input.materialItems[0].cutConfig, kerf: 0.3 },
      }],
    })],
    ['márgenes', (input) => ({
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        cutConfig: {
          ...input.materialItems[0].cutConfig,
          margins: { top: 1, right: 0, bottom: 0, left: 0 },
        },
      }],
    })],
    ['regiones', (input) => ({
      ...input,
      materialItems: [{
        ...input.materialItems[0],
        cutConfig: {
          ...input.materialItems[0].cutConfig,
          blockedRegions: [{ id: 'damage', x: 90, y: 90, width: 5, height: 5 }],
        },
      }],
    })],
  ])('marca obsolete y vuelve a Legacy cuando cambian %s', (_label, change) => {
    const initial = smartCutQuoteInput();
    const firstQuote = Quote.calculateQuote(initial, helpers);
    const bestFit = firstQuote.materialRows[0].cutOptimization.candidates
      .find((candidate) => candidate.strategy === 'best-fit');
    const activeInput = smartCutQuoteInput({
      materialItems: [{
        ...initial.materialItems[0],
        optimization: {
          mode: 'smart-cut',
          activeCandidateId: bestFit.id,
          proposalId: 'proposal-best-fit',
          engineVersion: 1,
          inputSignature: firstQuote.materialRows[0].optimization.inputSignature,
          status: 'valid',
        },
      }],
    });
    const changed = change(activeInput);
    const quote = Quote.calculateQuote(changed, helpers);
    const material = quote.materialRows[0];

    expect(material.optimization.status).toBe('obsolete');
    const shelf = material.cutOptimization.candidates
      .find((candidate) => candidate.strategy === 'shelf');
    expect(material.cutOptimization.sheets).toBe(shelf.sheets);
    expect(material.cutOptimization.id).toBeUndefined();
    expect(material.optimization.activeCandidateId).toBe(bestFit.id);
    expect(material.costTotal).toBe(
      material.hojasNecesarias * changed.materialItems[0].costoUnitario,
    );
  });

  it('es determinista en Legacy y Smart Cut activo', () => {
    const input = smartCutQuoteInput();
    const legacy = Quote.calculateQuote(input, helpers);
    const candidate = legacy.materialRows[0].cutOptimization.candidates[1];
    const activeInput = smartCutQuoteInput({
      materialItems: [{
        ...input.materialItems[0],
        optimization: {
          mode: 'smart-cut',
          activeCandidateId: candidate.id,
          proposalId: 'proposal-1',
          engineVersion: 1,
          inputSignature: legacy.materialRows[0].optimization.inputSignature,
          status: 'valid',
        },
      }],
    });

    expect(Quote.calculateQuote(input, helpers))
      .toEqual(Quote.calculateQuote(input, helpers));
    expect(Quote.calculateQuote(activeInput, helpers))
      .toEqual(Quote.calculateQuote(activeInput, helpers));
  });

  it('mantiene costos idénticos cuando Legacy y Smart Cut requieren las mismas hojas', () => {
    const input = smartCutQuoteInput({
      measureItems: [{ id: 'single', nombre: 'Panel', ancho: 40, alto: 40, cantidad: 1 }],
    });
    const legacy = Quote.calculateQuote(input, helpers);
    const bestFit = legacy.materialRows[0].cutOptimization.candidates
      .find((candidate) => candidate.strategy === 'best-fit');
    const active = Quote.calculateQuote(smartCutQuoteInput({
      measureItems: input.measureItems,
      materialItems: [{
        ...input.materialItems[0],
        optimization: {
          mode: 'smart-cut',
          activeCandidateId: bestFit.id,
          proposalId: 'proposal-equal-cost',
          engineVersion: 1,
          inputSignature: legacy.materialRows[0].optimization.inputSignature,
          status: 'valid',
        },
      }],
    }), helpers);

    expect(legacy.materialRows[0].hojasNecesarias)
      .toBe(active.materialRows[0].hojasNecesarias);
    expect(legacy.materialRows[0].costTotal)
      .toBe(active.materialRows[0].costTotal);
  });

  it('conserva conjuntos y asignaciones opcionales sin romper medidas legacy', () => {
    const legacy = Quote.normalizeMeasureItem({
      id: 'legacy',
      nombre: 'Puerta',
      ancho: 45,
      alto: 70,
      cantidad: 1,
    }, 0, {}, helpers);
    const assigned = Quote.normalizeMeasureItem({
      ...legacy,
      groupId: 'group-1',
      materialAssignments: [
        'mat-a',
        { materialId: 'mat-a' },
        { materialId: 'mat-b', usage: 'respaldo' },
      ],
    }, 0, {}, helpers);

    expect(legacy).not.toHaveProperty('groupId');
    expect(legacy).not.toHaveProperty('materialAssignments');
    expect(assigned).toMatchObject({
      groupId: 'group-1',
      materialAssignments: [
        { materialId: 'mat-a' },
        { materialId: 'mat-b', usage: 'respaldo' },
      ],
    });
    expect(Quote.pieceGroupsFromForm({
      pieceGroups: [{ id: 'group-1', name: 'Mueble bajo' }],
    }, helpers)).toEqual([{ id: 'group-1', name: 'Mueble bajo' }]);
  });

  it('calcula cada material únicamente con sus piezas asignadas', () => {
    const quote = Quote.calculateQuote({
      giro: 'Carpintería',
      measureItems: [
        {
          id: 'costado',
          nombre: 'Costado',
          ancho: 50,
          alto: 100,
          cantidad: 2,
          groupId: 'mueble-bajo',
          materialAssignments: [{ materialId: 'melamina' }],
        },
        {
          id: 'respaldo',
          nombre: 'Respaldo',
          ancho: 50,
          alto: 100,
          cantidad: 1,
          groupId: 'mueble-bajo',
          materialAssignments: [{ materialId: 'mdf' }],
        },
      ],
      pieceGroups: [{ id: 'mueble-bajo', name: 'Mueble bajo' }],
      materialItems: [
        {
          id: 'melamina',
          nombre: 'Melamina',
          tipoCompra: 'area',
          baseCalculo: 'medidas_area',
          costoUnitario: 100,
          margen: 0,
          merma: 0,
        },
        {
          id: 'mdf',
          nombre: 'MDF',
          tipoCompra: 'area',
          baseCalculo: 'medidas_area',
          costoUnitario: 50,
          margen: 0,
          merma: 0,
        },
      ],
      accessoryItems: [],
    }, helpers);

    expect(quote.materialRows[0]).toMatchObject({
      id: 'melamina',
      rowQuantity: 1,
      assignedPieceIds: ['costado'],
      costTotal: 100,
    });
    expect(quote.materialRows[1]).toMatchObject({
      id: 'mdf',
      rowQuantity: 0.5,
      assignedPieceIds: ['respaldo'],
      costTotal: 25,
    });
  });
});
