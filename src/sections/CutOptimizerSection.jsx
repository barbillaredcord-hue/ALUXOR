import { RefreshCw, Scissors } from 'lucide-react';
import { useMemo, useState } from 'react';
import { optimizeCuts } from '../lib/cut-optimizer/optimizer.js';

const strategyLabels = {
  'largest-first': 'Largest First / Mayor área',
  'input-order': 'Orden capturado',
};

export default function CutOptimizerSection({ quote, decimal }) {
  const [run, setRun] = useState(0);
  const [config, setConfig] = useState({
    allowRotation: true,
    kerf: 0.3,
    strategy: 'largest-first',
  });
  const material = quote.materialRows?.[0];
  const sheetWidth = material?.ancho || 122;
  const sheetHeight = material?.alto || 244;
  const piezas = useMemo(() => quote.measureRows.map((item) => ({
    name: item.nombre,
    width: item.ancho,
    height: item.alto,
    quantity: item.cantidad,
  })).filter((piece) => piece.width > 0 && piece.height > 0 && piece.quantity > 0), [quote.measureRows]);
  const result = useMemo(() => optimizeCuts({
    sheetWidth,
    sheetHeight,
    allowRotation: config.allowRotation,
    kerf: config.kerf,
    strategy: config.strategy,
    pieces: piezas,
  }), [sheetWidth, sheetHeight, piezas, config.allowRotation, config.kerf, config.strategy, run]);
  const hasPieces = piezas.length > 0;
  const physicalUnplaced = result.unplacedPieces.filter((piece) => piece.reason === 'too-large');
  const pendingUnplaced = result.unplacedPieces.filter((piece) => piece.reason !== 'too-large');
  const statusText = hasPieces ? 'Resultado calculado' : 'Pendiente de optimizar';
  const { summary, purchasing, manufacturing, validation } = result;

  return (
    <section className="cut-section panel">
      <header className="cut-hero">
        <div>
          <span>Smart Cut Optimizer</span>
          <h2>Optimizador inteligente de corte</h2>
          <p>Primera versión visual con algoritmo shelf simple.</p>
        </div>
        <Scissors size={38} />
      </header>

      <div className="cut-stats">
        <div><span>Estado</span><strong>{statusText}</strong></div>
        <div><span>Hojas necesarias</span><strong>{hasPieces ? purchasing.sheetsToBuy : '—'}</strong></div>
        <div><span>Área utilizada</span><strong>{hasPieces ? `${decimal(summary.usedArea / 10000)} m²` : 'Sin calcular'}</strong></div>
        <div><span>Aprovechamiento</span><strong>{hasPieces ? `${decimal(summary.utilization, 0)}%` : '—'}</strong></div>
      </div>

      <div className="cut-controls">
        <div className="cut-controls-head">
          <strong>Configuración del motor</strong>
          <span>Hoja: {sheetWidth} × {sheetHeight} cm · Kerf: {decimal(config.kerf * 10, 0)} mm / {config.kerf} cm · Rotación: {config.allowRotation ? 'Sí' : 'No'} · Estrategia: {strategyLabels[config.strategy]}</span>
        </div>
        <label className="cut-toggle">
          <input
            type="checkbox"
            checked={config.allowRotation}
            onChange={(event) => setConfig((current) => ({ ...current, allowRotation: event.target.checked }))}
          />
          Permitir rotación
        </label>
        <label>
          Kerf / disco
          <input
            type="number"
            min="0"
            step="0.1"
            value={config.kerf}
            onChange={(event) => setConfig((current) => ({ ...current, kerf: Number(event.target.value) || 0 }))}
          />
        </label>
        <label>
          Estrategia
          <select value={config.strategy} onChange={(event) => setConfig((current) => ({ ...current, strategy: event.target.value }))}>
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

      <button type="button" className="cut-rerun" onClick={() => setRun((value) => value + 1)}><RefreshCw size={18} /> Optimizar nuevamente</button>

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
    </section>
  );
}
