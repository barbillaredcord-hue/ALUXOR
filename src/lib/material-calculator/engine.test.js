import { describe, expect, it } from 'vitest';
import {
  CALCULATION_TYPES,
  applyMaterialProposal,
  buildMaterialProposal,
  calculateMaterial,
  convertLength,
  pieceIdsForGroups,
  pieceIdsForMaterial,
} from './engine.js';

const pieces = [
  {
    id: 'left',
    nombre: 'Costado izquierdo',
    groupId: 'base',
    ancho: 50,
    alto: 100,
    cantidad: 2,
    materialAssignments: [{ materialId: 'melamine' }],
  },
  {
    id: 'back',
    nombre: 'Respaldo',
    groupId: 'base',
    ancho: 50,
    alto: 100,
    cantidad: 1,
    materialAssignments: [{ materialId: 'mdf' }],
  },
  {
    id: 'door',
    nombre: 'Puerta',
    groupId: 'upper',
    ancho: 40,
    alto: 70,
    cantidad: 2,
    materialAssignments: [],
  },
];

describe('material calculator engine', () => {
  it('convierte mm, cm y m sin mezclar unidades', () => {
    expect(convertLength(1000, 'mm', 'm')).toBe(1);
    expect(convertLength(100, 'cm', 'm')).toBe(1);
    expect(convertLength(1, 'm', 'cm')).toBe(100);
    expect(convertLength(10, 'invalid', 'cm')).toBeNull();
  });

  it('selecciona parcialmente por conjunto y material', () => {
    expect(pieceIdsForGroups(pieces, ['base'])).toEqual(['left', 'back']);
    expect(pieceIdsForMaterial(pieces, 'melamine')).toEqual(['left']);
  });

  it('calcula área, cantidad, merma, hojas, costo, sobrante y aprovechamiento', () => {
    const result = calculateMaterial({
      type: CALCULATION_TYPES.SHEET,
      pieces,
      selectedPieceIds: ['left'],
      unit: 'cm',
      formatWidth: 100,
      formatHeight: 100,
      wastePercent: 10,
      price: 500,
      marginPercent: 35,
      allowRotation: true,
    });

    expect(result.status).toBe('calculated');
    expect(result.selectedRows).toBe(1);
    expect(result.pieceCount).toBe(2);
    expect(result.netArea).toBe(1);
    expect(result.areaWithWaste).toBeCloseTo(1.1);
    expect(result.theoreticalSheets).toBeCloseTo(1.1);
    expect(result.commercialSheets).toBe(2);
    expect(result.cost).toBe(1000);
    expect(result.marginPercent).toBe(35);
    expect(result.proposedPrice).toBe(1350);
    expect(result.estimatedWaste).toBeCloseTo(0.9);
    expect(result.utilization).toBeCloseTo(55);
  });

  it('calcula barras necesarias y costo comercial', () => {
    const result = calculateMaterial({
      type: CALCULATION_TYPES.LINEAR,
      pieces,
      selectedPieceIds: ['door'],
      unit: 'cm',
      barLength: 300,
      wastePercent: 10,
      price: 200,
    });

    expect(result.netLength).toBeCloseTo(1.4);
    expect(result.lengthWithWaste).toBeCloseTo(1.54);
    expect(result.barsNeeded).toBe(1);
    expect(result.cost).toBe(200);
    expect(result.estimatedWaste).toBeCloseTo(1.6);
  });

  it('calcula vidrio, superficie y herrajes con las mismas piezas', () => {
    const glass = calculateMaterial({
      type: CALCULATION_TYPES.GLASS,
      pieces,
      selectedPieceIds: ['door'],
      unit: 'cm',
      wastePercent: 5,
      price: 1000,
      treatment: 'Templado',
    });
    const hardware = calculateMaterial({
      type: CALCULATION_TYPES.HARDWARE,
      pieces,
      selectedPieceIds: ['door'],
      unit: 'cm',
      wastePercent: 0,
      price: 50,
      quantityPerPiece: 2,
      reserveQuantity: 1,
    });

    expect(glass.netArea).toBeCloseTo(0.56);
    expect(glass.cost).toBeCloseTo(588);
    expect(glass.treatment).toBe('Templado');
    expect(hardware.requiredQuantity).toBe(4);
    expect(hardware.purchaseQuantity).toBe(5);
    expect(hardware.cost).toBe(250);
  });

  it('advierte una pieza mayor que la hoja e integra solo la selección al optimizer', () => {
    const result = calculateMaterial({
      type: CALCULATION_TYPES.SHEET,
      pieces,
      selectedPieceIds: ['left'],
      unit: 'cm',
      formatWidth: 80,
      formatHeight: 80,
      wastePercent: 0,
      price: 100,
      allowRotation: false,
      optimize: true,
    });

    expect(result.warnings.some((warning) => warning.includes('Costado izquierdo'))).toBe(true);
    expect(result.optimization.unplacedPieces).toHaveLength(2);
    expect(result.optimization.unplacedPieces.every((piece) => (
      piece.name === 'Costado izquierdo'
    ))).toBe(true);
  });

  it('rechaza campos inválidos con mensajes de negocio', () => {
    const result = calculateMaterial({
      type: CALCULATION_TYPES.SHEET,
      pieces: [{ id: 'invalid', nombre: 'Puerta', ancho: 0, alto: -1, cantidad: 0 }],
      selectedPieceIds: ['invalid'],
      unit: 'cm',
      formatWidth: 0,
      formatHeight: 0,
      wastePercent: -1,
      price: -10,
    });

    expect(result.status).toBe('invalid');
    expect(result.errors).toContain('Ingresa el ancho de Puerta.');
    expect(result.errors).toContain('El alto de Puerta debe ser mayor que cero.');
    expect(result.errors).toContain('La cantidad de Puerta debe ser mayor que cero.');
    expect(result.errors).toContain('La merma no puede ser negativa.');
    expect(result.errors).toContain('El precio no puede ser negativo.');
  });

  it('no modifica piezas no seleccionadas ni sobrescribe materiales sin confirmación', () => {
    const form = {
      measureItems: pieces,
      materialItems: [{ id: 'mdf', nombre: 'MDF' }],
    };
    const proposal = buildMaterialProposal({
      form,
      material: { id: 'melamine', nombre: 'Melamina nogal' },
      calculation: { type: CALCULATION_TYPES.SHEET },
      selectedPieceIds: ['back'],
    });

    expect(proposal.requiresConfirmation).toBe(true);
    expect(applyMaterialProposal(form, proposal).applied).toBe(false);

    const applied = applyMaterialProposal(form, proposal, { replace: true });
    expect(applied.applied).toBe(true);
    expect(applied.form.measureItems.find((piece) => piece.id === 'back').materialAssignments)
      .toEqual([{ materialId: 'melamine', kind: 'material' }]);
    expect(applied.form.measureItems.find((piece) => piece.id === 'left'))
      .toEqual(pieces[0]);
    expect(applied.form.materialItems.map((item) => item.id))
      .toEqual(['mdf', 'melamine']);
  });

  it('asigna herrajes sin reemplazar el material principal de la pieza', () => {
    const form = {
      measureItems: [pieces[0]],
      materialItems: [{ id: 'melamine', nombre: 'Melamina' }],
      accessoryItems: [],
    };
    const proposal = buildMaterialProposal({
      form,
      material: { id: 'hinge', nombre: 'Bisagra', cantidad: 3, costoUnitario: 50 },
      calculation: { type: CALCULATION_TYPES.HARDWARE },
      selectedPieceIds: ['left'],
    });
    const applied = applyMaterialProposal(form, proposal);

    expect(proposal.requiresConfirmation).toBe(false);
    expect(applied.form.measureItems[0].materialAssignments).toEqual([
      { materialId: 'melamine' },
      { materialId: 'hinge', kind: 'hardware' },
    ]);
    expect(applied.form.accessoryItems).toEqual([
      expect.objectContaining({ id: 'hinge', nombre: 'Bisagra' }),
    ]);
    expect(applied.form.materialItems).toEqual(form.materialItems);
  });

  it('conserva herrajes al confirmar el reemplazo del material principal', () => {
    const form = {
      measureItems: [{
        id: 'door',
        nombre: 'Puerta',
        materialAssignments: [
          { materialId: 'melamine', kind: 'material' },
          { materialId: 'hinge', kind: 'hardware' },
        ],
      }],
      materialItems: [{ id: 'melamine', nombre: 'Melamina' }],
    };
    const proposal = buildMaterialProposal({
      form,
      material: { id: 'mdf', nombre: 'MDF' },
      calculation: { type: CALCULATION_TYPES.SHEET },
      selectedPieceIds: ['door'],
    });

    const applied = applyMaterialProposal(form, proposal, { replace: true });

    expect(applied.form.measureItems[0].materialAssignments).toEqual([
      { materialId: 'hinge', kind: 'hardware' },
      { materialId: 'mdf', kind: 'material' },
    ]);
  });

  it('actualiza el mismo material y selección sin duplicar la línea', () => {
    const form = {
      measureItems: [pieces[0]],
      materialItems: [{ id: 'melamine', nombre: 'Melamina', costoUnitario: 100 }],
    };
    const proposal = buildMaterialProposal({
      form,
      material: { id: 'new-id', nombre: 'Melamina', costoUnitario: 120 },
      calculation: { type: CALCULATION_TYPES.SHEET },
      selectedPieceIds: ['left'],
    });
    const applied = applyMaterialProposal(form, proposal);

    expect(proposal.materialId).toBe('melamine');
    expect(applied.form.materialItems).toHaveLength(1);
    expect(applied.form.materialItems[0]).toMatchObject({
      id: 'melamine',
      costoUnitario: 120,
    });
  });

  it('persiste solo el snapshot compacto del candidato y conserva activeSessionId', () => {
    const selectedPieces = [
      { id: 'first', nombre: 'Primera', ancho: 70, alto: 40, cantidad: 1 },
      { id: 'tall', nombre: 'Alta', ancho: 30, alto: 100, cantidad: 1 },
      { id: 'large', nombre: 'Grande', ancho: 70, alto: 60, cantidad: 1 },
    ];
    const calculation = calculateMaterial({
      type: CALCULATION_TYPES.SHEET,
      pieces: selectedPieces,
      selectedPieceIds: selectedPieces.map((piece) => piece.id),
      unit: 'cm',
      formatWidth: 100,
      formatHeight: 100,
      wastePercent: 0,
      price: 100,
      allowRotation: false,
      kerf: 0,
      strategy: 'input-order',
      optimize: true,
    });
    const bestFit = calculation.optimization.candidates.find(
      (candidate) => candidate.strategy === 'best-fit',
    );
    const effectiveCalculation = {
      ...calculation,
      optimization: {
        ...calculation.optimization,
        selectedCandidateId: bestFit.id,
        selectedCandidate: bestFit,
      },
    };
    const form = {
      measureItems: selectedPieces,
      materialItems: [{
        id: 'melamine',
        nombre: 'Melamina',
        optimization: {
          mode: 'legacy',
          status: 'valid',
          activeSessionId: 'session-existing',
        },
      }],
    };
    const proposal = buildMaterialProposal({
      form,
      material: {
        ...form.materialItems[0],
        ancho: 100,
        alto: 100,
      },
      calculation: effectiveCalculation,
      selectedPieceIds: selectedPieces.map((piece) => piece.id),
    });
    const applied = applyMaterialProposal(form, proposal);
    const optimization = applied.form.materialItems[0].optimization;

    expect(optimization).toMatchObject({
      mode: 'smart-cut',
      activeCandidateId: bestFit.id,
      status: 'valid',
      activeSessionId: 'session-existing',
      candidateSnapshot: {
        candidateId: bestFit.id,
        recommendedCandidateId: calculation.optimization.recommendedCandidateId,
        strategy: 'best-fit',
        sheetsRequired: 1,
        utilization: bestFit.summary.utilization,
        inputSignature: calculation.optimization.inputSignature,
        candidateSignature: bestFit.id,
      },
    });
    expect(proposal.materialItem.cutConfig).toEqual({
      allowRotation: false,
      kerf: 0,
      strategy: 'input-order',
    });
    const serialized = JSON.stringify(optimization);
    expect(serialized).not.toContain('"sheets"');
    expect(serialized).not.toContain('"placedPieces"');
    expect(serialized).not.toContain('"unplacedPieces"');
    expect(calculation.optimization.candidates[0].sheets).toBeDefined();
  });
});
