import {
  CheckCircle2,
  ClipboardList,
  Image,
  Layers,
  PackageCheck,
  PenLine,
  Printer,
  Ruler,
  Wrench,
} from 'lucide-react';

const checklist = [
  { label: 'Material comprado', status: 'Pendiente', icon: PackageCheck },
  { label: 'Corte', status: 'En proceso', icon: Ruler },
  { label: 'Armado', status: 'Pendiente', icon: Wrench },
  { label: 'Acabado', status: 'Pendiente', icon: Layers },
  { label: 'Instalación', status: 'Pendiente', icon: ClipboardList },
  { label: 'Entregado', status: 'Completado', icon: CheckCircle2 },
];

function materialStatus(item) {
  if (!item?.nombre) return 'Falta material';
  if (item.costTotal > 0 && item.saleTotal > 0) return 'Completo';
  return 'Pendiente';
}

export default function ProductionSection({ form, quote, money, decimal, openPrint }) {
  const folio = form.folioManual || quote.folio || 'Pendiente';
  const fecha = new Date().toLocaleDateString('es-MX');
  const progress = 42;
  const observaciones = form.notasInternas || form.notasCliente || form.condiciones || 'Sin observaciones capturadas para taller.';

  return (
    <section className="production-section panel">
      <header className="production-hero">
        <div>
          <span>Centro de producción</span>
          <h2>{form.producto || 'Proyecto sin nombre'}</h2>
          <p>{form.clienteNombre || 'Cliente pendiente'} · Folio {folio} · {fecha}</p>
        </div>
        <div className="production-status">
          <ClipboardList size={18} />
          <strong>{form.estadoCotizacion || 'Pendiente'}</strong>
        </div>
      </header>

      <div className="production-progress-card">
        <div>
          <span>Avance visual</span>
          <strong>{progress}%</strong>
        </div>
        <div className="production-progress"><span style={{ width: `${progress}%` }} /></div>
      </div>

      <div className="production-summary">
        <div><span>Total cliente</span><strong>{money(quote.total)}</strong></div>
        <div><span>Costo interno</span><strong>{money(quote.internalTotal)}</strong></div>
        <div><span>Utilidad</span><strong>{money(quote.profit)}</strong></div>
      </div>

      <div className="production-board">
        <article className="production-card production-info">
          <h3>Información del proyecto</h3>
          <div className="production-list">
            <div><strong>Proyecto</strong><span>{form.producto || 'Proyecto sin nombre'}</span></div>
            <div><strong>Cliente</strong><span>{form.clienteNombre || 'Cliente pendiente'}</span></div>
            <div><strong>Entrega</strong><span>{form.entrega || 'Sin fecha definida'}</span></div>
          </div>
        </article>

        <article className="production-card production-materials-card">
          <h3>Materiales</h3>
          <div className="production-list">
            {quote.materialRows.map((item) => {
              const status = materialStatus(item);
              return (
                <div key={item.id} className="production-material-row">
                  <strong>{item.nombre}</strong>
                  <span>{decimal(item.rowQuantity)} {item.unidad} · {item.tipoCompra} · {item.nota || 'Sin nota'}</span>
                  <em className={`production-badge production-badge-${status.toLowerCase().replace(/\s+/g, '-')}`}>{status}</em>
                </div>
              );
            })}
          </div>
        </article>

        <article className="production-card">
          <h3>Herrajes</h3>
          <div className="production-list">
            {quote.accessoryRows.length > 0 ? quote.accessoryRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{decimal(item.rowQuantity, 0)} pza(s) · {item.tipoCompra} · {money(item.costTotal)}</span>
              </div>
            )) : <p>Sin herrajes capturados.</p>}
          </div>
        </article>

        <article className="production-card">
          <h3>Medidas</h3>
          <div className="production-list">
            {quote.measureRows.map((item) => (
              <div key={item.id}>
                <strong>{item.nombre}</strong>
                <span>{item.ancho} x {item.alto} x {item.fondo} cm · {decimal(item.areaTotal)} m² · {decimal(item.linearTotal)} m</span>
              </div>
            ))}
          </div>
        </article>

        <article className="production-card production-plan-card">
          <h3>Plano</h3>
          <div className="production-plan-placeholder">
            <Image size={32} />
            <strong>Espacio reservado</strong>
            <span>SVG · PDF · Imagen</span>
          </div>
        </article>

        <article className="production-card production-notes">
          <h3><PenLine size={16} /> Observaciones</h3>
          <p>{observaciones}</p>
        </article>

        <article className="production-card production-checklist">
          <h3>Checklist de taller</h3>
          <div>
            {checklist.map(({ label, status, icon: Icon }) => (
              <article key={label} className={`production-task production-task-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                <Icon size={22} />
                <strong>{label}</strong>
                <span>{status}</span>
              </article>
            ))}
          </div>
        </article>
      </div>

      <div className="actions production-actions">
        <button type="button" onClick={() => openPrint('business')}><Printer size={18} /> Imprimir Orden</button>
        <span>Placeholder temporal: usa la impresión interna existente.</span>
      </div>
    </section>
  );
}
