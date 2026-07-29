import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SmartCutComparison, {
  notifySmartCutSelection,
  resolveSmartCutSelection,
} from './SmartCutComparison.jsx';

function candidate({
  id,
  strategy,
  sheets,
  utilization,
  wasteArea,
  recommendedReason,
  warning,
  diagnostic,
}) {
  const placedPieces = sheets.flatMap((sheet) => sheet.pieces);
  return {
    id,
    strategy,
    sheets,
    placedPieces,
    unplacedPieces: [],
    summary: {
      requiredSheets: sheets.length,
      utilization,
      wasteArea,
      placedPieceCount: placedPieces.length,
      unplacedPieceCount: 0,
    },
    validation: {
      isPhysicallyValid: true,
      warnings: warning ? [warning] : [],
      errors: [],
    },
    diagnostics: diagnostic ? [{ code: `${id}-diagnostic`, message: diagnostic }] : [],
    evaluation: {
      rank: strategy === 'best-fit' ? 1 : 2,
      reasons: [recommendedReason],
    },
    valid: true,
    complete: true,
  };
}

const shelf = candidate({
  id: 'shelf-contract',
  strategy: 'shelf',
  sheets: [
    {
      index: 1,
      width: 100,
      height: 80,
      efficiencyPercent: 60,
      wasteArea: 3200,
      pieces: [{ id: 'shelf-piece-1', sourceId: 'quote-piece-a', name: 'Costado Shelf', x: 0, y: 0, width: 40, height: 80, rotated: false }],
    },
    {
      index: 2,
      width: 100,
      height: 80,
      efficiencyPercent: 30,
      wasteArea: 5600,
      pieces: [{ id: 'shelf-piece-2', sourceId: 'quote-piece-b', name: 'Repisa Shelf', x: 0, y: 0, width: 30, height: 80, rotated: true }],
    },
  ],
  utilization: 45,
  wasteArea: 8800,
  recommendedReason: 'Utiliza dos hojas.',
  warning: 'Advertencia Shelf.',
  diagnostic: 'Diagnóstico Shelf.',
});

const bestFit = candidate({
  id: 'best-fit-contract',
  strategy: 'best-fit',
  sheets: [{
    index: 1,
    width: 100,
    height: 80,
    efficiencyPercent: 88,
    wasteArea: 960,
    blockedRegions: [{ id: 'damage', x: 85, y: 0, width: 15, height: 15 }],
    reservedRegions: [{ id: 'reserve', x: 85, y: 65, width: 15, height: 15 }],
    pieces: [
      { id: 'best-piece-1', sourceId: 'quote-piece-a', name: 'Costado Best', x: 0, y: 0, width: 40, height: 80, rotated: false },
      { id: 'best-piece-2', sourceId: 'quote-piece-b', name: 'Repisa Best', x: 40.3, y: 0, width: 40, height: 70, rotated: true },
    ],
  }],
  utilization: 88,
  wasteArea: 960,
  recommendedReason: 'Usa menos hojas.',
  diagnostic: 'Diagnóstico Best Fit.',
});

const candidates = [shelf, bestFit];
const ranking = [
  { rank: 1, candidateId: bestFit.id, strategy: bestFit.strategy, reasons: ['Utiliza 1 hoja(s) menos que shelf.'] },
  { rank: 2, candidateId: shelf.id, strategy: shelf.strategy, reasons: ['Utiliza 2 hoja(s).'] },
];

function render(props = {}) {
  return renderToStaticMarkup(
    <SmartCutComparison
      candidates={candidates}
      recommendedCandidateId={bestFit.id}
      selectionReason="Utiliza 1 hoja(s) menos que shelf."
      candidateRanking={ranking}
      {...props}
    />,
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

describe('SmartCutComparison', () => {
  it('renderiza candidatos, ranking y recomendación sin depender solo del color', () => {
    const markup = render();

    expect(markup).toContain('Comparación de optimizaciones');
    expect(markup).toContain('Shelf');
    expect(markup).toContain('Best Fit rectangular');
    expect(markup).toContain('Recomendado');
    expect(markup).toContain('Vista seleccionada');
    expect(markup).toContain('Utiliza 1 hoja(s) menos que shelf.');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
  });

  it('usa el recomendado como vista inicial y actualiza métricas, hoja y diagnóstico al elegir otro candidato', () => {
    const recommendedMarkup = render();
    const selectedShelfMarkup = render({ initialSelectedCandidateId: shelf.id });

    expect(recommendedMarkup).toContain('Costado Best');
    expect(recommendedMarkup).toContain('88%');
    expect(recommendedMarkup).toContain('Diagnóstico Best Fit.');
    expect(recommendedMarkup).not.toContain('Diagnóstico Shelf.');

    expect(selectedShelfMarkup).toContain('Costado Shelf');
    expect(selectedShelfMarkup).toContain('45%');
    expect(selectedShelfMarkup).toContain('Diagnóstico Shelf.');
    expect(selectedShelfMarkup).not.toContain('Diagnóstico Best Fit.');
    expect(resolveSmartCutSelection(candidates, shelf.id, bestFit.id)).toBe(shelf);
  });

  it('acepta selección controlada y notifica el candidateId al padre', () => {
    const onSelectCandidate = vi.fn();
    const controlledMarkup = render({
      initialSelectedCandidateId: bestFit.id,
      selectedCandidateId: shelf.id,
      onSelectCandidate,
    });

    expect(controlledMarkup).toContain('Costado Shelf');
    expect(controlledMarkup).not.toContain('Costado Best');
    expect(notifySmartCutSelection(bestFit.id, onSelectCandidate)).toBe(bestFit.id);
    expect(onSelectCandidate).toHaveBeenCalledWith(bestFit.id);
  });

  it('muestra dimensiones, orientación, regiones, piezas y desperdicio por hoja', () => {
    const markup = render();

    expect(markup).toContain('100 × 80 unidades');
    expect(markup).toContain('Costado Best');
    expect(markup).toContain('Repisa Best');
    expect(markup).toContain('Rotada');
    expect(markup).toContain('Bloqueada');
    expect(markup).toContain('Reservada');
    expect(markup).toContain('Desperdicio:');
    expect(markup).toContain('2 pieza(s), 1 región(es) bloqueada(s) y 1 región(es) reservada(s).');
  });

  it('expone etiquetas accesibles, foco semántico y navegación nativa por botones', () => {
    const markup = render();

    expect(markup).toContain('aria-label="Comparación de candidatos Smart Cut"');
    expect(markup).toContain('aria-label="Candidatos de optimización"');
    expect(markup).toContain('role="img"');
    expect(markup).toContain('Plano de corte de la hoja 1');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('type="button"');
  });

  it('resuelve estados sin candidatos y sin recomendación', () => {
    const emptyMarkup = renderToStaticMarkup(<SmartCutComparison candidates={[]} />);
    const noRecommendationMarkup = renderToStaticMarkup(
      <SmartCutComparison
        candidates={[shelf]}
        recommendedCandidateId={null}
        selectionReason="No existe un candidato elegible."
      />,
    );

    expect(emptyMarkup).toContain('No hay candidatos de optimización disponibles.');
    expect(noRecommendationMarkup).toContain('Sin candidato recomendado');
    expect(noRecommendationMarkup).toContain('No existe un candidato elegible.');
    expect(resolveSmartCutSelection([], shelf.id, bestFit.id)).toBeNull();
  });

  it('no muta Quote, costos, candidatos ni resultado legacy al cambiar la vista', () => {
    const protectedState = deepFreeze({
      quote: { id: 'quote-1', status: 'draft', pieces: [{ id: 'quote-piece-a' }] },
      costs: { purchase: 2400, sale: 3600 },
      legacy: { hojas: [{ index: 1 }], piezasColocadas: [{ id: 'legacy-piece' }] },
      candidates,
    });
    const snapshot = JSON.stringify(protectedState);

    render({ candidates: protectedState.candidates, initialSelectedCandidateId: shelf.id });
    render({ candidates: protectedState.candidates, initialSelectedCandidateId: bestFit.id });

    expect(JSON.stringify(protectedState)).toBe(snapshot);
  });
});
