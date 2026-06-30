import { RefreshCw, Scissors } from 'lucide-react';
import { useMemo, useState } from 'react';
import { optimizeCuts } from '../lib/cut-optimizer/optimizer.js';

export default function CutOptimizerSection({ quote, decimal }) {
  const [run, setRun] = useState(0);
  const material = quote.materialRows?.[0];
  const anchoHoja = material?.ancho || 122;
  const altoHoja = material?.alto || 244;
  const piezas = quote.measureRows.map((item) => ({
    nombre: item.nombre,
    ancho: item.ancho,
    alto: item.alto,
    cantidad: item.cantidad,
  }));
  const result = useMemo(() => optimizeCuts({ anchoHoja, altoHoja, piezas }), [anchoHoja, altoHoja, piezas, run]);

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
        <div><span>Hojas necesarias</span><strong>{result.cantidadHojas}</strong></div>
        <div><span>Área utilizada</span><strong>{decimal(result.areaUtilizada / 10000)} m²</strong></div>
        <div><span>Merma</span><strong>{decimal(result.areaDesperdiciada / 10000)} m²</strong></div>
        <div><span>Aprovechamiento</span><strong>{decimal(result.porcentajeAprovechamiento, 0)}%</strong></div>
      </div>

      <button type="button" className="cut-rerun" onClick={() => setRun((value) => value + 1)}><RefreshCw size={18} /> Optimizar nuevamente</button>

      <div className="cut-sheets">
        {result.hojas.map((sheet) => (
          <article key={sheet.index} className="cut-sheet-card">
            <h3>Hoja {sheet.index}</h3>
            <svg viewBox={`0 0 ${sheet.ancho} ${sheet.alto}`} role="img" aria-label={`Hoja ${sheet.index}`}>
              <rect x="0" y="0" width={sheet.ancho} height={sheet.alto} rx="2" fill="#fffdf8" stroke="#20362b" strokeWidth="1.5" />
              {sheet.pieces.map((piece) => (
                <g key={piece.id}>
                  <rect x={piece.x} y={piece.y} width={piece.ancho} height={piece.alto} fill="#e7f1ec" stroke="#22745f" strokeWidth="1" />
                  <text x={piece.x + 3} y={piece.y + 10} fontSize="7" fill="#14241c">{piece.nombre}</text>
                </g>
              ))}
            </svg>
            <div className="cut-piece-list">
              {sheet.pieces.map((piece) => <span key={piece.id}>{piece.nombre} · {piece.ancho} x {piece.alto}</span>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
