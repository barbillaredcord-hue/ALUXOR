import { describe, expect, it } from 'vitest';
import {
  getActiveOversizeProposal,
  getFeasibleOversizeAlternatives,
  getRecommendedOversizeAlternative,
  isOversizePieceResolved,
  isOversizeProposalObsolete,
  listOversizedPieces,
} from './oversizeResolutionSelectors.js';

describe('oversize resolution selectors', () => {
  const resolution = {
    oversized: true,
    sourcePiece: { id: 'piece-1' },
    inputSignature: 'signature-1',
    recommendationId: 'alternative-2',
    alternatives: [
      { id: 'alternative-1', feasible: false, rank: 2 },
      { id: 'alternative-2', feasible: true, rank: 1 },
    ],
  };

  it('lista, filtra y resuelve recomendación sin mutar', () => {
    expect(listOversizedPieces([{ oversized: false }, resolution])).toEqual([resolution]);
    expect(getFeasibleOversizeAlternatives(resolution)).toEqual([resolution.alternatives[1]]);
    expect(getRecommendedOversizeAlternative(resolution)).toEqual(resolution.alternatives[1]);
  });

  it('obtiene propuesta activa y reconoce piezas resueltas', () => {
    const proposals = [
      { sourcePieceId: 'piece-1', status: 'discarded' },
      { sourcePieceId: 'piece-1', status: 'applied', id: 'active' },
    ];
    expect(getActiveOversizeProposal(proposals, 'piece-1')?.id).toBe('active');
    expect(isOversizePieceResolved({
      resolutionProposalId: 'proposal', oversizeResolutionStatus: 'resolved',
    })).toBe(true);
  });

  it('detecta obsolescencia por pieza o firma', () => {
    const proposal = { sourcePieceId: 'piece-1', inputSignature: 'signature-1' };
    expect(isOversizeProposalObsolete(proposal, resolution)).toBe(false);
    expect(isOversizeProposalObsolete({ ...proposal, inputSignature: 'old' }, resolution))
      .toBe(true);
    expect(isOversizeProposalObsolete({ ...proposal, sourcePieceId: 'other' }, resolution))
      .toBe(true);
  });
});
