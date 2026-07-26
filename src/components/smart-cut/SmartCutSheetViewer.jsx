import { Layers3 } from 'lucide-react';

function display(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('es-MX', { maximumFractionDigits: digits });
}

function sheetRegions(sheet, canonical, legacy) {
  const regions = sheet?.[canonical] ?? sheet?.[legacy];
  return Array.isArray(regions) ? regions : [];
}

function pieceName(piece, index) {
  return piece?.name || piece?.nombre || piece?.sourceId || `Pieza ${index + 1}`;
}

export default function SmartCutSheetViewer({ candidate }) {
  const sheets = Array.isArray(candidate?.sheets) ? candidate.sheets : [];
  if (!sheets.length) {
    return (
      <section className="smart-cut-sheet-viewer" aria-labelledby="smart-cut-sheets-title">
        <h4 id="smart-cut-sheets-title"><Layers3 size={18} aria-hidden="true" /> Hojas y colocación</h4>
        <p className="smart-cut-empty-inline">Este candidato no contiene hojas para visualizar.</p>
      </section>
    );
  }

  return (
    <section className="smart-cut-sheet-viewer" aria-labelledby="smart-cut-sheets-title">
      <div className="smart-cut-section-heading">
        <h4 id="smart-cut-sheets-title"><Layers3 size={18} aria-hidden="true" /> Hojas y colocación</h4>
        <div className="smart-cut-legend" aria-label="Leyenda del plano">
          <span><i className="is-piece" aria-hidden="true" /> Pieza</span>
          <span><i className="is-blocked" aria-hidden="true" /> Bloqueada</span>
          <span><i className="is-reserved" aria-hidden="true" /> Reservada</span>
        </div>
      </div>
      <div className="smart-cut-sheet-grid">
        {sheets.map((sheet, sheetIndex) => {
          const blocked = sheetRegions(sheet, 'blockedRegions', 'zonasBloqueadas');
          const reserved = sheetRegions(sheet, 'reservedRegions', 'zonasReservadas');
          const pieces = Array.isArray(sheet.pieces) ? sheet.pieces : [];
          const width = Number(sheet.width ?? sheet.ancho ?? sheet.anchoHoja) || 1;
          const height = Number(sheet.height ?? sheet.alto ?? sheet.altoHoja) || 1;
          const titleId = `smart-cut-sheet-${candidate.id}-${sheet.index ?? sheetIndex + 1}`;
          return (
            <article className="smart-cut-sheet" key={sheet.index ?? sheetIndex}>
              <header>
                <div>
                  <strong>Hoja {sheet.index ?? sheetIndex + 1}</strong>
                  <span>{display(width)} × {display(height)} unidades</span>
                </div>
                <span>{display(sheet.efficiencyPercent)}% aprovechado</span>
              </header>
              <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-labelledby={`${titleId}-title ${titleId}-description`}
                preserveAspectRatio="xMidYMid meet"
              >
                <title id={`${titleId}-title`}>{`Plano de corte de la hoja ${sheet.index ?? sheetIndex + 1}`}</title>
                <desc id={`${titleId}-description`}>
                  {pieces.length} pieza(s), {blocked.length} región(es) bloqueada(s) y {reserved.length} región(es) reservada(s).
                </desc>
                <rect className="smart-cut-sheet__surface" x="0" y="0" width={width} height={height} />
                {blocked.map((region, index) => (
                  <rect key={region.id || index} className="smart-cut-sheet__blocked" x={region.x} y={region.y} width={region.width} height={region.height} />
                ))}
                {reserved.map((region, index) => (
                  <rect key={region.id || index} className="smart-cut-sheet__reserved" x={region.x} y={region.y} width={region.width} height={region.height} />
                ))}
                {pieces.map((piece, index) => (
                  <g key={piece.id || index} className="smart-cut-sheet__piece">
                    <rect x={piece.x} y={piece.y} width={piece.width ?? piece.ancho} height={piece.height ?? piece.alto} rx="1" />
                    <title>{`${pieceName(piece, index)} · ${piece.rotated ? 'Rotada' : 'Sin rotación'}`}</title>
                  </g>
                ))}
              </svg>
              {!blocked.length && !reserved.length && (
                <p className="smart-cut-regions-empty">Sin regiones bloqueadas o reservadas registradas en este candidato.</p>
              )}
              <ul className="smart-cut-piece-list" aria-label={`Piezas de la hoja ${sheet.index ?? sheetIndex + 1}`}>
                {pieces.map((piece, index) => (
                  <li key={piece.id || index}>
                    <strong>{pieceName(piece, index)}</strong>
                    <span>{display(piece.width ?? piece.ancho)} × {display(piece.height ?? piece.alto)} · {piece.rotated ? 'Rotada' : 'Orientación original'}</span>
                  </li>
                ))}
              </ul>
              <footer>Desperdicio: <strong>{display(sheet.wasteArea ?? sheet.areaDesperdiciada)} u²</strong></footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
