function metric(source, field) {
  const value = Number(source?.summary?.[field]);
  return Number.isFinite(value) ? value : 0;
}

function difference(selected, current, field) {
  if (!current?.summary) return null;
  return metric(selected, field) - metric(current, field);
}

export function createProposalSummary({
  candidate,
  currentOptimization = null,
  material,
} = {}) {
  return {
    material: {
      id: material?.id || '',
      name: material?.nombre || material?.name || 'Material sin nombre',
    },
    strategy: candidate?.strategy || '',
    requiredSheets: metric(candidate, 'requiredSheets'),
    utilization: metric(candidate, 'utilization'),
    wasteArea: metric(candidate, 'wasteArea'),
    placedPieces: metric(candidate, 'placedPieceCount'),
    unplacedPieces: metric(candidate, 'unplacedPieceCount'),
    differences: {
      requiredSheets: difference(candidate, currentOptimization, 'requiredSheets'),
      utilization: difference(candidate, currentOptimization, 'utilization'),
      wasteArea: difference(candidate, currentOptimization, 'wasteArea'),
      placedPieces: difference(candidate, currentOptimization, 'placedPieceCount'),
      unplacedPieces: difference(candidate, currentOptimization, 'unplacedPieceCount'),
    },
  };
}
