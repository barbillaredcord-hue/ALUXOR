import { CheckCircle2, Circle, Medal } from 'lucide-react';

const STRATEGY_LABELS = {
  shelf: 'Shelf',
  'best-fit': 'Best Fit rectangular',
};

export function smartCutStrategyLabel(strategy) {
  return STRATEGY_LABELS[strategy] || strategy || 'Estrategia sin nombre';
}

function display(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sin dato';
  return number.toLocaleString('es-MX', { maximumFractionDigits: digits });
}

export default function SmartCutCandidateCard({
  candidate,
  rank,
  recommended = false,
  selected = false,
  onSelect,
  onKeyDown,
}) {
  const summary = candidate?.summary || {};
  const label = smartCutStrategyLabel(candidate?.strategy);

  return (
    <button
      type="button"
      className={[
        'smart-cut-candidate-card',
        recommended ? 'is-recommended' : '',
        selected ? 'is-selected' : '',
      ].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-label={`${label}. ${recommended ? 'Candidato recomendado. ' : ''}${selected ? 'Vista seleccionada.' : 'Seleccionar para comparar.'}`}
      onClick={() => onSelect?.(candidate.id)}
      onKeyDown={onKeyDown}
      data-candidate-id={candidate.id}
    >
      <span className="smart-cut-candidate-card__topline">
        <span className="smart-cut-candidate-card__strategy">
          {recommended ? <Medal size={18} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
          <strong>{label}</strong>
        </span>
        {Number.isFinite(Number(rank)) && <span className="smart-cut-rank">#{rank}</span>}
      </span>

      <span className="smart-cut-candidate-card__states">
        {recommended && <span className="smart-cut-status smart-cut-status--recommended">Recomendado</span>}
        {selected && <span className="smart-cut-status smart-cut-status--selected"><CheckCircle2 size={14} aria-hidden="true" /> Vista seleccionada</span>}
        {!candidate?.valid && <span className="smart-cut-status smart-cut-status--warning">Requiere revisión</span>}
      </span>

      <span className="smart-cut-candidate-card__metrics">
        <span><small>Hojas</small><strong>{summary.requiredSheets ?? '—'}</strong></span>
        <span><small>Aprovechamiento</small><strong>{display(summary.utilization)}%</strong></span>
        <span><small>Sin colocar</small><strong>{summary.unplacedPieceCount ?? candidate?.unplacedPieces?.length ?? '—'}</strong></span>
      </span>
    </button>
  );
}
