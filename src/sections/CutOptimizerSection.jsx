import { Calculator, RefreshCw, Scissors } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { optimizeCuts } from '../lib/cut-optimizer/optimizer.js';
import { createUuid } from '../lib/identity/createUuid.js';
import { convertLength } from '../lib/material-calculator/engine.js';
import {
  createOptimizationSessionFromResult,
} from '../lib/optimization-session/index.js';
import OptimizationSessionsSection from './OptimizationSessionsSection.jsx';

const strategyLabels = {
  'largest-first': 'Largest First / Mayor área',
  'input-order': 'Orden capturado',
};

export function resolveVisibleCutOptimization({
  material,
  recalculatedResult,
  useRecalculatedResult = false,
} = {}) {
  const state = material?.optimization || {};
  const applied = material?.cutOptimization || null;
  const appliedIsValid = (
    !useRecalculatedResult
    && state.mode === 'smart-cut'
    && state.status === 'valid'
    && state.activeCandidateId
    && applied?.id === state.activeCandidateId
    && applied?.validation?.isPhysicallyValid === true
    && applied?.valid !== false
    && applied?.complete !== false
  );
  return {
    result: appliedIsValid ? applied : recalculatedResult,
    source: appliedIsValid ? 'applied' : 'recalculated',
  };
}

export function buildOptimizationSessionFromCurrentResult({
  result,
  material,
  workspaceId,
  quoteId,
  userId,
  createdAt,
  createId = createUuid,
} = {}) {
  const candidates = Array.isArray(result?.candidates) ? result.candidates : [];
  const candidateSignature = candidates.map((candidate) => candidate.id).join('|');
  return createOptimizationSessionFromResult({
    optimizationResult: result,
    id: createId(),
    executionId: createId(),
    workspaceId,
    quoteId,
    materialId: material?.id,
    createdAt,
    createdBy: userId,
    inputSignature: material?.optimization?.inputSignature
      || `cut-result-v1:${candidateSignature}`,
    selectedCandidateId: result?.id || null,
    configuration: {
      source: 'cut-optimizer-ui',
      sheetWidth: result?.config?.sheetWidth ?? 0,
      sheetHeight: result?.config?.sheetHeight ?? 0,
      kerf: result?.config?.kerf ?? 0,
      allowRotation: result?.config?.allowRotation ?? false,
      strategy: result?.config?.strategy || 'largest-first',
    },
    metadata: {
      source: 'cut-optimizer-ui',
      materialName: String(material?.nombre || material?.name || material?.id || ''),
      usedArea: result?.summary?.usedArea ?? 0,
      utilization: result?.summary?.utilization ?? 0,
      wasteArea: result?.summary?.wasteArea ?? 0,
      sheetsRequired: result?.summary?.requiredSheets ?? 0,
      selectedCandidateId: String(result?.id || ''),
      strategy: String(result?.strategy || result?.config?.strategy || ''),
    },
  });
}

export async function deleteOptimizationSessionAndClearActiveReference({
  session,
  activeSessionId,
  deleteSession,
  onActivateSessionReference,
  options,
} = {}) {
  const response = await deleteSession?.(session?.id, options);
  if (!response?.error && session?.id === activeSessionId) {
    await onActivateSessionReference?.(session.materialId, null);
  }
  return response;
}

export default function CutOptimizerSection({
  quote,
  decimal,
  readOnly = false,
  calculatorTransfer = null,
  contextQuoteId = null,
  optimizationSessions = null,
  optimizationSessionContext = null,
  onActivateSessionReference,
  onCalculateMaterial,
}) {
  const initialMaterial = quote.materialRows?.[0];
  const [run, setRun] = useState(0);
  const [config, setConfig] = useState({
    allowRotation: calculatorTransfer?.config?.allowRotation
      ?? initialMaterial?.cutConfig?.allowRotation
      ?? true,
    kerf: calculatorTransfer?.config
      ? convertLength(
        calculatorTransfer.config.kerf,
        calculatorTransfer.config.unit,
        'cm',
      ) || 0
      : initialMaterial?.cutConfig?.kerf ?? 0.3,
    strategy: initialMaterial?.cutConfig?.strategy || 'largest-first',
  });
  const [useRecalculatedResult, setUseRecalculatedResult] = useState(false);
  const [sessionCreationError, setSessionCreationError] = useState(null);
  const transferActive = Boolean(
    calculatorTransfer
    && (!calculatorTransfer.quoteId || calculatorTransfer.quoteId === contextQuoteId),
  );
  const selectedIds = useMemo(() => new Set(
    transferActive ? calculatorTransfer.selectedPieceIds : [],
  ), [calculatorTransfer, transferActive]);
  const material = transferActive ? calculatorTransfer.material : quote.materialRows?.[0];
  const sheetWidth = transferActive
    ? convertLength(
      calculatorTransfer.config.formatWidth,
      calculatorTransfer.config.unit,
      'cm',
    )
    : material?.ancho || 122;
  const sheetHeight = transferActive
    ? convertLength(
      calculatorTransfer.config.formatHeight,
      calculatorTransfer.config.unit,
      'cm',
    )
    : material?.alto || 244;
  const piezas = useMemo(() => quote.measureRows
    .filter((item) => !transferActive || selectedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      name: item.nombre,
      width: item.ancho,
      height: item.alto,
      quantity: item.cantidad,
    }))
    .filter((piece) => piece.width > 0 && piece.height > 0 && piece.quantity > 0),
  [quote.measureRows, selectedIds, transferActive]);
  const recalculatedResult = useMemo(() => optimizeCuts({
    sheetWidth,
    sheetHeight,
    allowRotation: config.allowRotation,
    kerf: config.kerf,
    strategy: config.strategy,
    pieces: piezas,
  }), [sheetWidth, sheetHeight, piezas, config.allowRotation, config.kerf, config.strategy, run]);
  const visibleOptimization = resolveVisibleCutOptimization({
    material,
    recalculatedResult,
    useRecalculatedResult,
  });
  const result = visibleOptimization.result;

  useEffect(() => {
    setUseRecalculatedResult(false);
    setSessionCreationError(null);
  }, [
    material?.optimization?.activeCandidateId,
    material?.optimization?.inputSignature,
  ]);
  const hasPieces = piezas.length > 0;
  const physicalUnplaced = result.unplacedPieces.filter((piece) => piece.reason === 'too-large');
  const pendingUnplaced = result.unplacedPieces.filter((piece) => piece.reason !== 'too-large');
  const statusText = hasPieces ? 'Resultado calculado' : 'Pendiente de optimizar';
  const { summary, purchasing, manufacturing, validation } = result;
  const sessionActorId = optimizationSessionContext?.userId || null;
  const sessionWorkspaceId = optimizationSessionContext?.workspaceId || null;
  const sessionQuoteId = optimizationSessionContext?.quoteId || contextQuoteId;
  const activeSessionId = material?.optimization?.activeSessionId || null;
  const canSaveSession = Boolean(
    !readOnly
    && hasPieces
    && material?.id
    && sessionWorkspaceId
    && sessionQuoteId
    && sessionActorId
    && optimizationSessions?.createSession
    && result?.validation?.isPhysicallyValid === true
  );

  async function saveCurrentSession() {
    setSessionCreationError(null);
    const creation = buildOptimizationSessionFromCurrentResult({
      result,
      material,
      workspaceId: sessionWorkspaceId,
      quoteId: sessionQuoteId,
      userId: sessionActorId,
      createdAt: new Date().toISOString(),
    });
    if (!creation.success) {
      setSessionCreationError({
        code: 'OPTIMIZATION_SESSION_CREATION_INVALID',
        message: creation.errors
          .map((item) => item.message)
          .filter(Boolean)
          .join(' ') || 'El resultado visible no permite crear una sesión válida.',
      });
      return { data: null, error: creation.errors };
    }
    return optimizationSessions.createSession(creation.session);
  }

  function mutationOptions(session) {
    return {
      expectedVersion: session.version,
      changedAt: new Date().toISOString(),
      changedBy: sessionActorId,
    };
  }

  async function activateSession(session) {
    const response = await optimizationSessions.setActiveSession(session.id, {
      quoteId: session.quoteId,
      materialId: session.materialId,
      changedAt: new Date().toISOString(),
      changedBy: sessionActorId,
    });
    if (!response.error) {
      await onActivateSessionReference?.(session.materialId, session.id);
    }
    return response;
  }

  function deleteSession(session) {
    return deleteOptimizationSessionAndClearActiveReference({
      session,
      activeSessionId,
      deleteSession: optimizationSessions.deleteSession,
      onActivateSessionReference,
      options: {
        expectedVersion: session.version,
        deletedAt: new Date().toISOString(),
        deletedBy: sessionActorId,
      },
    });
  }

  return (
    <section className="cut-section panel">
      <header className="cut-hero">
        <div>
          <span>Smart Cut Optimizer</span>
          <h2>Optimizador inteligente de corte</h2>
          <p>Resultado físico aplicado o recalculado mediante BR Smart Cut Engine.</p>
        </div>
        <div className="actions compact">
          <button
            type="button"
            className="ghost"
            onClick={() => onCalculateMaterial?.({
              selectedPieceIds: piezas.map((piece) => piece.id),
            })}
          >
            <Calculator size={16} /> Abrir BR Material Studio
          </button>
          <Scissors size={38} />
        </div>
      </header>

      <div className="cut-stats">
        <div><span>Estado</span><strong>{statusText}</strong></div>
        <div><span>Hojas necesarias</span><strong>{hasPieces ? purchasing.sheetsToBuy : '—'}</strong></div>
        <div><span>Área utilizada</span><strong>{hasPieces ? `${decimal(summary.usedArea / 10000)} m²` : 'Sin calcular'}</strong></div>
        <div><span>Aprovechamiento</span><strong>{hasPieces ? `${decimal(summary.utilization, 0)}%` : '—'}</strong></div>
      </div>

      {transferActive && (
        <p className="cut-alert is-clear" role="status">
          Calculando únicamente {piezas.length} pieza(s) enviadas desde la Calculadora de Materiales.
        </p>
      )}

      <p className="cut-alert is-clear" role="status">
        {visibleOptimization.source === 'applied'
          ? `Resultado aplicado a Cotización · ${result.strategy || 'Smart Cut'} · ${result.id}`
          : 'Resultado recalculado localmente. La selección persistida no cambia hasta aplicar una nueva propuesta.'}
      </p>

      <div className="cut-controls">
        <div className="cut-controls-head">
          <strong>Configuración del motor</strong>
          <span>Hoja: {sheetWidth} × {sheetHeight} cm · Kerf: {decimal(config.kerf * 10, 0)} mm / {config.kerf} cm · Rotación: {config.allowRotation ? 'Sí' : 'No'} · Estrategia: {strategyLabels[config.strategy]}</span>
        </div>
        <label className="cut-toggle">
          <input
            disabled={readOnly}
            type="checkbox"
            checked={config.allowRotation}
            onChange={(event) => {
              setUseRecalculatedResult(true);
              setConfig((current) => ({ ...current, allowRotation: event.target.checked }));
            }}
          />
          Permitir rotación
        </label>
        <label>
          Kerf / disco
          <input
            disabled={readOnly}
            type="number"
            min="0"
            step="0.1"
            value={config.kerf}
            onChange={(event) => {
              setUseRecalculatedResult(true);
              setConfig((current) => ({ ...current, kerf: Number(event.target.value) || 0 }));
            }}
          />
        </label>
        <label>
          Estrategia
          <select disabled={readOnly} value={config.strategy} onChange={(event) => {
            setUseRecalculatedResult(true);
            setConfig((current) => ({ ...current, strategy: event.target.value }));
          }}>
            <option value="largest-first">Mayor área primero</option>
            <option value="input-order">Orden capturado</option>
          </select>
        </label>
      </div>

      {hasPieces && (
        <div className={`cut-alert ${validation.isPhysicallyValid ? 'is-clear' : ''}`} role="status">
          {physicalUnplaced.length > 0 && (
            <div>
              <strong>No caben por tamaño físico</strong>
              <span>{physicalUnplaced.map((piece) => `${piece.name} (${piece.originalWidth} × ${piece.originalHeight} cm)`).join(', ')}</span>
            </div>
          )}
          {pendingUnplaced.length > 0 && (
            <div>
              <strong>Pendientes / no acomodadas</strong>
              <span>{pendingUnplaced.map((piece) => piece.name).join(', ')}</span>
            </div>
          )}
          {validation.isPhysicallyValid && (
            <div>
              <strong>Sin piezas problemáticas</strong>
              <span>{manufacturing.totalCuts} cortes dentro del plano. Todas las piezas capturadas quedaron dentro del plano de corte.</span>
            </div>
          )}
          {!validation.isPhysicallyValid && validation.warnings.length > 0 && (
            <div>
              <strong>Validación física</strong>
              <span>{validation.warnings.join(' ')}</span>
            </div>
          )}
        </div>
      )}

      {!readOnly && <button type="button" className="cut-rerun" onClick={() => {
        setUseRecalculatedResult(true);
        setRun((value) => value + 1);
      }}><RefreshCw size={18} /> Optimizar nuevamente</button>}

      <div className="cut-sheets">
        {result.sheets.filter((sheet) => sheet.pieces.length > 0).map((sheet) => (
          <article key={sheet.index} className="cut-sheet-card">
            <div className="cut-sheet-head">
              <h3>Hoja {sheet.index}</h3>
              <span>{decimal(sheet.efficiencyPercent, 0)}% aprovechado · merma {decimal(sheet.wasteArea / 10000)} m²</span>
            </div>
            <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} role="img" aria-label={`Hoja ${sheet.index}`}>
              <defs>
                <pattern id={`waste-${sheet.index}`} width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M0 8 L8 0" stroke="#dfcfb5" strokeWidth="1" opacity="0.55" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={sheet.width} height={sheet.height} rx="2" fill={`url(#waste-${sheet.index})`} stroke="#20362b" strokeWidth="1.5" />
              {sheet.pieces.map((piece) => {
                const labelFits = piece.width >= 34 && piece.height >= 18;
                return (
                <g key={piece.id}>
                  <rect x={piece.x} y={piece.y} width={piece.width} height={piece.height} fill="#e7f1ec" stroke="#22745f" strokeWidth="1" />
                  {labelFits && (
                    <>
                      <text x={piece.x + 3} y={piece.y + 10} fontSize="7" fontWeight="700" fill="#14241c">{piece.name}</text>
                      <text x={piece.x + 3} y={piece.y + 19} fontSize="6" fill="#526159">{piece.width} x {piece.height}{piece.rotated ? ' rotada' : ''}</text>
                    </>
                  )}
                </g>
              );})}
            </svg>
            <div className="cut-piece-list">
              {sheet.pieces.map((piece) => <span key={piece.id}>{piece.name} #{piece.index} · {piece.width} x {piece.height}{piece.rotated ? ' · rotada' : ''}</span>)}
            </div>
          </article>
        ))}
      </div>

      {optimizationSessions && (
        <OptimizationSessionsSection
          sessions={optimizationSessions.sessions}
          summary={optimizationSessions.summary}
          latestSession={optimizationSessions.latestSession}
          activeSessionId={activeSessionId}
          realtimeStatus={optimizationSessions.realtimeStatus}
          error={sessionCreationError || optimizationSessions.error}
          readOnly={readOnly}
          canCreate={canSaveSession}
          decimal={decimal}
          onCreate={saveCurrentSession}
          onReload={optimizationSessions.reload}
          onUpdate={(session) => (
            optimizationSessions.updateSession(session, session.version)
          )}
          onDelete={deleteSession}
          onSetActive={activateSession}
          onClose={(session) => optimizationSessions.closeSession(
            session.id,
            mutationOptions(session),
          )}
          onReopen={(session) => optimizationSessions.reopenSession(
            session.id,
            mutationOptions(session),
          )}
        />
      )}
    </section>
  );
}
