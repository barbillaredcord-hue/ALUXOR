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
        {result.hojas.filter((sheet) => sheet.piezasColocadas.length > 0).map((sheet) => (
          <article key={sheet.index} className="cut-sheet-card">
            <div className="cut-sheet-head">
              <h3>Hoja {sheet.index}</h3>
              <span>{decimal(sheet.porcentajeAprovechamiento, 0)}% aprovechado · merma {decimal(sheet.areaDesperdiciada / 10000)} m²</span>
            </div>
            <svg viewBox={`0 0 ${sheet.anchoHoja} ${sheet.altoHoja}`} role="img" aria-label={`Hoja ${sheet.index}`}>
              <defs>
                <pattern id={`waste-${sheet.index}`} width="8" height="8" patternUnits="userSpaceOnUse">
                  <path d="M0 8 L8 0" stroke="#dfcfb5" strokeWidth="1" opacity="0.55" />
                </pattern>
              </defs>
              <rect x="0" y="0" width={sheet.anchoHoja} height={sheet.altoHoja} rx="2" fill={`url(#waste-${sheet.index})`} stroke="#20362b" strokeWidth="1.5" />
              {sheet.piezasColocadas.map((piece) => {
                const labelFits = piece.ancho >= 34 && piece.alto >= 18;
                return (
                <g key={piece.id}>
                  <rect x={piece.x} y={piece.y} width={piece.ancho} height={piece.alto} fill="#e7f1ec" stroke="#22745f" strokeWidth="1" />
                  {labelFits && (
                    <>
                      <text x={piece.x + 3} y={piece.y + 10} fontSize="7" fontWeight="700" fill="#14241c">{piece.nombre}</text>
                      <text x={piece.x + 3} y={piece.y + 19} fontSize="6" fill="#526159">{piece.ancho} x {piece.alto}</text>
                    </>
                  )}
                </g>
              );})}
            </svg>
            <div className="cut-piece-list">
              {sheet.piezasColocadas.map((piece) => <span key={piece.id}>{piece.nombre} #{piece.indice} · {piece.ancho} x {piece.alto}</span>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
