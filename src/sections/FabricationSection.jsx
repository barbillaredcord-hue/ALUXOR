import { Drill, Factory, Hammer, Ruler, Timer, Wrench } from 'lucide-react';
import { useState } from 'react';

const fabricationChecklist = [
  'Revisar medidas',
  'Revisar plano',
  'Cortar',
  'Cantear',
  'Perforar',
  'Ensamblar',
  'Limpiar',
  'Preparar instalación',
];

const progressSteps = ['Pendiente', 'Corte', 'Armado', 'Control de calidad', 'Listo para instalar'];

export default function FabricationSection({ form, quote, decimal }) {
  const [pieceStatus, setPieceStatus] = useState({});
  const [notes, setNotes] = useState('');
  const material = quote.materialRows?.[0];
  const estimatedHours = Math.max(2, Math.ceil((quote.measureRows.length || 1) * 1.5));
  const remainingHours = Math.max(1, estimatedHours - 1);

  return (
    <section className="fabrication-section panel">
      <header className="fabrication-hero">
        <div>
          <span>Smart Workshop</span>
          <h2>¿Qué hay que fabricar?</h2>
          <p>{form.producto || 'Proyecto sin nombre'} · {form.clienteNombre || 'Cliente pendiente'}</p>
        </div>
        <Factory size={38} />
      </header>

      <div className="fabrication-dashboard">
        <div><span>Proyecto activo</span><strong>{form.producto || 'Proyecto'}</strong></div>
        <div><span>Estado</span><strong>{form.estadoCotizacion || 'Pendiente'}</strong></div>
        <div><span>Responsable</span><strong>Taller ALUXOR</strong></div>
        <div><span>Fecha compromiso</span><strong>{form.entrega || 'Por definir'}</strong></div>
        <div><span>Tiempo estimado</span><strong>{estimatedHours} h</strong></div>
        <div><span>Tiempo restante</span><strong>{remainingHours} h</strong></div>
      </div>

      <div className="fabrication-layout">
        <article className="fabrication-card fabrication-pieces">
          <h3><Hammer size={18} /> Piezas del día</h3>
          <div className="fabrication-piece-grid">
            {quote.measureRows.map((item) => (
              <div key={item.id} className="fabrication-piece">
                <strong>{item.nombre}</strong>
                <span>{item.cantidad} pieza(s)</span>
                <span>{item.ancho} x {item.alto} x {item.fondo} cm</span>
                <span>{material?.nombre || form.materialCotizacion || 'Material pendiente'} · {item.grosorMaterial} mm</span>
                <select value={pieceStatus[item.id] || 'Pendiente'} onChange={(event) => setPieceStatus((current) => ({ ...current, [item.id]: event.target.value }))}>
                  <option>Pendiente</option>
                  <option>Cortando</option>
                  <option>Armando</option>
                  <option>Terminado</option>
                </select>
              </div>
            ))}
          </div>
        </article>

        <article className="fabrication-card">
          <h3><Ruler size={18} /> Orden de corte</h3>
          <div className="cut-list">
            {quote.measureRows.map((item) => (
              <div key={item.id}>
                <strong>{material?.nombre || 'Material'}</strong>
                <span>{item.ancho} x {item.alto}</span>
                <em>{item.cantidad} pieza(s)</em>
              </div>
            ))}
          </div>
        </article>

        <article className="fabrication-card">
          <h3><Wrench size={18} /> Materiales necesarios</h3>
          <div className="fabrication-materials">
            {quote.materialRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{decimal(item.rowQuantity)} {item.unidad}</span>
                <em>Faltante</em>
              </div>
            ))}
          </div>
        </article>

        <article className="fabrication-card">
          <h3><Drill size={18} /> Checklist de fabricación</h3>
          <div className="fabrication-checklist">
            {fabricationChecklist.map((item) => (
              <label key={item}><input type="checkbox" /> {item}</label>
            ))}
          </div>
        </article>

        <article className="fabrication-card fabrication-progress-card">
          <h3><Timer size={18} /> Progreso</h3>
          <div className="fabrication-progress">
            {progressSteps.map((item, index) => <span key={item} className={index === 1 ? 'active' : ''}>{item}</span>)}
          </div>
        </article>

        <article className="fabrication-card fabrication-notes">
          <h3>Observaciones del taller</h3>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas de corte, armado, acabado o instalación..." />
        </article>
      </div>
    </section>
  );
}
