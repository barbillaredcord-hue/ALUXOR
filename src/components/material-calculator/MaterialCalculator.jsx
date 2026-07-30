import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  Calculator,
  Check,
  CircleDollarSign,
  FolderKanban,
  Layers3,
  PackageCheck,
  Percent,
  Ruler,
  Scissors,
  ShoppingCart,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  CALCULATION_TYPES,
  calculateMaterial,
  convertLength,
  pieceIdsForGroups,
  pieceIdsForMaterial,
} from '../../lib/material-calculator/engine.js';
import {
  normalizeOptimizationSessionWorkingInput,
  optimizationSessionCandidateStrategy,
  optimizationSessionPieceOrder,
} from '../../lib/optimization-session/index.js';
import SmartCutComparison from '../smart-cut/SmartCutComparison.jsx';

const TYPE_OPTIONS = [
  {
    id: CALCULATION_TYPES.SHEET,
    label: 'Hoja o tablero',
    description: 'Calcula hojas para melamina, MDF, triplay u otros tableros.',
  },
  {
    id: CALCULATION_TYPES.GLASS,
    label: 'Vidrio',
    description: 'Calcula superficie, merma y costo de piezas de vidrio.',
  },
  {
    id: CALCULATION_TYPES.LINEAR,
    label: 'Perfil lineal',
    description: 'Calcula metros lineales, barras, sobrante y costo.',
  },
  {
    id: CALCULATION_TYPES.SURFACE,
    label: 'Superficie en m²',
    description: 'Calcula recubrimientos y materiales vendidos por superficie.',
  },
  {
    id: CALCULATION_TYPES.HARDWARE,
    label: 'Herrajes por cantidad',
    description: 'Calcula unidades, reserva adicional y costo total.',
  },
];

const initialConfig = {
  unit: 'cm',
  materialId: '',
  materialName: 'Melamina',
  thickness: 16,
  formatWidth: 122,
  formatHeight: 244,
  barLength: 600,
  price: 1200,
  wastePercent: 8,
  marginPercent: 35,
  allowRotation: true,
  grainDirection: false,
  kerf: 0.3,
  pieceOrder: 'largest-first',
  treatment: '',
  quantityPerPiece: 1,
  reserveQuantity: 0,
};

const initialQuickPiece = {
  id: 'quick-piece',
  name: 'Pieza independiente',
  width: 45,
  height: 70,
  length: 100,
  quantity: 1,
};

export function initialMaterialCalculatorConfig(materials = [], workingInput = null) {
  if (workingInput) {
    const material = materials.find((item) => item.id === workingInput.materialId);
    return {
      ...initialConfig,
      ...workingInput,
      materialId: workingInput.materialId || '',
      materialName: material?.nombre || material?.name || initialConfig.materialName,
    };
  }
  const material = materials.find((item) => (
    item?.optimization?.candidateSnapshot?.candidateId
  ));
  if (!material) return initialConfig;
  const snapshotConfig = material.optimization.candidateSnapshot.configuration || {};
  return {
    ...initialConfig,
    materialId: material.id,
    materialName: material.nombre || material.name || initialConfig.materialName,
    formatWidth: snapshotConfig.sheetWidth || material.ancho || initialConfig.formatWidth,
    formatHeight: snapshotConfig.sheetHeight || material.alto || initialConfig.formatHeight,
    kerf: snapshotConfig.kerf ?? initialConfig.kerf,
    allowRotation: snapshotConfig.allowRotation ?? initialConfig.allowRotation,
    price: material.precioUnitario ?? initialConfig.price,
    wastePercent: material.merma ?? initialConfig.wastePercent,
  };
}

export function buildOptimizationSessionInputFromCalculator({
  type,
  config,
  selectedPieceIds,
  selectedCandidateId,
  selectedCandidateStrategy = null,
} = {}) {
  const candidateStrategy = selectedCandidateStrategy
    || optimizationSessionCandidateStrategy({ selectedCandidateId });
  return normalizeOptimizationSessionWorkingInput({
    ...config,
    type,
    selectedPieceIds,
    selectedCandidateId,
    strategy: candidateStrategy || config?.strategy,
    pieceOrder: optimizationSessionPieceOrder(config),
  });
}

export function optimizationSessionInputForSelectedCandidate({
  calculation,
  candidateId,
  type,
  config,
  selectedPieceIds,
} = {}) {
  const candidate = calculation?.optimization?.candidates?.find(
    (item) => item.id === candidateId,
  ) || null;
  return candidate
    ? buildOptimizationSessionInputFromCalculator({
      type,
      config,
      selectedPieceIds,
      selectedCandidateId: candidate.id,
      selectedCandidateStrategy: candidate.strategy,
    })
    : null;
}

const SAFE_PIECE_CATEGORIES = [
  { name: 'Estructura', pattern: /\b(costado|piso|techo|base|respaldo)\b/i },
  { name: 'Puertas', pattern: /\b(puerta|frente)\b/i },
  { name: 'Interiores', pattern: /\b(entrepaño|entrepano|repisa|divisor|cajón|cajon)\b/i },
];

const SUMMARY_ICONS = {
  Proyecto: FolderKanban,
  Conjunto: Layers3,
  'Piezas seleccionadas': Boxes,
  Material: PackageCheck,
  'Área neta': Ruler,
  'Área requerida': Ruler,
  'Longitud neta': Ruler,
  Merma: Percent,
  Hojas: ShoppingCart,
  Barras: ShoppingCart,
  Tratamiento: PackageCheck,
  'Precio por m²': CircleDollarSign,
  'Costo unitario': CircleDollarSign,
  Unidades: Boxes,
  Reserva: Boxes,
  Compra: ShoppingCart,
  Costo: CircleDollarSign,
  Margen: TrendingUp,
  'Precio propuesto': CircleDollarSign,
};

function number(value) {
  if (value === '') return '';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function display(value, digits = 2) {
  return Number(value || 0).toLocaleString('es-MX', {
    maximumFractionDigits: digits,
  });
}

function materialType(type) {
  if (type === CALCULATION_TYPES.SHEET) return 'hoja';
  if ([CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE].includes(type)) return 'area';
  if (type === CALCULATION_TYPES.LINEAR) return 'lineal';
  return 'pieza';
}

export function inferPieceCategory(piece = {}) {
  const explicit = String(piece.categoria ?? piece.category ?? '').trim();
  if (explicit) return explicit;
  const name = String(piece.nombre ?? piece.name ?? '').trim();
  return SAFE_PIECE_CATEGORIES.find((category) => category.pattern.test(name))?.name || null;
}

export function groupPiecesByCategory(pieces = []) {
  const categories = new Map();
  const direct = [];
  (Array.isArray(pieces) ? pieces : []).forEach((piece) => {
    const category = inferPieceCategory(piece);
    if (!category) {
      direct.push(piece);
      return;
    }
    categories.set(category, [...(categories.get(category) || []), piece]);
  });
  return {
    categories: [...categories].map(([name, categoryPieces]) => ({
      name,
      pieces: categoryPieces,
    })),
    direct,
  };
}

export function pieceQuantityTotal(pieces = []) {
  return (Array.isArray(pieces) ? pieces : []).reduce((total, piece) => (
    total + Math.max(0, Number(piece?.cantidad ?? piece?.quantity) || 0)
  ), 0);
}

function isUsableSmartCutCandidate(candidate) {
  return (
    candidate?.valid === true
    && candidate?.complete === true
    && candidate?.validation?.isPhysicallyValid === true
  );
}

export function resolveInitialSmartCutCandidateId(
  optimization,
  appliedCandidateId = null,
) {
  const candidates = Array.isArray(optimization?.candidates)
    ? optimization.candidates
    : [];
  const applied = candidates.find((candidate) => (
    candidate.id === appliedCandidateId && isUsableSmartCutCandidate(candidate)
  ));
  if (applied) return applied.id;
  const recommended = candidates.find((candidate) => (
    candidate.id === optimization?.recommendedCandidateId
    && isUsableSmartCutCandidate(candidate)
  ));
  if (recommended) return recommended.id;
  const ranked = (Array.isArray(optimization?.candidateRanking)
    ? optimization.candidateRanking
    : [])
    .map((entry) => candidates.find((candidate) => candidate.id === entry.candidateId))
    .find(isUsableSmartCutCandidate);
  return ranked?.id || candidates.find(isUsableSmartCutCandidate)?.id || null;
}

export function resolveSelectedOptimizationCandidate(calculation, selectedCandidateId) {
  return calculation?.optimization?.candidates?.find((candidate) => (
    candidate.id === selectedCandidateId && isUsableSmartCutCandidate(candidate)
  )) || null;
}

export function sheetSummaryMetrics(
  calculation,
  selectedCandidateId,
  selectedCandidate = resolveSelectedOptimizationCandidate(
    calculation,
    selectedCandidateId,
  ),
) {
  const candidate = selectedCandidate;
  if (!candidate) {
    return {
      netArea: calculation?.netArea,
      waste: calculation?.wastePercent,
      wasteUnit: '%',
      requiredArea: calculation?.areaWithWaste,
      requiredSheets: calculation?.commercialSheets,
      utilization: null,
      placedPieceCount: null,
      unplacedPieceCount: null,
      source: 'legacy',
    };
  }
  return {
    netArea: calculation?.netArea,
    waste: candidate.summary.wasteArea / 10000,
    wasteUnit: 'm²',
    requiredArea: candidate.summary.usedArea / 10000,
    requiredSheets: candidate.summary.requiredSheets,
    utilization: candidate.summary.utilization,
    placedPieceCount: candidate.summary.placedPieceCount,
    unplacedPieceCount: candidate.summary.unplacedPieceCount,
    source: 'candidate',
  };
}

export function calculationForSelectedSmartCutCandidate(
  calculation,
  selectedCandidateId,
) {
  const selectedCandidate = calculation?.optimization?.candidates?.find(
    (candidate) => candidate.id === selectedCandidateId,
  ) || null;
  if (!selectedCandidate) return calculation;
  return {
    ...calculation,
    commercialSheets: selectedCandidate.summary.requiredSheets,
    estimatedWaste: selectedCandidate.summary.wasteArea / 10000,
    utilization: selectedCandidate.summary.utilization,
    optimization: {
      ...calculation.optimization,
      selectedCandidateId: selectedCandidate.id,
      selectedCandidate,
    },
  };
}

export function buildMaterialApplicationPayload({
  material,
  calculation,
  selectedPieceIds = [],
  selectedCandidateId = null,
  replace = false,
} = {}) {
  const effectiveCalculation = calculationForSelectedSmartCutCandidate(
    calculation,
    selectedCandidateId,
  );
  const selectedCandidate = effectiveCalculation?.optimization?.selectedCandidate || null;
  return {
    material,
    calculation: effectiveCalculation,
    selectedPieceIds,
    selectedCandidateId: selectedCandidate?.id || null,
    selectedCandidate,
    replace,
  };
}

export function buildTechnicalPieceLayout(pieces = [], selectedPieceIds = []) {
  const selected = new Set(selectedPieceIds);
  const ordered = [...(Array.isArray(pieces) ? pieces : [])]
    .sort((left, right) => Number(selected.has(right.id)) - Number(selected.has(left.id)))
    .slice(0, 12);
  return ordered.map((piece, index) => {
    const width = Math.max(1, Number(piece.ancho ?? piece.width) || 1);
    const height = Math.max(1, Number(piece.alto ?? piece.height) || 1);
    const ratio = width / height;
    const cellWidth = 188;
    const cellHeight = 84;
    const rectWidth = ratio >= 1 ? cellWidth : Math.max(34, cellHeight * ratio);
    const rectHeight = ratio >= 1 ? Math.max(28, cellWidth / ratio) : cellHeight;
    const column = index % 3;
    const row = Math.floor(index / 3);
    return {
      ...piece,
      selected: selected.has(piece.id),
      x: 16 + column * 208 + (cellWidth - rectWidth) / 2,
      y: 16 + row * 108 + (cellHeight - rectHeight) / 2,
      width: rectWidth,
      height: rectHeight,
    };
  });
}

export function TechnicalPieceBoard({
  pieces = [],
  selectedPieceIds = [],
  focusedPieceId = null,
  onTogglePiece,
  onFocusPiece,
}) {
  const layout = buildTechnicalPieceLayout(pieces, selectedPieceIds);
  const height = Math.max(120, Math.ceil(layout.length / 3) * 108 + 12);
  if (!layout.length) {
    return <p className="calculator-inline-empty">No hay piezas disponibles para la vista técnica.</p>;
  }
  return (
    <figure className="technical-piece-board">
      <svg
        viewBox={`0 0 640 ${height}`}
        role="img"
        aria-labelledby="technical-board-title technical-board-description"
      >
        <title id="technical-board-title">Tablero técnico de piezas reales</title>
        <desc id="technical-board-description">Rectángulos proporcionales basados en ancho y alto. Las piezas seleccionadas aparecen resaltadas.</desc>
        {layout.map((piece) => (
          <g
            key={piece.id}
            role="button"
            tabIndex="0"
            aria-label={`${piece.nombre || piece.name}. ${piece.selected ? 'Seleccionada' : 'No seleccionada'}`}
            aria-pressed={piece.selected}
            className={[
              'technical-piece',
              piece.selected ? 'is-selected' : '',
              piece.id === focusedPieceId ? 'is-focused' : '',
            ].filter(Boolean).join(' ')}
            onFocus={() => onFocusPiece?.(piece.id)}
            onClick={() => onTogglePiece?.(piece.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onTogglePiece?.(piece.id);
              }
            }}
          >
            <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height} rx="5" />
            <text x={piece.x + 7} y={piece.y + 17}>{piece.nombre || piece.name}</text>
            <text x={piece.x + 7} y={piece.y + 34} className="technical-piece__measure">
              {display(piece.ancho ?? piece.width)} × {display(piece.alto ?? piece.height)} cm
            </text>
          </g>
        ))}
      </svg>
      <figcaption>
        Vista conceptual de piezas; no representa un mueble ni sustituye la optimización física.
        {pieces.length > 12 ? ` Se muestran 12 de ${pieces.length} partidas.` : ''}
      </figcaption>
    </figure>
  );
}

export default function MaterialCalculator({
  context = {},
  pieces = [],
  pieceGroups = [],
  materials = [],
  money = (value) => `$${display(value)}`,
  readOnly = false,
  initialMode = 'project',
  initialSelectedPieceIds = [],
  optimizationSessionInput = null,
  legacyOptimizationInput = null,
  onApplySelectionToSession,
  onApplySelectionToLegacy,
  onClearLegacySelection,
  onCreateGroup,
  onApply,
  onBack,
  onChangeProject,
}) {
  const [mode, setMode] = useState(initialMode);
  const [draftMaterialId] = useState(() => (
    `mat-calc-${globalThis.crypto?.randomUUID?.() || Date.now()}`
  ));
  const effectiveOptimizationInput = optimizationSessionInput
    || legacyOptimizationInput;
  const [type, setType] = useState(
    effectiveOptimizationInput?.type || CALCULATION_TYPES.SHEET,
  );
  const [selectedPieceIds, setSelectedPieceIds] = useState(() => (
    Array.isArray(effectiveOptimizationInput?.selectedPieceIds)
      ? effectiveOptimizationInput.selectedPieceIds
      : Array.isArray(initialSelectedPieceIds) ? initialSelectedPieceIds : []
  ));
  const [config, setConfig] = useState(() => (
    initialMaterialCalculatorConfig(materials, effectiveOptimizationInput)
  ));
  const [quickPiece, setQuickPiece] = useState(initialQuickPiece);
  const [calculation, setCalculation] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [conflicts, setConflicts] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [resultView, setResultView] = useState('calculation');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [materialEditorOpen, setMaterialEditorOpen] = useState(false);
  const [focusedPieceId, setFocusedPieceId] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(
    effectiveOptimizationInput?.selectedCandidateId || null,
  );
  const hasOpenedOptimizationSession = Boolean(
    optimizationSessionInput && onApplySelectionToSession,
  );
  const canShareLegacyOptimization = Boolean(
    !hasOpenedOptimizationSession && onApplySelectionToLegacy,
  );
  const effectiveOptimizationInputKey = JSON.stringify(effectiveOptimizationInput);

  useEffect(() => {
    if (!effectiveOptimizationInput) return;
    const localInput = buildOptimizationSessionInputFromCalculator({
      type,
      config,
      selectedPieceIds,
      selectedCandidateId,
    });
    if (JSON.stringify(localInput) === effectiveOptimizationInputKey) return;
    setType(effectiveOptimizationInput.type || CALCULATION_TYPES.SHEET);
    setSelectedPieceIds(effectiveOptimizationInput.selectedPieceIds || []);
    setConfig(initialMaterialCalculatorConfig(materials, effectiveOptimizationInput));
    setSelectedCandidateId(effectiveOptimizationInput.selectedCandidateId || null);
    setCalculation(null);
    setHasInteracted(false);
  }, [effectiveOptimizationInputKey]);

  useEffect(() => {
    if (
      !canShareLegacyOptimization
      || !hasInteracted
      || mode !== 'project'
    ) return;
    onApplySelectionToLegacy(buildOptimizationSessionInputFromCalculator({
      type,
      config,
      selectedPieceIds,
      selectedCandidateId,
    }));
    setHasInteracted(false);
  }, [
    canShareLegacyOptimization,
    config,
    hasInteracted,
    mode,
    selectedCandidateId,
    selectedPieceIds,
    type,
  ]);

  const availablePieces = mode === 'quick' ? [quickPiece] : pieces;
  const effectiveSelection = mode === 'quick' ? ['quick-piece'] : selectedPieceIds;
  const selectedSet = useMemo(() => new Set(effectiveSelection), [effectiveSelection]);
  const ungrouped = pieces.filter((piece) => (
    !piece.groupId || !pieceGroups.some((group) => group.id === piece.groupId)
  ));
  const selectedPieces = availablePieces.filter((piece) => selectedSet.has(piece.id));
  const selectedUnitCount = selectedPieces.reduce((total, piece) => (
    total + Math.max(0, Number(piece.cantidad ?? piece.quantity) || 0)
  ), 0);
  const configuredMaterial = materials.find((material) => (
    material.id === config.materialId
  )) || null;
  const appliedCandidateId = configuredMaterial
    ?.optimization
    ?.candidateSnapshot
    ?.candidateId || null;

  useEffect(() => {
    if (!calculation?.optimization) return;
    setSelectedCandidateId((current) => resolveInitialSmartCutCandidateId(
      calculation.optimization,
      current || appliedCandidateId,
    ));
  }, [appliedCandidateId, calculation]);

  function updateConfig(field, value) {
    setHasInteracted(true);
    setConfig((current) => ({ ...current, [field]: value }));
    setCalculation(null);
    setFeedback('');
  }

  function togglePiece(pieceId) {
    setHasInteracted(true);
    setSelectedPieceIds((current) => (
      current.includes(pieceId)
        ? current.filter((id) => id !== pieceId)
        : [...current, pieceId]
    ));
    setCalculation(null);
  }

  function toggleGroup(groupId) {
    setHasInteracted(true);
    const groupPieceIds = pieceIdsForGroups(pieces, [groupId]);
    const allSelected = groupPieceIds.length
      && groupPieceIds.every((id) => selectedSet.has(id));
    setSelectedPieceIds((current) => (
      allSelected
        ? current.filter((id) => !groupPieceIds.includes(id))
        : [...new Set([...current, ...groupPieceIds])]
    ));
    setCalculation(null);
  }

  function toggleCategory(categoryPieces) {
    setHasInteracted(true);
    const categoryPieceIds = categoryPieces.map((piece) => piece.id);
    const allSelected = categoryPieceIds.length
      && categoryPieceIds.every((id) => selectedSet.has(id));
    setSelectedPieceIds((current) => (
      allSelected
        ? current.filter((id) => !categoryPieceIds.includes(id))
        : [...new Set([...current, ...categoryPieceIds])]
    ));
    setCalculation(null);
  }

  function calculationInput(optimize = false) {
    return {
      type,
      pieces: availablePieces,
      selectedPieceIds: effectiveSelection,
      pieceUnit: 'cm',
      unit: config.unit,
      formatWidth: config.formatWidth,
      formatHeight: config.formatHeight,
      barLength: config.barLength,
      price: config.price,
      wastePercent: config.wastePercent,
      marginPercent: config.marginPercent,
      allowRotation: config.allowRotation,
      grainDirection: config.grainDirection,
      kerf: config.kerf,
      strategy: optimizationSessionPieceOrder(config),
      treatment: config.treatment,
      quantityPerPiece: config.quantityPerPiece,
      reserveQuantity: config.reserveQuantity,
      margins: config.margins,
      blockedRegions: config.blockedRegions,
      reservedRegions: config.reservedRegions,
      optimize,
    };
  }

  function runCalculation(optimize = false) {
    setHasInteracted(true);
    const next = calculateMaterial(calculationInput(optimize));
    setCalculation(next);
    setResultView(optimize && next.status === 'calculated' ? 'optimization' : 'calculation');
    setFeedback(next.status === 'calculated' ? 'Cálculo actualizado.' : '');
    return next;
  }

  function selectedMaterial(activeCalculation = calculation) {
    const existing = materials.find((material) => material.id === config.materialId);
    const linear = type === CALCULATION_TYPES.LINEAR;
    const hardware = type === CALCULATION_TYPES.HARDWARE;
    return {
      ...(existing || {}),
      id: existing?.id || config.materialId || draftMaterialId,
      nombre: config.materialName,
      tipoCompra: linear ? 'manual' : materialType(type),
      calculo: linear ? 'manual' : materialType(type),
      baseCalculo: linear || hardware ? 'manual_qty' : 'medidas_area',
      usarArea: !linear && !hardware,
      categoria: type === CALCULATION_TYPES.GLASS
        ? 'Vidrio'
        : type === CALCULATION_TYPES.LINEAR
          ? 'Aluminio'
          : type === CALCULATION_TYPES.HARDWARE ? 'Herraje' : 'Madera/Melamina',
      ancho: convertLength(config.formatWidth, config.unit, 'cm') || 0,
      alto: convertLength(config.formatHeight, config.unit, 'cm') || 0,
      largo: convertLength(config.barLength, config.unit, 'cm') || 0,
      grosor: config.thickness,
      cantidad: linear
        ? activeCalculation?.barsNeeded || 0
        : hardware ? activeCalculation?.purchaseQuantity || 0 : undefined,
      costoUnitario: config.price,
      merma: config.wastePercent,
      margen: config.marginPercent,
      unidad: [CALCULATION_TYPES.SHEET, CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE]
        .includes(type) ? 'm²' : linear ? 'barra' : 'pieza',
    };
  }

  function apply(replace = false) {
    const nextCalculation = calculation?.status === 'calculated'
      ? calculation
      : runCalculation(false);
    if (nextCalculation.status !== 'calculated') return;
    const effectiveCalculation = calculationForSelectedSmartCutCandidate(
      nextCalculation,
      selectedCandidateId,
    );
    const selectedCandidate = effectiveCalculation?.optimization?.selectedCandidate || null;
    if (mode === 'quick') {
      setFeedback('Cálculo independiente listo. No se modificó la cotización.');
      return;
    }
    const result = onApply?.(buildMaterialApplicationPayload({
      material: selectedMaterial(effectiveCalculation),
      calculation: effectiveCalculation,
      selectedPieceIds,
      selectedCandidateId: selectedCandidate?.id || null,
      replace,
    }));
    if (result?.reason === 'confirmation-required') {
      setConflicts(result.conflicts || []);
      setFeedback('Hay piezas con otro material. Revisa antes de reemplazar.');
      return;
    }
    setConflicts([]);
    setFeedback(result?.applied
      ? `${config.materialName} se aplicó a ${selectedUnitCount} pieza(s).`
      : 'No fue posible aplicar el material.');
  }

  function applySelectionToWorkingSession() {
    const nextCalculation = runCalculation(true);
    if (nextCalculation.status !== 'calculated') return;
    const candidateId = resolveInitialSmartCutCandidateId(
      nextCalculation.optimization,
      selectedCandidateId,
    );
    const selectedCandidate = nextCalculation.optimization?.candidates?.find(
      (candidate) => candidate.id === candidateId,
    ) || null;
    setSelectedCandidateId(candidateId);
    const input = buildOptimizationSessionInputFromCalculator({
      type,
      config,
      selectedPieceIds,
      selectedCandidateId: candidateId,
      selectedCandidateStrategy: selectedCandidate?.strategy || null,
    });
    if (hasOpenedOptimizationSession) {
      onApplySelectionToSession(input);
    } else {
      onApplySelectionToLegacy?.(input);
    }
    setHasInteracted(false);
    setConflicts([]);
    setFeedback(hasOpenedOptimizationSession
      ? 'Selección aplicada a la sesión abierta. Falta actualizar la sesión para persistirla.'
      : 'Selección temporal compartida con Cut Optimizer.');
  }

  function clearTemporaryCalculation() {
    setMode(initialMode);
    setSelectedPieceIds([]);
    setConfig(initialConfig);
    setQuickPiece(initialQuickPiece);
    setCalculation(null);
    setConflicts([]);
    setFeedback('');
    setFocusedPieceId(null);
    setResultView('calculation');
    setMaterialEditorOpen(false);
    setHasInteracted(false);
    if (!hasOpenedOptimizationSession) onClearLegacySelection?.();
  }

  const groupedPieces = pieceGroups.map((group) => ({
    ...group,
    pieces: pieces.filter((piece) => piece.groupId === group.id),
    organization: groupPiecesByCategory(
      pieces.filter((piece) => piece.groupId === group.id),
    ),
  }));
  const selectedGroupNames = groupedPieces
    .filter((group) => group.pieces.some((piece) => selectedSet.has(piece.id)))
    .map((group) => group.name);
  const hasTemporaryChanges = Boolean(
    hasOpenedOptimizationSession || canShareLegacyOptimization
      ? hasInteracted || newGroupName || mode !== initialMode
      : selectedPieceIds.length
        || calculation
        || newGroupName
        || hasInteracted
        || mode !== initialMode
  );
  const sessionStatus = feedback.includes('se aplicó')
    ? 'Cambio aplicado'
    : calculation?.status === 'calculated'
      ? 'Propuesta lista'
      : selectedPieceIds.length
        ? 'Selección temporal'
        : 'Sin cambios temporales';
  const selectedOptimizationCandidate = resolveSelectedOptimizationCandidate(
    calculation,
    selectedCandidateId,
  );
  const sheetMetrics = sheetSummaryMetrics(
    calculation,
    selectedCandidateId,
    selectedOptimizationCandidate,
  );
  const summaryRows = [
    ['Proyecto', mode === 'quick' ? 'Cálculo independiente' : context.projectName || 'Sin proyecto'],
    ['Conjunto', mode === 'quick'
      ? 'Pieza independiente'
      : selectedGroupNames.join(', ') || 'Sin selección'],
    ['Piezas seleccionadas', selectedUnitCount || 'Sin selección'],
    ['Material', config.materialName || 'Sin material'],
  ];
  if (type === CALCULATION_TYPES.SHEET) {
    summaryRows.push(
      ['Área neta', calculation?.status === 'calculated' ? `${display(sheetMetrics.netArea)} m²` : 'Sin calcular'],
      ['Merma', calculation?.status === 'calculated' ? `${display(sheetMetrics.waste)}${sheetMetrics.wasteUnit === '%' ? '%' : ' m²'}` : 'Sin calcular'],
      ['Área requerida', calculation?.status === 'calculated' ? `${display(sheetMetrics.requiredArea)} m²` : 'Sin calcular'],
      ['Hojas', calculation?.status === 'calculated' ? sheetMetrics.requiredSheets : 'Sin calcular'],
      ...(sheetMetrics.source === 'candidate' ? [
        ['Aprovechamiento', `${display(sheetMetrics.utilization)}%`],
        ['Piezas colocadas', sheetMetrics.placedPieceCount],
        ['Piezas no colocadas', sheetMetrics.unplacedPieceCount],
      ] : []),
    );
  } else if ([CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE].includes(type)) {
    summaryRows.push(
      ['Área neta', calculation?.status === 'calculated' ? `${display(calculation.netArea)} m²` : 'Sin calcular'],
      ['Merma', calculation?.status === 'calculated' ? `${display(calculation.wastePercent)}%` : 'Sin calcular'],
      ['Área requerida', calculation?.status === 'calculated' ? `${display(calculation.areaWithWaste)} m²` : 'Sin calcular'],
      ...(type === CALCULATION_TYPES.GLASS ? [
        ['Tratamiento', calculation?.status === 'calculated' ? calculation.treatment || 'Sin tratamiento' : 'Sin calcular'],
      ] : []),
      ['Precio por m²', calculation?.status === 'calculated' ? money(config.price) : 'Sin calcular'],
    );
  } else if (type === CALCULATION_TYPES.LINEAR) {
    summaryRows.push(
      ['Longitud neta', calculation?.status === 'calculated' ? `${display(calculation.netLength)} m` : 'Sin calcular'],
      ['Merma', calculation?.status === 'calculated' ? `${display(calculation.wastePercent)}%` : 'Sin calcular'],
      ['Barras', calculation?.status === 'calculated' ? calculation.barsNeeded : 'Sin calcular'],
    );
  } else {
    summaryRows.push(
      ['Unidades', calculation?.status === 'calculated' ? calculation.requiredQuantity : 'Sin calcular'],
      ['Reserva', calculation?.status === 'calculated' ? calculation.reserveQuantity : 'Sin calcular'],
      ['Compra', calculation?.status === 'calculated' ? calculation.purchaseQuantity : 'Sin calcular'],
      ['Costo unitario', calculation?.status === 'calculated' ? money(config.price) : 'Sin calcular'],
    );
  }
  summaryRows.push(
    ['Costo', calculation?.status === 'calculated' ? money(calculation.cost) : 'Sin calcular'],
    ['Margen', calculation?.status === 'calculated' ? `${display(calculation.marginPercent)}%` : 'Sin calcular'],
    ['Precio propuesto', calculation?.status === 'calculated' ? money(calculation.proposedPrice) : 'Sin calcular'],
  );

  return (
    <section className="material-calculator" aria-label="BR Material Studio">
      <header className="material-calculator__header">
        <div>
          <span>Workspace especializado</span>
          <h2>BR Material Studio</h2>
          <p>
            {context.projectName || 'Proyecto sin nombre'} · {context.customerName || 'Cliente no registrado'}
            <strong> · {selectedUnitCount} pieza(s) seleccionada(s) · {sessionStatus}</strong>
          </p>
        </div>
        <div className="material-calculator__header-actions">
          <details className="material-studio-guide">
            <summary><BookOpen size={16} /> Guía rápida</summary>
            <ol>
              <li>Selecciona conjuntos, categorías o piezas reales.</li>
              <li>Elige un material y revisa su formato comercial.</li>
              <li>Calcular crea una propuesta; no modifica la cotización.</li>
              <li>Aplicar confirma el cambio en las piezas seleccionadas.</li>
              <li>Optimizar usa la distribución física del Cut Optimizer; la estimación solo compara áreas.</li>
            </ol>
          </details>
          {mode === 'project' && onChangeProject && (
            <button type="button" className="ghost" onClick={() => onChangeProject({ hasTemporaryChanges })}>
              Cambiar proyecto
            </button>
          )}
          <button type="button" className="ghost" onClick={() => onBack?.({ hasTemporaryChanges })}>
            <ArrowLeft size={16} /> Volver a Cotización
          </button>
          <Calculator size={28} aria-hidden="true" />
        </div>
      </header>

      <div className="calculator-mode-selector" aria-label="Modo de calculadora">
        <button
          type="button"
          className={mode === 'quick' ? 'is-selected' : ''}
          onClick={() => {
            setHasInteracted(true);
            setMode('quick');
            setCalculation(null);
          }}
        >
          <strong>Modo rápido</strong>
          <span>Cálculo independiente sin modificar un proyecto.</span>
        </button>
        <button
          type="button"
          className={mode === 'project' ? 'is-selected' : ''}
          onClick={() => {
            setHasInteracted(true);
            setMode('project');
            setCalculation(null);
          }}
        >
          <strong>Modo por proyecto</strong>
          <span>Selecciona conjuntos, piezas y materiales de la cotización.</span>
        </button>
      </div>

      <div className="material-calculator__workspace">
        <div className="material-calculator__steps">
          <section className="calculator-step calculator-step--type">
            <div className="calculator-step__number">1</div>
            <div>
              <h3>Tipo de cálculo</h3>
              <div className="calculation-type-grid">
                {TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={type === option.id ? 'is-selected' : ''}
                    onClick={() => {
                      setHasInteracted(true);
                      setType(option.id);
                      setCalculation(null);
                    }}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="calculator-step calculator-step--project">
            <div className="calculator-step__number">2</div>
            <div>
              <h3>Proyecto y conjuntos</h3>
              {mode === 'quick' ? (
                <div className="calculator-quick-piece">
                  <p>Cálculo independiente. Captura una pieza de referencia.</p>
                  <label>Nombre de la pieza
                    <input value={quickPiece.name} onChange={(event) => { setHasInteracted(true); setQuickPiece((current) => ({ ...current, name: event.target.value })); setCalculation(null); }} />
                  </label>
                  <label>Ancho de la pieza (cm)
                    <input type="number" min="0" value={quickPiece.width} onChange={(event) => { setHasInteracted(true); setQuickPiece((current) => ({ ...current, width: number(event.target.value) })); setCalculation(null); }} />
                  </label>
                  <label>Alto de la pieza (cm)
                    <input type="number" min="0" value={quickPiece.height} onChange={(event) => { setHasInteracted(true); setQuickPiece((current) => ({ ...current, height: number(event.target.value) })); setCalculation(null); }} />
                  </label>
                  <label>Largo lineal (cm)
                    <input type="number" min="0" value={quickPiece.length} onChange={(event) => { setHasInteracted(true); setQuickPiece((current) => ({ ...current, length: number(event.target.value) })); setCalculation(null); }} />
                  </label>
                  <label>Cantidad
                    <input type="number" min="1" value={quickPiece.quantity} onChange={(event) => { setHasInteracted(true); setQuickPiece((current) => ({ ...current, quantity: number(event.target.value) })); setCalculation(null); }} />
                  </label>
                </div>
              ) : (
                <>
                  <div className="calculator-project-context">
                    <strong>{context.projectName || 'Proyecto sin nombre'}</strong>
                    <span>{context.customerName || 'Cliente no registrado'}</span>
                  </div>
                  <div className="calculator-selection-actions">
                    <button type="button" className="ghost" onClick={() => { setHasInteracted(true); setSelectedPieceIds(pieces.map((piece) => piece.id)); setCalculation(null); }}>Seleccionar todo</button>
                    <button type="button" className="ghost" onClick={() => { setHasInteracted(true); setSelectedPieceIds([]); setCalculation(null); }}>Limpiar selección</button>
                    <label>
                      Seleccionar por material
                      <select
                        value=""
                        onChange={(event) => {
                          setHasInteracted(true);
                          setSelectedPieceIds(pieceIdsForMaterial(pieces, event.target.value));
                          setCalculation(null);
                        }}
                      >
                        <option value="">Elegir material</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>{material.nombre}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {pieceGroups.length > 0 && (
                    <div className="calculator-group-builder">
                      <label>Nuevo conjunto o mueble
                        <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
                      </label>
                      <button
                        type="button"
                        disabled={!newGroupName.trim() || !selectedPieceIds.length || readOnly}
                        onClick={() => {
                          onCreateGroup?.({
                            name: newGroupName.trim(),
                            pieceIds: selectedPieceIds,
                          });
                          setNewGroupName('');
                        }}
                      >
                        Crear conjunto con la selección
                      </button>
                    </div>
                  )}

                  {!pieceGroups.length && (
                    <div className="calculator-empty-state">
                      <strong>Esta cotización todavía no tiene conjuntos.</strong>
                      {pieces.length ? (
                        <div>
                          <label>Nombre del primer conjunto
                            <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
                          </label>
                          <button
                            type="button"
                            disabled={!newGroupName.trim() || readOnly}
                            onClick={() => {
                              onCreateGroup?.({
                                name: newGroupName.trim(),
                                pieceIds: pieces.map((piece) => piece.id),
                              });
                              setNewGroupName('');
                            }}
                          >
                            Crear conjunto con las piezas actuales
                          </button>
                        </div>
                      ) : <p>Este conjunto no tiene piezas.</p>}
                    </div>
                  )}

                  {groupedPieces.map((group) => (
                    <details key={group.id} className="calculator-piece-group" open>
                      <summary>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar conjunto ${group.name}`}
                          checked={group.pieces.length > 0 && group.pieces.every((piece) => selectedSet.has(piece.id))}
                          onChange={() => toggleGroup(group.id)}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <strong>{group.name}</strong>
                        <span>{pieceQuantityTotal(group.pieces)} pieza(s)</span>
                      </summary>
                      {group.organization.categories.map((category) => (
                        <details key={category.name} className="calculator-piece-category" open>
                          <summary>
                            <input
                              type="checkbox"
                              aria-label={`Seleccionar categoría ${category.name}`}
                              checked={category.pieces.every((piece) => selectedSet.has(piece.id))}
                              onChange={() => toggleCategory(category.pieces)}
                              onClick={(event) => event.stopPropagation()}
                            />
                            <strong>{category.name}</strong>
                            <span>{pieceQuantityTotal(category.pieces)} pieza(s)</span>
                          </summary>
                          {category.pieces.map((piece) => (
                            <label key={piece.id}>
                              <input
                                type="checkbox"
                                checked={selectedSet.has(piece.id)}
                                onChange={() => togglePiece(piece.id)}
                                onFocus={() => setFocusedPieceId(piece.id)}
                              />
                              <span>{piece.nombre || piece.name}</span>
                            </label>
                          ))}
                        </details>
                      ))}
                      {group.organization.direct.map((piece) => (
                        <label key={piece.id}>
                          <input
                            type="checkbox"
                            checked={selectedSet.has(piece.id)}
                            onChange={() => togglePiece(piece.id)}
                            onFocus={() => setFocusedPieceId(piece.id)}
                          />
                          <span>{piece.nombre || piece.name}</span>
                        </label>
                      ))}
                      {!group.pieces.length && <p>Este conjunto no tiene piezas.</p>}
                    </details>
                  ))}

                  {ungrouped.length > 0 && pieceGroups.length > 0 && (
                    <details className="calculator-piece-group" open>
                      <summary><strong>Piezas sin conjunto</strong><span>{pieceQuantityTotal(ungrouped)}</span></summary>
                      {ungrouped.map((piece) => (
                        <label key={piece.id}>
                          <input type="checkbox" checked={selectedSet.has(piece.id)} onChange={() => togglePiece(piece.id)} onFocus={() => setFocusedPieceId(piece.id)} />
                          <span>{piece.nombre || piece.name}</span>
                        </label>
                      ))}
                    </details>
                  )}
                  <strong className="calculator-selection-count">{selectedUnitCount} piezas seleccionadas</strong>
                </>
              )}
            </div>
          </section>

          <section className="calculator-step calculator-step--material">
            <div className="calculator-step__number">3</div>
            <div>
              <h3>Material y configuración</h3>
              <article className="calculator-material-card">
                <div>
                  <strong>{config.materialName || 'Material sin definir'}</strong>
                  <span>{config.thickness || '—'} mm</span>
                </div>
                {type === CALCULATION_TYPES.SHEET && (
                  <span>{display(config.formatWidth)} × {display(config.formatHeight)} {config.unit}</span>
                )}
                {type === CALCULATION_TYPES.LINEAR && (
                  <span>Barra de {display(config.barLength)} {config.unit}</span>
                )}
                <span>{money(config.price)} por {type === CALCULATION_TYPES.SHEET ? 'hoja' : type === CALCULATION_TYPES.LINEAR ? 'barra' : type === CALCULATION_TYPES.HARDWARE ? 'unidad' : 'm²'}</span>
                <span>Merma {display(config.wastePercent)}%</span>
                {type === CALCULATION_TYPES.SHEET && (
                  <span>Veta: {config.grainDirection ? 'respetada' : 'libre'} · Rotación: {config.allowRotation ? 'permitida' : 'bloqueada'}</span>
                )}
                <div className="calculator-material-card__actions">
                  <button
                    type="button"
                    className="ghost"
                    aria-expanded={materialEditorOpen}
                    aria-controls="calculator-material-editor"
                    onClick={() => setMaterialEditorOpen((current) => !current)}
                  >
                    Cambiar
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    aria-expanded={materialEditorOpen}
                    aria-controls="calculator-material-editor"
                    onClick={() => setMaterialEditorOpen(true)}
                  >
                    Editar cálculo
                  </button>
                  {mode === 'project' && (
                    <button
                      type="button"
                      disabled={readOnly || !selectedPieceIds.length}
                      onClick={applySelectionToWorkingSession}
                    >
                      Aplicar selección
                    </button>
                  )}
                </div>
              </article>
              <div id="calculator-material-editor" className="calculator-material-editor" hidden={!materialEditorOpen}>
              <div className="calculator-fields">
                <label>Material existente
                  <select
                    id="calculator-material-select"
                    value={config.materialId}
                    onChange={(event) => {
                      setHasInteracted(true);
                      const material = materials.find((item) => item.id === event.target.value);
                      setConfig((current) => ({
                        ...current,
                        materialId: event.target.value,
                        materialName: material?.nombre || current.materialName,
                        thickness: material?.grosor || current.thickness,
                        formatWidth: material?.ancho || current.formatWidth,
                        formatHeight: material?.alto || current.formatHeight,
                        barLength: material?.largo || current.barLength,
                        price: material?.costoUnitario || current.price,
                        wastePercent: material?.merma ?? current.wastePercent,
                      }));
                      setCalculation(null);
                    }}
                  >
                    <option value="">Crear material para este cálculo</option>
                    {materials.map((material) => <option key={material.id} value={material.id}>{material.nombre}</option>)}
                  </select>
                </label>
                <label>Nombre del material
                  <input value={config.materialName} onChange={(event) => updateConfig('materialName', event.target.value)} />
                </label>
                <label>Unidad de captura
                  <select
                    value={config.unit}
                    onChange={(event) => {
                      setHasInteracted(true);
                      const nextUnit = event.target.value;
                      setConfig((current) => ({
                        ...current,
                        unit: nextUnit,
                        formatWidth: convertLength(current.formatWidth, current.unit, nextUnit),
                        formatHeight: convertLength(current.formatHeight, current.unit, nextUnit),
                        barLength: convertLength(current.barLength, current.unit, nextUnit),
                        kerf: convertLength(current.kerf, current.unit, nextUnit),
                      }));
                      setCalculation(null);
                      setFeedback('');
                    }}
                  >
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                  </select>
                </label>
                <label>Espesor
                  <input type="number" min="0" value={config.thickness} onChange={(event) => updateConfig('thickness', number(event.target.value))} />
                </label>
                {[CALCULATION_TYPES.SHEET].includes(type) && (
                  <>
                    <label>Ancho de hoja ({config.unit})
                      <input type="number" min="0" value={config.formatWidth} onChange={(event) => updateConfig('formatWidth', number(event.target.value))} />
                    </label>
                    <label>Largo de hoja ({config.unit})
                      <input type="number" min="0" value={config.formatHeight} onChange={(event) => updateConfig('formatHeight', number(event.target.value))} />
                    </label>
                    <label>Kerf ({config.unit})
                      <input type="number" min="0" step="0.1" value={config.kerf} onChange={(event) => updateConfig('kerf', number(event.target.value))} />
                    </label>
                    <label className="calculator-check"><input type="checkbox" checked={config.allowRotation} onChange={(event) => updateConfig('allowRotation', event.target.checked)} /> Permitir rotación</label>
                    <label className="calculator-check"><input type="checkbox" checked={config.grainDirection} onChange={(event) => updateConfig('grainDirection', event.target.checked)} /> Respetar orientación de veta</label>
                  </>
                )}
                {type === CALCULATION_TYPES.LINEAR && (
                  <label>Largo comercial de barra ({config.unit})
                    <input type="number" min="0" value={config.barLength} onChange={(event) => updateConfig('barLength', number(event.target.value))} />
                  </label>
                )}
                {type === CALCULATION_TYPES.HARDWARE && (
                  <>
                    <label>Cantidad por pieza o conjunto
                      <input type="number" min="0" value={config.quantityPerPiece} onChange={(event) => updateConfig('quantityPerPiece', number(event.target.value))} />
                    </label>
                    <label>Reserva adicional
                      <input type="number" min="0" value={config.reserveQuantity} onChange={(event) => updateConfig('reserveQuantity', number(event.target.value))} />
                    </label>
                  </>
                )}
                {type === CALCULATION_TYPES.GLASS && (
                  <label>Tratamiento o acabado
                    <input value={config.treatment} onChange={(event) => updateConfig('treatment', event.target.value)} />
                  </label>
                )}
                <label>Precio por {type === CALCULATION_TYPES.SHEET ? 'hoja' : type === CALCULATION_TYPES.LINEAR ? 'barra' : type === CALCULATION_TYPES.HARDWARE ? 'unidad' : 'm²'}
                  <input type="number" min="0" value={config.price} onChange={(event) => updateConfig('price', number(event.target.value))} />
                </label>
                <label>Merma %
                  <input type="number" min="0" value={config.wastePercent} onChange={(event) => updateConfig('wastePercent', number(event.target.value))} />
                </label>
                <label>Margen propuesto %
                  <input type="number" min="0" value={config.marginPercent} onChange={(event) => updateConfig('marginPercent', number(event.target.value))} />
                </label>
              </div>
              </div>
              {!materials.length && <p className="calculator-inline-empty">No hay materiales disponibles. Puedes calcular uno nuevo sin modificar el catálogo.</p>}
            </div>
          </section>

          <section className="calculator-step calculator-step--pieces">
            <div className="calculator-step__number">4</div>
            <div>
              <h3>Piezas y medidas</h3>
              <TechnicalPieceBoard
                pieces={availablePieces}
                selectedPieceIds={effectiveSelection}
                focusedPieceId={focusedPieceId}
                onFocusPiece={setFocusedPieceId}
                onTogglePiece={(pieceId) => {
                  setFocusedPieceId(pieceId);
                  if (mode === 'project') togglePiece(pieceId);
                }}
              />
              {!selectedPieces.length ? <p className="calculator-inline-empty">Selecciona al menos una pieza.</p> : (
                <div className="calculator-pieces-table" role="table" aria-label="Piezas incluidas en el cálculo">
                  <div className="calculator-pieces-table__header" role="row">
                    <span>Conjunto</span><span>Pieza</span><span>Ancho</span><span>Alto/largo</span><span>Cantidad</span><span>Área/longitud</span><span>Material</span><span>Incluir</span>
                  </div>
                  {selectedPieces.map((piece) => {
                    const group = pieceGroups.find((item) => item.id === piece.groupId);
                    const width = mode === 'quick' ? quickPiece.width : piece.ancho ?? piece.width;
                    const height = mode === 'quick' ? quickPiece.height : piece.alto ?? piece.height;
                    const quantity = mode === 'quick' ? quickPiece.quantity : piece.cantidad ?? piece.quantity;
                    const widthDisplay = convertLength(width, 'cm', config.unit);
                    const heightDisplay = convertLength(height, 'cm', config.unit);
                    return (
                      <div
                        key={piece.id}
                        className={`calculator-pieces-table__row${piece.id === focusedPieceId ? ' is-focused' : ''}`}
                        role="row"
                        onMouseEnter={() => setFocusedPieceId(piece.id)}
                        onFocusCapture={() => setFocusedPieceId(piece.id)}
                      >
                        <span data-label="Conjunto">{mode === 'quick' ? 'Independiente' : group?.name || 'Sin conjunto'}</span>
                        <span data-label="Pieza">{piece.nombre || piece.name}</span>
                        <span data-label="Ancho">{display(widthDisplay)} {config.unit}</span>
                        <span data-label="Alto/largo">{display(heightDisplay)} {config.unit}</span>
                        <span data-label="Cantidad">{quantity}</span>
                        <span data-label="Área/longitud">{type === CALCULATION_TYPES.LINEAR ? `${display((height || 0) * quantity / 100)} m` : `${display((width || 0) * (height || 0) * quantity / 10000)} m²`}</span>
                        <span data-label="Material">{config.materialName}</span>
                        <span data-label="Incluir">
                          <Check size={16} /> Incluido
                          <button
                            type="button"
                            className="calculator-edit-piece"
                            onClick={() => onBack?.({
                              hasTemporaryChanges,
                              focusPieceId: piece.id,
                            })}
                          >
                            Editar
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <details className="field-help">
                <summary>¿Qué debo escribir aquí?</summary>
                <p>Para una puerta de 45 cm de ancho por 70 cm de alto: Ancho 45 cm, Alto 70 cm, Cantidad 1.</p>
                <p><strong>Ancho de la pieza:</strong> medida horizontal de corte.</p>
                <p><strong>Alto de la pieza:</strong> medida vertical de corte.</p>
              </details>
            </div>
          </section>

          <section className="calculator-step calculator-step--result">
            <div className="calculator-step__number">5</div>
            <div>
              <div className="calculator-result-head">
                <h3>Resultado y acciones</h3>
                <span className="calculator-proposal-status">{sessionStatus}</span>
                {calculation?.optimization && (
                  <div className="calculator-result-tabs" role="tablist" aria-label="Vista del resultado">
                    <button type="button" id="calculator-tab-calculation" role="tab" aria-controls="calculator-result-calculation" aria-selected={resultView === 'calculation'} className={resultView === 'calculation' ? 'is-selected' : ''} onClick={() => setResultView('calculation')}>Cálculo</button>
                    <button type="button" id="calculator-tab-optimization" role="tab" aria-controls="calculator-result-optimization" aria-selected={resultView === 'optimization'} className={resultView === 'optimization' ? 'is-selected' : ''} onClick={() => setResultView('optimization')}>Optimización</button>
                  </div>
                )}
              </div>
              {!calculation ? <p className="calculator-inline-empty">No hay un cálculo todavía.</p> : calculation.status === 'invalid' ? (
                <div className="calculator-errors" role="alert">
                  {calculation.errors.map((error) => <span key={error}>{error}</span>)}
                </div>
              ) : (
                <>
                  {resultView === 'calculation' ? <div id="calculator-result-calculation" className="calculator-result-grid" role="tabpanel" aria-labelledby="calculator-tab-calculation">
                    <div><span>Piezas seleccionadas</span><strong>{calculation.pieceCount}</strong></div>
                    {[CALCULATION_TYPES.SHEET, CALCULATION_TYPES.GLASS, CALCULATION_TYPES.SURFACE].includes(type) && (
                      <>
                        <div><span>Área neta</span><strong>{display(calculation.netArea)} m²</strong></div>
                        <div><span>Área con merma</span><strong>{display(calculation.areaWithWaste)} m²</strong></div>
                      </>
                    )}
                    {type === CALCULATION_TYPES.SHEET && (
                      <>
                        <div><span>Superficie útil por hoja</span><strong>{display(calculation.sheetArea)} m²</strong></div>
                        <div><span>Hojas teóricas</span><strong>{display(calculation.theoreticalSheets)}</strong></div>
                        <div><span>Hojas comerciales necesarias</span><strong>{calculation.commercialSheets}</strong></div>
                        <div><span>Aprovechamiento</span><strong>{display(calculation.utilization, 1)}%</strong></div>
                        <div><span>Sobrante estimado</span><strong>{display(calculation.estimatedWaste)} m²</strong></div>
                      </>
                    )}
                    {type === CALCULATION_TYPES.LINEAR && (
                      <>
                        <div><span>Longitud neta</span><strong>{display(calculation.netLength)} m</strong></div>
                        <div><span>Longitud con merma</span><strong>{display(calculation.lengthWithWaste)} m</strong></div>
                        <div><span>Barras necesarias</span><strong>{calculation.barsNeeded}</strong></div>
                        <div><span>Sobrante estimado</span><strong>{display(calculation.estimatedWaste)} m</strong></div>
                      </>
                    )}
                    {type === CALCULATION_TYPES.GLASS && (
                      <>
                        <div><span>Precio por m²</span><strong>{money(config.price)}</strong></div>
                        <div><span>Tratamiento</span><strong>{calculation.treatment || 'Sin tratamiento registrado'}</strong></div>
                      </>
                    )}
                    {type === CALCULATION_TYPES.HARDWARE && (
                      <>
                        <div><span>Cantidad requerida</span><strong>{calculation.requiredQuantity}</strong></div>
                        <div><span>Reserva adicional</span><strong>{calculation.reserveQuantity}</strong></div>
                        <div><span>Cantidad de compra</span><strong>{calculation.purchaseQuantity}</strong></div>
                        <div><span>Costo unitario</span><strong>{money(config.price)}</strong></div>
                      </>
                    )}
                    <div><span>Costo de compra</span><strong>{money(calculation.cost)}</strong></div>
                    <div><span>Precio propuesto</span><strong>{money(calculation.proposedPrice)}</strong></div>
                  </div> : (
                    <div id="calculator-result-optimization" className="calculator-optimization-panel" role="tabpanel" aria-labelledby="calculator-tab-optimization">
                      <SmartCutComparison
                        candidates={calculation.optimization.candidates}
                        recommendedCandidateId={calculation.optimization.recommendedCandidateId}
                        selectionReason={calculation.optimization.selectionReason}
                        candidateRanking={calculation.optimization.candidateRanking}
                        selectedCandidateId={selectedCandidateId}
                        selectionLabel={hasOpenedOptimizationSession
                          ? 'Selección de la sesión abierta'
                          : 'Selección visual local'}
                        onSelectCandidate={(candidateId) => {
                          const candidate = calculation.optimization.candidates.find(
                            (item) => item.id === candidateId,
                          ) || null;
                          setHasInteracted(true);
                          setSelectedCandidateId(candidateId);
                          if (hasOpenedOptimizationSession && candidate) {
                            onApplySelectionToSession(optimizationSessionInputForSelectedCandidate({
                              calculation,
                              candidateId,
                              type,
                              config,
                              selectedPieceIds,
                            }));
                            setHasInteracted(false);
                            setFeedback(
                              `${candidate.strategy === 'best-fit' ? 'Best Fit' : 'Shelf'} aplicado a la sesión abierta.`,
                            );
                          }
                        }}
                      />
                      <button type="button" className="ghost" onClick={() => setResultView('calculation')}>
                        Volver al cálculo
                      </button>
                    </div>
                  )}
                  {calculation.warnings.length > 0 && (
                    <div className="calculator-warnings">
                      {calculation.warnings.map((warning) => <span key={warning}>{warning}</span>)}
                    </div>
                  )}
                  {calculation.optimization && resultView === 'calculation' && (
                    <p className="calculator-optimization-state">
                      Optimización física: {calculation.optimization.validation.isPhysicallyValid ? 'válida' : 'requiere revisión'}.
                    </p>
                  )}
                </>
              )}

              {conflicts.length > 0 && (
                <div className="calculator-conflicts" role="alert">
                  <strong>Materiales existentes que serían reemplazados</strong>
                  {conflicts.map((conflict) => (
                    <span key={`${conflict.pieceId}-${conflict.materialId}`}>{conflict.pieceName}</span>
                  ))}
                  <button type="button" disabled={readOnly} onClick={() => apply(true)}>Reemplazar material de selección</button>
                </div>
              )}
              {feedback && <p className="calculator-feedback" role="status">{feedback}</p>}

              <div className="calculator-actions">
                <div className="calculator-actions__primary">
                  {mode === 'project' && (
                    <button type="button" disabled={readOnly || !selectedPieceIds.length} onClick={() => apply(false)}>
                      Aplicar a Cotización
                    </button>
                  )}
                  {type === CALCULATION_TYPES.SHEET && (
                    <button type="button" className="ghost" onClick={() => runCalculation(true)}>
                      <Scissors size={16} /> Optimizar cortes
                    </button>
                  )}
                  <button type="button" className="ghost" onClick={() => runCalculation(false)}>Calcular sin asignar</button>
                </div>
                <div className="calculator-actions__secondary">
                  <button type="button" className="ghost" onClick={() => setFeedback('Selección temporal conservada durante esta sesión.')}>
                    Guardar selección temporal
                  </button>
                  <button type="button" className="ghost" onClick={clearTemporaryCalculation}>
                    <Trash2 size={16} /> Limpiar
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <details className="material-calculator__summary" aria-label="Cadena del cálculo" open>
          <summary>Cómo se forma el resultado</summary>
          <strong>{TYPE_OPTIONS.find((option) => option.id === type)?.label}</strong>
          <div className="material-calculator__chain">
            {summaryRows.map(([label, value], index) => {
              const Icon = SUMMARY_ICONS[label] || Calculator;
              return (
              <div key={label} className="material-calculator__chain-row">
                <span className="material-calculator__chain-icon" aria-hidden="true"><Icon size={15} /></span>
                <div>
                  <small>{label}</small>
                  <strong>{value}</strong>
                </div>
                {index < summaryRows.length - 1 && <i aria-hidden="true">↓</i>}
              </div>
              );
            })}
          </div>
        </details>
      </div>
    </section>
  );
}
