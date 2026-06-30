import {
  CheckCircle2,
  ClipboardList,
  Hammer,
  Image,
  Layers,
  PackageCheck,
  PenLine,
  Printer,
  Ruler,
  Wrench,
} from 'lucide-react';

const checklist = [
  { label: 'Compra', status: 'Pendiente', icon: PackageCheck },
  { label: 'Corte', status: 'En proceso', icon: Ruler },
  { label: 'Armado', status: 'Pendiente', icon: Wrench },
  { label: 'Acabado', status: 'Pendiente', icon: Layers },
  { label: 'Instalación', status: 'Pendiente', icon: ClipboardList },
  { label: 'Entrega', status: 'Completado', icon: CheckCircle2 },
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
  const mainMaterial = quote.materialRows?.[0];
  const nextTasks = [
    ...quote.materialRows.filter((item) => item.nombre).map((item) => `Comprar ${item.nombre}`),
    ...quote.accessoryRows.filter((item) => item.nombre).map((item) => `Comprar ${item.nombre}`),
    quote.measureRows.length ? 'Verificar medidas' : null,
    'Revisar plano',
    quote.manoObra > 0 ? 'Preparar instalación' : null,
  ].filter(Boolean);

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
        <div className="production-progress"><span style={{ width: `${progress}%` }} /></div>
      </header>

      <div className="production-workbench">
        <div className="production-main-column">
          <article className="production-card production-materials-card">
            <h3>Materiales</h3>
            <div className="production-material-list">
              {quote.materialRows.map((item) => {
                const status = materialStatus(item);
                return (
                  <div key={item.id} className="production-material-row">
                    <div>
                      <strong>{item.nombre}</strong>
                      <span>{decimal(item.rowQuantity)} {item.unidad} · {item.tipoCompra} · {item.nota || 'Sin nota'}</span>
                    </div>
                    <strong>{money(item.costTotal)}</strong>
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
              <Image size={42} />
              <strong>Plano del proyecto</strong>
              <span>Sin plano disponible</span>
              <small>Espacio preparado para SVG, PDF o imagen.</small>
            </div>
          </article>
        </div>

        <aside className="production-side-column">
          <article className="production-card production-next">
            <h3><Hammer size={17} /> Qué sigue hoy</h3>
            <div className="production-next-list">
              {nextTasks.length > 0 ? nextTasks.map((item) => <span key={item}>{item}</span>) : <p>No hay tareas pendientes.</p>}
            </div>
          </article>

          <article className="production-card production-flow">
            <h3>Línea de producción</h3>
            <div>
              {checklist.map(({ label, status, icon: Icon }) => (
                <article key={label} className={`production-flow-node production-task-${status.toLowerCase().replace(/\s+/g, '-')}`}>
                  <Icon size={20} />
                  <div>
                    <strong>{label}</strong>
                    <span>{status}</span>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <article className="production-card production-notes">
            <h3><PenLine size={16} /> Observaciones</h3>
            <p>{observaciones}</p>
          </article>

          <article className="production-card production-quick-summary">
            <h3>Resumen rápido</h3>
            <div className="production-list">
              <div><strong>Área total</strong><span>{decimal(quote.areaTotal)} m²</span></div>
              <div><strong>Material principal</strong><span>{mainMaterial?.nombre || 'Sin material'}</span></div>
              <div><strong>Piezas</strong><span>{decimal(quote.cantidad, 0)}</span></div>
              <div><strong>Costo interno</strong><span>{money(quote.internalTotal)}</span></div>
              <div><strong>Precio cliente</strong><span>{money(quote.total)}</span></div>
              <div><strong>Utilidad</strong><span>{money(quote.profit)}</span></div>
            </div>
          </article>
        </aside>
      </div>

      <div className="actions production-actions">
        <button type="button" onClick={() => openPrint('business')}><Printer size={18} /> Imprimir Orden</button>
        <span>Placeholder temporal: usa la impresión interna existente.</span>
      </div>
    </section>
  );
}
