import { describe, expect, it } from 'vitest';
import { applyQuoteMaterialOptimization } from '../br-engine/quote.js';
import { createSmartCutProposal } from './proposal.js';
import { applySmartCutProposal } from './proposal-transaction.js';
import {
  PROPOSAL_VALIDATION_CODES,
  validateCandidateSelection,
  validateSmartCutProposal,
} from './proposal-validator.js';

function createCandidate(overrides = {}) {
  const pieces = [
    {
      id: 'piece-a-1',
      sourceId: 'piece-a',
      name: 'Costado',
      x: 0,
      y: 0,
      width: 40,
      height: 80,
      rotated: false,
      sheetIndex: 1,
    },
    {
      id: 'piece-b-1',
      sourceId: 'piece-b',
      name: 'Repisa',
      x: 40.3,
      y: 0,
      width: 50,
      height: 30,
      rotated: true,
      sheetIndex: 1,
    },
  ];
  return {
    id: 'best-fit-contract',
    strategy: 'best-fit',
    sheets: [{
      index: 1,
      width: 100,
      height: 100,
      pieces,
      wasteArea: 5300,
      efficiencyPercent: 47,
    }],
    placedPieces: pieces,
    unplacedPieces: [],
    diagnostics: [],
    summary: {
      requiredSheets: 1,
      totalSheetArea: 10000,
      usedArea: 4700,
      wasteArea: 5300,
      utilization: 47,
      totalPieceCount: 2,
      placedPieceCount: 2,
      unplacedPieceCount: 0,
    },
    validation: {
      isPhysicallyValid: true,
      warnings: [],
      errors: [],
      diagnostics: [],
    },
    evaluation: {
      eligible: true,
      rank: 1,
      reasons: ['Todas las piezas fueron colocadas.'],
    },
    valid: true,
    complete: true,
    metadata: { contractVersion: 1 },
    ...overrides,
  };
}

function createQuote() {
  return {
    id: 'quote-1',
    total: 3200,
    legacyField: 'preservado',
    materialRows: [
      {
        id: 'material-1',
        nombre: 'Melamina nogal',
        costTotal: 1800,
        saleTotal: 2500,
        hojasNecesarias: 2,
        optimizationStatus: 'optimized',
        optimizationLabel: 'Solución Shelf actual.',
        optimizationSummary: {
          requiredSheets: 2,
          wasteArea: 9100,
          utilization: 35,
          placedPieceCount: 2,
          unplacedPieceCount: 0,
        },
        cutOptimization: {
          id: 'shelf-contract',
          strategy: 'shelf',
          summary: {
            requiredSheets: 2,
            wasteArea: 9100,
            utilization: 35,
            placedPieceCount: 2,
            unplacedPieceCount: 0,
          },
          hojas: [{ index: 1 }, { index: 2 }],
          piezasColocadas: [{ id: 'piece-a-1' }, { id: 'piece-b-1' }],
        },
      },
      {
        id: 'material-2',
        nombre: 'MDF',
        costTotal: 400,
        cutOptimization: null,
      },
    ],
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function proposalFor(candidate = createCandidate(), quote = createQuote()) {
  return createSmartCutProposal({
    candidates: [candidate],
    candidateId: candidate.id,
    quote,
    materialId: 'material-1',
  });
}

describe('Proposal Adapter', () => {
  it('crea una propuesta válida, determinista y explicable', () => {
    const candidate = createCandidate();
    const quote = createQuote();
    const first = proposalFor(candidate, quote);
    const second = proposalFor(candidate, quote);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      type: 'smart-cut-proposal',
      contractVersion: 1,
      id: 'smart-cut-proposal:material-1:best-fit-contract',
      candidateId: 'best-fit-contract',
      previousCandidateId: 'shelf-contract',
      valid: true,
      material: { id: 'material-1', name: 'Melamina nogal' },
    });
    expect(first.summary).toEqual({
      material: { id: 'material-1', name: 'Melamina nogal' },
      strategy: 'best-fit',
      requiredSheets: 1,
      utilization: 47,
      wasteArea: 5300,
      placedPieces: 2,
      unplacedPieces: 0,
      differences: {
        requiredSheets: -1,
        utilization: 12,
        wasteArea: -3800,
        placedPieces: 0,
        unplacedPieces: 0,
      },
    });
  });

  it('conserva aliases legacy en la propuesta sin modificar el candidato', () => {
    const candidate = deepFreeze(createCandidate());
    const snapshot = JSON.stringify(candidate);
    const proposal = proposalFor(candidate);

    expect(proposal.optimization.hojas).toEqual(proposal.optimization.sheets);
    expect(proposal.optimization.piezasColocadas)
      .toEqual(proposal.optimization.placedPieces);
    expect(proposal.optimization.piezasNoColocadas)
      .toEqual(proposal.optimization.unplacedPieces);
    expect(JSON.stringify(candidate)).toBe(snapshot);
  });

  it('rechaza candidateId inexistente y material inexistente', () => {
    const missingCandidate = createSmartCutProposal({
      candidates: [createCandidate()],
      candidateId: 'missing',
      quote: createQuote(),
      materialId: 'missing-material',
    });

    expect(missingCandidate.valid).toBe(false);
    expect(missingCandidate.errors.map((item) => item.code)).toEqual([
      PROPOSAL_VALIDATION_CODES.CANDIDATE_NOT_FOUND,
      PROPOSAL_VALIDATION_CODES.MATERIAL_NOT_FOUND,
    ]);
  });
});

describe('Proposal Validator', () => {
  it('clasifica candidato no elegible, incompleto y físicamente inválido', () => {
    const candidate = createCandidate({
      complete: false,
      valid: false,
      validation: {
        isPhysicallyValid: false,
        warnings: ['Pieza fuera de límites.'],
        errors: [],
        diagnostics: [],
      },
      evaluation: { eligible: false, rank: 2, reasons: ['Descartado.'] },
    });
    const validation = validateCandidateSelection({
      candidates: [candidate],
      candidateId: candidate.id,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.map((item) => item.code)).toEqual(expect.arrayContaining([
      PROPOSAL_VALIDATION_CODES.CANDIDATE_NOT_ELIGIBLE,
      PROPOSAL_VALIDATION_CODES.CANDIDATE_INCOMPLETE,
      PROPOSAL_VALIDATION_CODES.CANDIDATE_PHYSICALLY_INVALID,
    ]));
    expect(validation.warnings).toEqual(['Pieza fuera de límites.']);
  });

  it('detecta contrato e integridad inconsistentes', () => {
    const candidate = createCandidate({
      summary: {
        requiredSheets: 3,
        utilization: 47,
        wasteArea: 5300,
        placedPieceCount: 8,
        unplacedPieceCount: 0,
        totalPieceCount: 9,
      },
    });
    const validation = validateCandidateSelection({
      candidates: [candidate],
      candidateId: candidate.id,
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((item) => (
      item.code === PROPOSAL_VALIDATION_CODES.CANDIDATE_DATA_INTEGRITY
    ))).toBe(true);
  });

  it('valida nuevamente el contrato completo antes de transaccionar', () => {
    const validProposal = proposalFor();
    const invalidProposal = { ...validProposal, contractVersion: 2 };

    expect(validateSmartCutProposal(validProposal).valid).toBe(true);
    expect(validateSmartCutProposal(invalidProposal)).toMatchObject({
      valid: false,
      errors: [{
        code: PROPOSAL_VALIDATION_CODES.INVALID_PROPOSAL,
      }],
    });
  });

  it('rechaza cambios manipulados aunque el candidato sea válido', () => {
    const proposal = proposalFor();
    const manipulated = {
      ...proposal,
      quoteChanges: {
        ...proposal.quoteChanges,
        hojasNecesarias: 99,
      },
    };

    const validation = validateSmartCutProposal(manipulated);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((item) => (
      item.code === PROPOSAL_VALIDATION_CODES.INVALID_PROPOSAL
    ))).toBe(true);
  });
});

describe('Proposal Transaction', () => {
  it('cancela sin modificar Quote, costos, Fabricación, candidato o resultado legacy', () => {
    const candidate = deepFreeze(createCandidate());
    const quote = deepFreeze(createQuote());
    const fabrication = deepFreeze({ status: 'ready', requiredSheets: 2 });
    const legacy = deepFreeze({
      hojas: quote.materialRows[0].cutOptimization.hojas,
      piezasColocadas: quote.materialRows[0].cutOptimization.piezasColocadas,
    });
    const snapshots = {
      candidate: JSON.stringify(candidate),
      quote: JSON.stringify(quote),
      fabrication: JSON.stringify(fabrication),
      legacy: JSON.stringify(legacy),
    };
    const proposal = proposalFor(candidate, quote);
    const result = applySmartCutProposal({ quote, proposal, confirmed: false });

    expect(result).toMatchObject({
      success: false,
      cancelled: true,
      quote,
      appliedCandidateId: null,
      previousCandidateId: 'shelf-contract',
      changedFields: [],
      errors: [],
    });
    expect(JSON.stringify(candidate)).toBe(snapshots.candidate);
    expect(JSON.stringify(quote)).toBe(snapshots.quote);
    expect(JSON.stringify(fabrication)).toBe(snapshots.fabrication);
    expect(JSON.stringify(legacy)).toBe(snapshots.legacy);
  });

  it('aplica únicamente campos autorizados mediante la API oficial de Quote', () => {
    const quote = deepFreeze(createQuote());
    const candidate = deepFreeze(createCandidate());
    const proposal = proposalFor(candidate, quote);
    const result = applySmartCutProposal({ quote, proposal, confirmed: true });
    const appliedMaterial = result.quote.materialRows[0];

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(false);
    expect(result.appliedCandidateId).toBe(candidate.id);
    expect(result.previousCandidateId).toBe('shelf-contract');
    expect(result.changedFields).toEqual([
      'materialRows.material-1.cutOptimization',
      'materialRows.material-1.optimizationSummary',
      'materialRows.material-1.optimizationStatus',
      'materialRows.material-1.optimizationLabel',
      'materialRows.material-1.hojasNecesarias',
      'materialRows.material-1.optimization',
    ]);
    expect(appliedMaterial.cutOptimization.id).toBe(candidate.id);
    expect(appliedMaterial.optimizationSummary).toEqual(candidate.summary);
    expect(appliedMaterial.hojasNecesarias).toBe(1);
    expect(appliedMaterial.optimizationStatus).toBe('optimized');
    expect(appliedMaterial.optimization).toEqual({
      mode: 'smart-cut',
      activeCandidateId: candidate.id,
      proposalId: proposal.id,
      engineVersion: 1,
      inputSignature: null,
      status: 'valid',
    });
    expect(appliedMaterial.costTotal).toBe(1800);
    expect(appliedMaterial.saleTotal).toBe(2500);
    expect(result.quote.materialRows[1]).toBe(quote.materialRows[1]);
    expect(result.quote.legacyField).toBe('preservado');
    expect(quote.materialRows[0].cutOptimization.id).toBe('shelf-contract');
  });

  it('rechaza una propuesta inválida aun cuando exista confirmación', () => {
    const quote = createQuote();
    const proposal = proposalFor();
    const invalid = {
      ...proposal,
      optimization: {
        ...proposal.optimization,
        complete: false,
      },
    };
    const result = applySmartCutProposal({
      quote,
      proposal: invalid,
      confirmed: true,
    });

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.quote).toBe(quote);
    expect(result.changedFields).toEqual([]);
    expect(result.errors.some((item) => (
      item.code === PROPOSAL_VALIDATION_CODES.CANDIDATE_INCOMPLETE
    ))).toBe(true);
  });

  it('produce la misma transacción para la misma entrada confirmada', () => {
    const quote = createQuote();
    const proposal = proposalFor(createCandidate(), quote);
    const first = applySmartCutProposal({ quote, proposal, confirmed: true });
    const second = applySmartCutProposal({ quote, proposal, confirmed: true });

    expect(first).toEqual(second);
    expect(first.quote).not.toBe(quote);
  });

  it('la API oficial de Quote ignora campos no autorizados', () => {
    const quote = createQuote();
    const result = applyQuoteMaterialOptimization(quote, {
      materialId: 'material-1',
      changes: {
        optimizationStatus: 'optimized',
        costTotal: 1,
        arbitraryField: 'no permitido',
      },
    });

    expect(result.success).toBe(true);
    expect(result.quote.materialRows[0].optimizationStatus).toBe('optimized');
    expect(result.quote.materialRows[0].costTotal).toBe(1800);
    expect(result.quote.materialRows[0]).not.toHaveProperty('arbitraryField');
    expect(result.changedFields).toEqual([
      'materialRows.material-1.optimizationStatus',
    ]);
  });

  it('activa Smart Cut en un material persistible sin copiar geometría', () => {
    const candidate = createCandidate();
    const form = {
      id: 'quote-form-1',
      materialItems: [{
        id: 'material-1',
        nombre: 'Melamina nogal',
        costoUnitario: 900,
      }],
    };
    const proposal = proposalFor(candidate, form);
    const result = applySmartCutProposal({
      quote: form,
      proposal,
      confirmed: true,
    });
    const material = result.quote.materialItems[0];

    expect(result.changedFields).toEqual([
      'materialItems.material-1.optimization',
    ]);
    expect(material.optimization).toEqual({
      mode: 'smart-cut',
      activeCandidateId: candidate.id,
      proposalId: proposal.id,
      engineVersion: 1,
      inputSignature: null,
      status: 'valid',
    });
    expect(material).not.toHaveProperty('cutOptimization');
    expect(material).not.toHaveProperty('sheets');
    expect(material).not.toHaveProperty('candidates');
  });

  it('revierte oficialmente el material a Legacy sin conservar referencias Smart Cut', () => {
    const candidate = createCandidate();
    const form = {
      materialItems: [{ id: 'material-1', nombre: 'Melamina nogal' }],
    };
    const proposal = proposalFor(candidate, form);
    const active = applySmartCutProposal({
      quote: form,
      proposal,
      confirmed: true,
    });
    const reverted = applyQuoteMaterialOptimization(active.quote, {
      materialId: 'material-1',
      changes: {
        optimization: {
          mode: 'legacy',
          activeCandidateId: null,
          proposalId: null,
          engineVersion: null,
          inputSignature: null,
          status: 'pending',
        },
      },
    });

    expect(reverted.success).toBe(true);
    expect(reverted.quote.materialItems[0].optimization).toEqual({
      mode: 'legacy',
      activeCandidateId: null,
      proposalId: null,
      engineVersion: null,
      inputSignature: null,
      status: 'pending',
    });
  });
});
