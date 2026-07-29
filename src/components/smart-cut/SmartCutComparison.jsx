import { useState } from 'react';
import SmartCutCandidateList from './SmartCutCandidateList.jsx';
import SmartCutDiagnostics from './SmartCutDiagnostics.jsx';
import SmartCutMetrics from './SmartCutMetrics.jsx';
import SmartCutRecommendation from './SmartCutRecommendation.jsx';
import SmartCutSheetViewer from './SmartCutSheetViewer.jsx';
import { smartCutStrategyLabel } from './SmartCutCandidateCard.jsx';

export function resolveSmartCutSelection(
  candidates = [],
  selectedCandidateId,
  recommendedCandidateId,
) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  return candidates.find((candidate) => candidate.id === selectedCandidateId)
    || candidates.find((candidate) => candidate.id === recommendedCandidateId)
    || candidates[0];
}

export function notifySmartCutSelection(candidateId, onSelectCandidate) {
  onSelectCandidate?.(candidateId);
  return candidateId;
}

export default function SmartCutComparison({
  candidates = [],
  recommendedCandidateId = null,
  selectionReason = '',
  candidateRanking = [],
  initialSelectedCandidateId = null,
  selectedCandidateId: controlledSelectedCandidateId,
  onSelectCandidate,
}) {
  const [internalSelectedCandidateId, setInternalSelectedCandidateId] = useState(
    initialSelectedCandidateId,
  );
  const selectedCandidateId = controlledSelectedCandidateId === undefined
    ? internalSelectedCandidateId
    : controlledSelectedCandidateId;
  const recommendedCandidate = candidates.find(
    (candidate) => candidate.id === recommendedCandidateId,
  ) || null;
  const selectedCandidate = resolveSmartCutSelection(
    candidates,
    selectedCandidateId,
    recommendedCandidateId,
  );

  if (!candidates.length) {
    return (
      <section className="smart-cut-comparison smart-cut-empty" aria-label="Comparación de candidatos Smart Cut">
        <h3>Comparación de optimizaciones</h3>
        <p>No hay candidatos de optimización disponibles.</p>
      </section>
    );
  }

  const rankingEntry = candidateRanking.find(
    (item) => item.candidateId === selectedCandidate?.id,
  );
  function selectCandidate(candidateId) {
    if (controlledSelectedCandidateId === undefined) {
      setInternalSelectedCandidateId(candidateId);
    }
    notifySmartCutSelection(candidateId, onSelectCandidate);
  }

  return (
    <section className="smart-cut-comparison" aria-label="Comparación de candidatos Smart Cut">
      <header className="smart-cut-comparison__header">
        <div>
          <span>BR Smart Cut Engine</span>
          <h3>Comparación de optimizaciones</h3>
          <p>Vista informativa. Cambiar candidato no aplica ni guarda cambios.</p>
        </div>
        <span className="smart-cut-local-state">Selección visual local</span>
      </header>

      <SmartCutRecommendation
        recommendedCandidate={recommendedCandidate}
        selectionReason={selectionReason}
      />
      <SmartCutCandidateList
        candidates={candidates}
        selectedCandidateId={selectedCandidate.id}
        recommendedCandidateId={recommendedCandidateId}
        candidateRanking={candidateRanking}
        onSelect={selectCandidate}
      />

      <div className="smart-cut-selected-heading" role="status" aria-live="polite">
        <span>Vista activa</span>
        <strong>{smartCutStrategyLabel(selectedCandidate.strategy)}</strong>
        <small>{selectedCandidate.id}</small>
      </div>
      <SmartCutMetrics candidate={selectedCandidate} />
      <SmartCutSheetViewer candidate={selectedCandidate} />
      <SmartCutDiagnostics candidate={selectedCandidate} rankingEntry={rankingEntry} />
    </section>
  );
}
