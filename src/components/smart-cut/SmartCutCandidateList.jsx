import SmartCutCandidateCard from './SmartCutCandidateCard.jsx';

function nextIndexForKey(key, currentIndex, length) {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (currentIndex + 1) % length;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (currentIndex - 1 + length) % length;
  if (key === 'Home') return 0;
  if (key === 'End') return length - 1;
  return null;
}

export default function SmartCutCandidateList({
  candidates = [],
  selectedCandidateId,
  recommendedCandidateId,
  candidateRanking = [],
  onSelect,
}) {
  const rankingById = new Map(candidateRanking.map((item) => [item.candidateId, item.rank]));

  return (
    <div className="smart-cut-candidate-list" role="group" aria-label="Candidatos de optimización">
      {candidates.map((candidate, index) => (
        <SmartCutCandidateCard
          key={candidate.id}
          candidate={candidate}
          rank={rankingById.get(candidate.id) ?? candidate.evaluation?.rank}
          recommended={candidate.id === recommendedCandidateId}
          selected={candidate.id === selectedCandidateId}
          onSelect={onSelect}
          onKeyDown={(event) => {
            const nextIndex = nextIndexForKey(event.key, index, candidates.length);
            if (nextIndex === null) return;
            event.preventDefault();
            const nextCandidate = candidates[nextIndex];
            onSelect?.(nextCandidate.id);
            event.currentTarget
              .closest('.smart-cut-candidate-list')
              ?.querySelector(`[data-candidate-id="${nextCandidate.id}"]`)
              ?.focus();
          }}
        />
      ))}
    </div>
  );
}
