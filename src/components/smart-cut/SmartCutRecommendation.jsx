import { BadgeCheck, Info } from 'lucide-react';
import { smartCutStrategyLabel } from './SmartCutCandidateCard.jsx';

export default function SmartCutRecommendation({
  recommendedCandidate,
  selectionReason,
}) {
  if (!recommendedCandidate) {
    return (
      <section className="smart-cut-recommendation smart-cut-recommendation--empty" aria-label="Recomendación del motor">
        <Info size={20} aria-hidden="true" />
        <div>
          <strong>Sin candidato recomendado</strong>
          <p>{selectionReason || 'El motor no encontró un candidato elegible.'}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="smart-cut-recommendation" aria-label="Recomendación del motor">
      <BadgeCheck size={22} aria-hidden="true" />
      <div>
        <span>Recomendación del Smart Cut Engine</span>
        <strong>{smartCutStrategyLabel(recommendedCandidate.strategy)}</strong>
        <p>{selectionReason || 'Candidato recomendado por la evaluación física.'}</p>
      </div>
    </section>
  );
}
