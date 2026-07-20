function finiteNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null;
  if (typeof value !== 'number' && typeof value !== 'string') return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function timestamp(project) {
  const value = project?.updatedAt ?? project?.updated_at;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? null : parsed;
}

function hasFabricationData(project) {
  return Array.isArray(project?.measureRows)
    || Array.isArray(project?.materialRows)
    || finiteNumber(project?.cantidad) !== null;
}

export function normalizeFabricationCount(value) {
  return Math.floor(Math.max(0, finiteNumber(value) ?? 0));
}

export function getFabricationCutPlan(material) {
  const optimization = material?.cutOptimization || null;

  return {
    optimization,
    summary: optimization?.summary || null,
    validation: optimization?.validation || null,
    placedPieces: Array.isArray(optimization?.placedPieces)
      ? optimization.placedPieces
      : [],
    unplacedPieces: Array.isArray(optimization?.unplacedPieces)
      ? optimization.unplacedPieces
      : [],
    status: optimization ? 'ready' : 'pending',
  };
}

export function getFabricationSummary(projects = []) {
  const summary = {
    projects: 0,
    pieces: 0,
    materials: 0,
    requiredSheets: 0,
    placedPieces: 0,
    unplacedPieces: 0,
    optimized: 0,
    pendingOptimization: 0,
    invalidPlans: 0,
    updatedAt: null,
  };

  if (!Array.isArray(projects)) return summary;

  let latestTimestamp = null;

  projects.forEach((project) => {
    if (
      !project
      || typeof project !== 'object'
      || Array.isArray(project)
      || !hasFabricationData(project)
    ) return;

    const materials = Array.isArray(project.materialRows) ? project.materialRows : [];
    const cutPlan = getFabricationCutPlan(materials[0]);

    summary.projects += 1;
    summary.pieces += normalizeFabricationCount(project.cantidad);
    summary.materials += materials.length;
    summary.requiredSheets += normalizeFabricationCount(cutPlan.summary?.requiredSheets);
    summary.placedPieces += cutPlan.placedPieces.length;
    summary.unplacedPieces += cutPlan.unplacedPieces.length;

    if (cutPlan.status === 'ready') summary.optimized += 1;
    else summary.pendingOptimization += 1;

    if (cutPlan.validation?.isPhysicallyValid === false) {
      summary.invalidPlans += 1;
    }

    const projectTimestamp = timestamp(project);
    if (projectTimestamp !== null && (latestTimestamp === null || projectTimestamp > latestTimestamp)) {
      latestTimestamp = projectTimestamp;
    }
  });

  summary.updatedAt = latestTimestamp === null
    ? null
    : new Date(latestTimestamp).toISOString();

  return summary;
}
