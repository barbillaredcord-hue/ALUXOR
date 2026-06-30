import { RefreshCw, Scissors } from 'lucide-react';
import { useMemo, useState } from 'react';
import { optimizeCuts } from '../lib/cut-optimizer/optimizer.js';

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
  const piezas = quote.measureRows.map((item) => ({
    name: item.nombre,
    width: item.ancho,
    height: item.alto,
    quantity: item.cantidad,
  }));
  const result = useMemo(() => optimizeCuts({
    sheetWidth,
    sheetHeight,
    allowRotation: config.allowRotation,
    kerf: config.kerf,
    strategy: config.strategy,
    pieces: piezas,
  }), [sheetWidth, sheetHeight, piezas, config.allowRotation, config.kerf, config.strategy, run]);

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
        <div><span>Hojas necesarias</span><strong>{result.sheetCount}</strong></div>
        <div><span>Área utilizada</span><strong>{decimal(result.totalUsedArea / 10000)} m²</strong></div>
        <div><span>Merma</span><strong>{decimal(result.totalWasteArea / 10000)} m²</strong></div>
        <div><span>Aprovechamiento</span><strong>{decimal(result.efficiencyPercent, 0)}%</strong></div>
      </div>

      <div className="cut-controls">
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

      {result.unplacedPieces.length > 0 && (
        <div className="cut-alert" role="alert">
          <strong>Piezas sin acomodar</strong>
          <span>{result.unplacedPieces.map((piece) => piece.name).join(', ')}</span>
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
