import { useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Scissors } from 'lucide-react';
import {
  getActiveOversizeProposal,
  getRecommendedOversizeAlternative,
  isOversizeProposalObsolete,
} from '../lib/oversize-resolution/index.js';

const REASON_LABELS = {
  EXCEEDS_SHEET_WIDTH: 'Excede el ancho útil',
  EXCEEDS_SHEET_LENGTH: 'Excede el largo útil',
  EXCEEDS_BOTH_AXES: 'Excede ambos ejes útiles',
  GRAIN_CONSTRAINT: 'La veta impide la orientación disponible',
  NO_VALID_ORIENTATION: 'No existe una orientación válida',
};

const TYPE_LABELS = {
  'larger-format': 'Formato comercial mayor',
  'balanced-split': 'División equilibrada',
  'optimized-split': 'División por aprovechamiento',
  'modular-coverage-vertical': 'Cobertura modular vertical',
  'modular-coverage-horizontal': 'Cobertura modular horizontal',
  'special-fabrication': 'Fabricación especial',
};

function amount(value, suffix = '') {
  return Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString('es-MX', { maximumFractionDigits: 2 })}${suffix}`
    : 'No disponible';
}

function AlternativeCard({
  alternative,
  recommended,
  disabled,
  onApply,
  onKeepUnresolved,
}) {
  const modular = alternative.modularCoverage;
  return (
    <article className={`oversize-alternative${recommended ? ' is-recommended' : ''}`}>
      <header>
        <div>
          <strong>{TYPE_LABELS[alternative.type] || alternative.type}</strong>
          {recommended && <span>Recomendada</span>}
        </div>
        <span className={alternative.feasible ? 'is-feasible' : 'is-review'}>
          {alternative.feasible ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          {alternative.feasible ? 'Factible' : 'Requiere revisión'}
        </span>
      </header>
      <dl>
        <div><dt>Formato</dt><dd>{alternative.sheetFormat
          ? `${amount(alternative.sheetFormat.width)} × ${amount(alternative.sheetFormat.height)} cm`
          : 'Sin optimización automática'}</dd></div>
        <div><dt>{modular ? 'Tiras' : 'Secciones'}</dt><dd>{modular?.stripsRequired ?? alternative.resultingPieces?.length ?? 0}</dd></div>
        <div><dt>{modular ? 'Unidades' : 'Hojas'}</dt><dd>{amount(alternative.estimatedSheets)}</dd></div>
        <div><dt>Desperdicio</dt><dd>{amount(alternative.estimatedWaste, ' cm²')}</dd></div>
        <div><dt>Costo</dt><dd>{amount(alternative.estimatedCost, ' MXN')}</dd></div>
        <div><dt>Uniones</dt><dd>{alternative.joints}</dd></div>
        <div><dt>Veta</dt><dd>{alternative.respectsGrain ? 'Respetada' : 'No compatible'}</dd></div>
        {modular && (
          <>
            <div><dt>Corte por tira</dt><dd>{amount(modular.cutLengthPerStrip, ' cm')}</dd></div>
            <div><dt>Cobertura bruta</dt><dd>{amount(modular.grossCoverage, ' cm')}</dd></div>
            <div><dt>Recorte lateral</dt><dd>{amount(modular.trimWidth, ' cm')}</dd></div>
            <div><dt>Sobrante por tira</dt><dd>{amount(modular.offcutLengthPerStrip, ' cm')}</dd></div>
            <div><dt>Orientación</dt><dd>{modular.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}</dd></div>
          </>
        )}
      </dl>
      {alternative.resultingPieces?.length > 1 && (
        <p className="oversize-alternative__pieces">
          {alternative.resultingPieces.map((piece) => (
            <span key={piece.id}>{amount(piece.width)} × {amount(piece.height)} cm</span>
          ))}
        </p>
      )}
      <p className="oversize-alternative__explanation">{alternative.explanation}</p>
      <details className="oversize-alternative__details">
        <summary>Ver detalles</summary>
        <p>{alternative.explanation}</p>
        {modular && (
          <p>
            Cobertura terminada: {amount(modular.netCoverage)} cm. Longitud total de corte:
            {' '}{amount(modular.totalLinearLength)} cm.
          </p>
        )}
      </details>
      {alternative.warnings?.map((warning) => <small key={warning}>{warning}</small>)}
      <div className="oversize-alternative__actions">
        <details>
          <summary>Ver propuesta</summary>
          <p>La pieza original se conserva. Nada se aplica sin tu confirmación.</p>
        </details>
        {alternative.requiresSpecialFabrication ? (
          <button type="button" className="ghost" disabled={disabled} onClick={onKeepUnresolved}>
            Mantener sin resolver
          </button>
        ) : (
          <button type="button" disabled={disabled || !alternative.feasible} onClick={onApply}>
            Aplicar propuesta
          </button>
        )}
      </div>
    </article>
  );
}

export default function OversizeResolutionPanel({
  resolutions = [],
  proposals = [],
  readOnly = false,
  onApplyAlternative,
  onKeepUnresolved,
  onRevert,
  defaultExpanded = false,
  onExpandedChange,
}) {
  const [openedPieceId, setOpenedPieceId] = useState(defaultExpanded ? '__first__' : '');
  if (!resolutions.length) return null;
  const expanded = Boolean(openedPieceId);
  function togglePiece(pieceId, isOpened) {
    const next = isOpened ? '' : pieceId;
    setOpenedPieceId(next);
    onExpandedChange?.(Boolean(next));
  }
  return (
    <section className={`oversize-resolution-panel${expanded ? ' is-expanded' : ''}`} aria-label="Resolución de piezas sobredimensionadas">
      <header className="oversize-resolution-panel__header">
        <div>
          <span>Resolución física asistida</span>
          <h4>{resolutions.some((resolution) => (
            resolution.alternatives?.some((alternative) => alternative.modularCoverage)
          )) ? 'Cobertura modular detectada' : 'Pieza sobredimensionada detectada'}</h4>
        </div>
        <Scissors size={22} aria-hidden="true" />
      </header>
      {resolutions.map((resolution, resolutionIndex) => {
        const piece = resolution.sourcePiece;
        const modularResolution = resolution.alternatives?.some((alternative) => (
          alternative.modularCoverage
        ));
        const isOpened = openedPieceId === piece.id
          || (openedPieceId === '__first__' && resolutionIndex === 0);
        const proposal = getActiveOversizeProposal(proposals, piece.id);
        const recommendation = getRecommendedOversizeAlternative(resolution);
        const obsolete = proposal && isOversizeProposalObsolete(proposal, resolution);
        return (
          <article key={piece.id} className="oversize-resolution-piece">
            <div className="oversize-resolution-piece__summary">
              <div>
                <strong>{piece.name}</strong>
                <span>{amount(piece.width)} × {amount(piece.height)} cm</span>
              </div>
              <div>
                <span>Formato actual</span>
                <strong>{amount(resolution.sheet.width)} × {amount(resolution.sheet.height)} cm</strong>
              </div>
              <div>
                <span>Motivo</span>
                <strong>{modularResolution
                  ? 'Superficie compuesta por tiras'
                  : REASON_LABELS[resolution.reason] || resolution.reason}</strong>
              </div>
              <div>
                <span>Exceso</span>
                <strong>
                  {resolution.excess.width > 0 ? `${amount(resolution.excess.width)} cm ancho` : ''}
                  {resolution.excess.width > 0 && resolution.excess.length > 0 ? ' · ' : ''}
                  {resolution.excess.length > 0 ? `${amount(resolution.excess.length)} cm largo` : ''}
                </strong>
              </div>
            </div>
            <p>
              {resolution.alternatives.length} solución(es) disponible(s).
              {' '}Recomendación: {recommendation?.explanation || 'requiere revisión manual'}
            </p>
            <button
              type="button"
              className="ghost oversize-resolution-piece__toggle"
              aria-expanded={isOpened}
              onClick={() => togglePiece(piece.id, isOpened)}
            >
              Resolver pieza
            </button>
            {obsolete && (
              <p className="oversize-resolution-obsolete" role="alert">
                La pieza cambió. Vuelve a calcular las soluciones.
              </p>
            )}
            {proposal?.status === 'applied' ? (
              <div className="oversize-resolution-applied">
                <CheckCircle2 size={17} />
                <span>Propuesta aplicada. La pieza original permanece trazable.</span>
                <button type="button" className="ghost" disabled={readOnly} onClick={() => onRevert?.(proposal)}>
                  <RotateCcw size={15} /> Deshacer resolución
                </button>
              </div>
            ) : isOpened ? (
              <div className="oversize-alternatives">
                {resolution.alternatives.map((alternative) => (
                  <AlternativeCard
                    key={alternative.id}
                    alternative={alternative}
                    recommended={alternative.id === resolution.recommendationId}
                    disabled={readOnly || obsolete}
                    onApply={() => onApplyAlternative?.(resolution, alternative)}
                    onKeepUnresolved={() => onKeepUnresolved?.(resolution, alternative)}
                  />
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
