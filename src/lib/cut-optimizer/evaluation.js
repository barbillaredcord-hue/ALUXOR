const CRITICAL_CATEGORIES = new Set(['input', 'configuration', 'physical']);

function finiteMetric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function candidateMetrics(candidate = {}) {
  const summary = candidate.summary || {};
  return {
    unplacedPieces: Array.isArray(candidate.unplacedPieces)
      ? candidate.unplacedPieces.length
      : finiteMetric(summary.unplacedPieceCount),
    requiredSheets: finiteMetric(summary.requiredSheets),
    physicalWaste: finiteMetric(summary.wasteArea),
    utilization: finiteMetric(summary.utilization),
    usedArea: finiteMetric(summary.usedArea),
    wasteArea: finiteMetric(summary.wasteArea),
  };
}

export function criticalCandidateDiagnostics(candidate = {}) {
  const diagnostics = Array.isArray(candidate.diagnostics) ? candidate.diagnostics : [];
  const validationErrors = Array.isArray(candidate.validation?.errors)
    ? candidate.validation.errors
    : [];
  const critical = diagnostics.filter((item) => CRITICAL_CATEGORIES.has(item?.category));
  const unique = new Map();
  [...validationErrors, ...critical].forEach((item) => {
    const key = [
      item?.code,
      item?.pieceId,
      item?.sourceId,
      item?.path,
      item?.message,
    ].join('|');
    if (!unique.has(key)) unique.set(key, item);
  });
  return [...unique.values()];
}

function metricsAreValid(metrics) {
  return Number.isInteger(metrics.unplacedPieces)
    && metrics.unplacedPieces >= 0
    && Number.isInteger(metrics.requiredSheets)
    && metrics.requiredSheets >= 0
    && metrics.physicalWaste !== null
    && metrics.physicalWaste >= 0
    && metrics.utilization !== null
    && metrics.utilization >= 0
    && metrics.utilization <= 100
    && metrics.usedArea !== null
    && metrics.usedArea >= 0
    && metrics.wasteArea !== null
    && metrics.wasteArea >= 0;
}

function evaluationReasons(candidate, metrics, critical, eligible) {
  const reasons = [];
  if (!candidate.complete) reasons.push('Descartado porque no contabiliza todas las piezas.');
  if (candidate.validation?.isPhysicallyValid === false || candidate.valid === false) {
    reasons.push('Descartado porque la solución no es físicamente válida.');
  }
  if (critical.length) {
    reasons.push(`Descartado por ${critical.length} diagnóstico(s) crítico(s).`);
    critical.forEach((item) => {
      if (item?.message) reasons.push(item.message);
    });
  }
  if (!metricsAreValid(metrics)) {
    reasons.push('Descartado por métricas físicas inválidas o incompletas.');
  }
  if (eligible) {
    reasons.push(
      metrics.unplacedPieces === 0
        ? 'Todas las piezas fueron colocadas.'
        : `${metrics.unplacedPieces} pieza(s) quedaron sin colocar.`,
    );
    reasons.push(`Utiliza ${metrics.requiredSheets} hoja(s).`);
    reasons.push(`Presenta ${metrics.physicalWaste} unidades² de desperdicio físico.`);
    reasons.push(`Aprovechamiento físico: ${metrics.utilization}%.`);
  }
  return [...new Set(reasons)];
}

export function evaluateCandidate(candidate = {}, strategyOrder = 0) {
  const metrics = candidateMetrics(candidate);
  const critical = criticalCandidateDiagnostics(candidate);
  const eligible = candidate.complete === true
    && candidate.valid === true
    && candidate.validation?.isPhysicallyValid === true
    && critical.length === 0
    && metricsAreValid(metrics);
  const score = eligible ? [
    metrics.unplacedPieces,
    metrics.requiredSheets,
    metrics.physicalWaste,
    -metrics.utilization,
    -metrics.usedArea,
    metrics.wasteArea,
    strategyOrder,
  ] : null;

  return {
    eligible,
    score,
    metrics,
    reasons: evaluationReasons(candidate, metrics, critical, eligible),
    rank: null,
    strategyOrder,
  };
}

function compareEvaluations(left, right) {
  if (left.evaluation.eligible !== right.evaluation.eligible) {
    return left.evaluation.eligible ? -1 : 1;
  }
  if (!left.evaluation.eligible) {
    return left.evaluation.strategyOrder - right.evaluation.strategyOrder;
  }
  for (let index = 0; index < left.evaluation.score.length; index += 1) {
    const difference = left.evaluation.score[index] - right.evaluation.score[index];
    if (difference !== 0) return difference;
  }
  return 0;
}

export function evaluateCandidates(candidates = []) {
  const evaluated = (Array.isArray(candidates) ? candidates : []).map((candidate, index) => ({
    ...candidate,
    evaluation: evaluateCandidate(
      candidate,
      finiteMetric(candidate.metadata?.registryIndex) ?? index,
    ),
  }));
  const ranked = [...evaluated].sort(compareEvaluations);
  const ranks = new Map(ranked.map((candidate, index) => [candidate.id, index + 1]));
  return evaluated.map((candidate) => ({
    ...candidate,
    evaluation: {
      ...candidate.evaluation,
      rank: ranks.get(candidate.id),
    },
  }));
}
