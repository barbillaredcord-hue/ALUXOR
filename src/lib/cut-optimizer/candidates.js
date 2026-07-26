import { runBestFitStrategy } from './strategies/best-fit.js';
import { runShelfStrategy } from './strategies/shelf.js';

export const CUT_STRATEGY_REGISTRY = Object.freeze([
  Object.freeze({ id: 'shelf', run: runShelfStrategy }),
  Object.freeze({ id: 'best-fit', run: runBestFitStrategy }),
]);

export function generateCutCandidates(normalizedInput, inputValidation) {
  const strategyInput = {
    config: normalizedInput.config,
    pieces: normalizedInput.pieces,
    sourcePieces: normalizedInput.sourcePieces,
    inputValidation,
  };
  return CUT_STRATEGY_REGISTRY.map((entry, registryIndex) => {
    const candidate = entry.run(strategyInput);
    return {
      ...candidate,
      metadata: {
        ...candidate.metadata,
        registryIndex,
      },
    };
  });
}
