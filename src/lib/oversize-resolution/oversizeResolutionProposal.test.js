import { describe, expect, it } from 'vitest';
import { resolveOversizePiece } from './oversizeResolutionEngine.js';
import {
  applyOversizeResolutionProposal,
  createOversizeResolutionProposal,
  discardOversizeResolutionProposal,
  revertOversizeResolutionProposal,
} from './oversizeResolutionProposal.js';

function fixture() {
  const resolution = resolveOversizePiece({
    piece: {
      id: 'panel', nombre: 'Panel largo', ancho: 67, alto: 263, cantidad: 2,
      materialAssignments: [{ materialId: 'melamine' }],
    },
    sheet: {
      id: 'current', materialId: 'melamine', width: 122, height: 244, unit: 'cm',
    },
    config: {
      unit: 'cm', allowRotation: false, allowSplit: true, maxJoints: 1, kerf: 0.3,
    },
  });
  const alternative = resolution.alternatives.find((item) => item.type === 'balanced-split');
  const proposal = createOversizeResolutionProposal({
    resolution,
    alternativeId: alternative.id,
    createdAt: '2026-08-01T10:00:00.000Z',
  });
  const form = {
    measureItems: [{
      id: 'panel', nombre: 'Panel largo', ancho: 67, alto: 263, cantidad: 2,
      materialAssignments: [{ materialId: 'melamine' }],
    }],
  };
  return { resolution, proposal, form };
}

describe('oversize resolution proposal', () => {
  it('crea un contrato temporal draft estable y descarta sin mutar', () => {
    const { proposal } = fixture();
    const before = structuredClone(proposal);
    expect(proposal).toMatchObject({
      id: expect.stringContaining('oversize-proposal:panel:'),
      sourcePieceId: 'panel',
      alternativeType: 'balanced-split',
      createdAt: '2026-08-01T10:00:00.000Z',
      status: 'draft',
    });
    expect(discardOversizeResolutionProposal(proposal).status).toBe('discarded');
    expect(proposal).toEqual(before);
  });

  it('aplica dos secciones, conserva el original y no altera dimensiones terminadas', () => {
    const { proposal, form } = fixture();
    const before = structuredClone(form);
    const result = applyOversizeResolutionProposal(form, proposal);
    const original = result.form.measureItems.find((piece) => piece.id === 'panel');
    const sections = result.form.measureItems.filter((piece) => piece.sourcePieceId === 'panel');
    expect(result.applied).toBe(true);
    expect(original).toMatchObject({
      ancho: 67,
      alto: 263,
      cantidad: 2,
      optimizationExcluded: true,
      oversizeResolutionStatus: 'resolved',
    });
    expect(sections).toHaveLength(2);
    expect(sections.map((piece) => piece.alto)).toEqual([131.5, 131.5]);
    expect(sections.map((piece) => piece.sectionIndex)).toEqual([1, 2]);
    expect(sections.every((piece) => (
      piece.sectionCount === 2
      && piece.resolutionProposalId === proposal.id
      && piece.materialAssignments[0].materialId === 'melamine'
    ))).toBe(true);
    expect(result.selectedPieceIds).toEqual(sections.map((piece) => piece.id));
    expect(form).toEqual(before);
  });

  it('reaplicar no duplica secciones y revertir restaura identidad original', () => {
    const { proposal, form } = fixture();
    const first = applyOversizeResolutionProposal(form, proposal);
    const reapplied = applyOversizeResolutionProposal(first.form, {
      ...proposal,
      status: 'draft',
    });
    expect(reapplied.form.measureItems.filter((piece) => piece.sourcePieceId === 'panel'))
      .toHaveLength(2);
    const reverted = revertOversizeResolutionProposal(reapplied.form, reapplied.proposal);
    expect(reverted.reverted).toBe(true);
    expect(reverted.form.measureItems).toEqual([form.measureItems[0]]);
    expect(reverted.selectedPieceIds).toEqual(['panel']);
  });

  it('fabricación especial conserva y excluye el original sin generar secciones', () => {
    const { resolution, form } = fixture();
    const special = resolution.alternatives.find((item) => item.type === 'special-fabrication');
    const proposal = createOversizeResolutionProposal({
      resolution,
      alternativeId: special.id,
      createdAt: '2026-08-01T10:00:00.000Z',
    });
    const applied = applyOversizeResolutionProposal(form, proposal);
    expect(applied.form.measureItems).toHaveLength(1);
    expect(applied.form.measureItems[0]).toMatchObject({
      id: 'panel',
      optimizationExcluded: true,
      oversizeResolutionStatus: 'special-fabrication',
    });
  });

  it('un formato mayor conserva una sola pieza y permite revertir', () => {
    const resolution = resolveOversizePiece({
      piece: { id: 'panel', nombre: 'Panel largo', ancho: 67, alto: 263, cantidad: 1 },
      sheet: {
        id: 'current', materialId: 'melamine', width: 122, height: 244, unit: 'cm',
      },
      alternativeFormats: [{
        id: 'large', materialId: 'melamine', width: 152, height: 305,
        unit: 'cm', active: true,
      }],
      config: { unit: 'cm', allowRotation: false },
    });
    const larger = resolution.alternatives.find((item) => item.type === 'larger-format');
    const proposal = createOversizeResolutionProposal({
      resolution,
      alternativeId: larger.id,
      createdAt: '2026-08-01T10:00:00.000Z',
    });
    const form = {
      measureItems: [{ id: 'panel', nombre: 'Panel largo', ancho: 67, alto: 263, cantidad: 1 }],
    };
    const applied = applyOversizeResolutionProposal(form, proposal);
    expect(applied.form.measureItems).toHaveLength(1);
    expect(applied.form.measureItems[0]).toMatchObject({
      id: 'panel',
      optimizationExcluded: false,
      oversizeResolutionStatus: 'larger-format',
      resolutionOriginalSheetWidth: 122,
      resolutionOriginalSheetHeight: 244,
    });
    expect(revertOversizeResolutionProposal(applied.form, applied.proposal).form)
      .toEqual(form);
  });

  it('aplica cobertura modular, no duplica tiras y revierte la superficie original', () => {
    const resolution = resolveOversizePiece({
      piece: {
        id: 'lambrin', nombre: 'Lambrín', ancho: 67, alto: 263, cantidad: 1,
        materialAssignments: [{ materialId: 'lambrin-material' }],
      },
      sheet: {
        id: 'plank', materialId: 'lambrin-material', width: 16, height: 290, unit: 'cm',
      },
      config: {
        unit: 'cm', materialLayoutType: 'MODULAR_PLANK', installationOrientation: 'vertical',
      },
    });
    const modular = resolution.alternatives.find((item) => (
      item.type === 'modular-coverage-vertical'
    ));
    const proposal = createOversizeResolutionProposal({
      resolution,
      alternativeId: modular.id,
      createdAt: '2026-08-01T10:00:00.000Z',
    });
    const form = {
      measureItems: [{
        id: 'lambrin', nombre: 'Lambrín', ancho: 67, alto: 263, cantidad: 1,
        materialAssignments: [{ materialId: 'lambrin-material' }],
      }],
    };
    const first = applyOversizeResolutionProposal(form, proposal);
    const strips = first.form.measureItems.filter((piece) => piece.sourcePieceId === 'lambrin');
    expect(first.form.measureItems.find((piece) => piece.id === 'lambrin')).toMatchObject({
      optimizationExcluded: true,
      oversizeResolutionStatus: 'resolved',
    });
    expect(strips).toHaveLength(5);
    expect(strips.at(-1)).toMatchObject({
      stripIndex: 5,
      stripCount: 5,
      modularCoverage: true,
      finishedCoverageWidth: 3,
      grossCutWidth: 16,
      trimRequired: true,
      trimWidth: 13,
      installationOrientation: 'vertical',
      optimizationExcluded: false,
    });
    const reapplied = applyOversizeResolutionProposal(first.form, {
      ...proposal,
      status: 'draft',
    });
    expect(reapplied.form.measureItems.filter((piece) => piece.sourcePieceId === 'lambrin'))
      .toHaveLength(5);
    expect(revertOversizeResolutionProposal(reapplied.form, reapplied.proposal).form)
      .toEqual(form);
  });
});
