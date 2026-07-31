import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  PackageOpen,
  RefreshCw,
  Search,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { filterReceptionInbox } from '../lib/receptions/receptionSelectors.js';

const STATUS_LABELS = Object.freeze({
  pending: 'Pendiente',
  partial: 'Parcial',
  complete: 'Completa',
  rejected: 'Rechazada',
});

const VIEWS = Object.freeze([
  { id: 'all', label: 'Todas' },
  { id: 'pending', label: 'Pendientes' },
  { id: 'partial', label: 'Parciales' },
  { id: 'complete', label: 'Completadas' },
  { id: 'rejected', label: 'Rechazadas' },
  { id: 'incidents', label: 'Con incidencias' },
  { id: 'history', label: 'Historial' },
  { id: 'activity', label: 'Actividad reciente' },
]);

const EMPTY_FILTERS = Object.freeze({
  query: '',
  projectId: '',
  customer: '',
  supplier: '',
  responsible: '',
  material: '',
  purchaseId: '',
  productionOrderId: '',
  from: '',
  to: '',
  readOnly: '',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function rowFor(rows, id) {
  return rows[id] || {
    receivedQuantity: '',
    acceptedQuantity: '',
    damagedQuantity: '',
    rejectedQuantity: '',
    missingQuantity: '',
    observations: '',
  };
}

function uniqueOptions(rows, key) {
  const values = new Map();
  rows.forEach((row) => {
    const value = row[key];
    if (!value) return;
    values.set(String(value), String(value));
  });
  return [...values.values()].sort((left, right) => left.localeCompare(right, 'es-MX'));
}

function displayDate(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed)
    ? new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
    : 'Sin fecha';
}

export default function ReceivingSection({
  form,
  purchases = [],
  activePurchase,
  activePurchaseView,
  summary,
  inbox = [],
  events = [],
  notifications = [],
  receptions = [],
  pendingOperations = [],
  receptionLoading = false,
  receptionError = '',
  receptionSyncStatus = '',
  conflicts = [],
  onSelectPurchase,
  onOpenProject,
  onSave,
  onDelete,
  onSync,
  decimal,
  readOnly = false,
}) {
  const [activeView, setActiveView] = useState('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState({});
  const [observations, setObservations] = useState('');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);
  const [quickItemId, setQuickItemId] = useState(null);

  useEffect(() => {
    const quickRow = quickItemId
      ? inbox.find((item) => (
        item.purchaseItemId === quickItemId
        && item.purchaseId === activePurchase?.id
      ))
      : null;
    setRows(quickRow && !readOnly && !quickRow.readOnly ? {
      [quickRow.purchaseItemId]: {
        ...rowFor({}, quickRow.purchaseItemId),
        receivedQuantity: String(quickRow.pendingQuantity),
        acceptedQuantity: String(quickRow.pendingQuantity),
      },
    } : {});
    setObservations('');
    setEvidence('');
  }, [activePurchase?.id]);

  const selectedPurchaseRows = useMemo(() => inbox.filter((item) => (
    item.purchaseId === activePurchase?.id
  )), [activePurchase?.id, inbox]);
  const selectedPurchaseReadOnly = selectedPurchaseRows.some((item) => item.readOnly);
  const mutationBlocked = readOnly || selectedPurchaseReadOnly;
  const relatedReceptions = useMemo(() => receptions.filter((item) => (
    item.purchaseId === activePurchase?.id
  )), [activePurchase?.id, receptions]);

  const viewFilters = useMemo(() => ({
    ...filters,
    statuses: ['pending', 'partial', 'complete', 'rejected'].includes(activeView)
      ? [activeView]
      : [],
    incidents: activeView === 'incidents' ? true : undefined,
    readOnly: filters.readOnly === '' ? undefined : filters.readOnly === 'true',
  }), [activeView, filters]);
  const visibleRows = useMemo(() => filterReceptionInbox(inbox, viewFilters), [inbox, viewFilters]);
  const options = useMemo(() => ({
    projects: uniqueOptions(inbox, 'projectName'),
    customers: uniqueOptions(inbox, 'customerName'),
    suppliers: uniqueOptions(inbox, 'supplier'),
    responsible: uniqueOptions(inbox, 'latestReceivedBy'),
  }), [inbox]);

  const updateFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const updateRow = (id, field, value) => {
    if (mutationBlocked) return;
    setRows((current) => ({
      ...current,
      [id]: { ...rowFor(current, id), [field]: value },
    }));
  };

  const selectForCapture = (row, quick = false) => {
    onSelectPurchase?.(row.purchaseId);
    setQuickItemId(quick ? row.purchaseItemId : null);
    if (quick && !readOnly && !row.readOnly && row.pendingQuantity > 0) {
      setRows({
        [row.purchaseItemId]: {
          ...rowFor({}, row.purchaseItemId),
          receivedQuantity: String(row.pendingQuantity),
          acceptedQuantity: String(row.pendingQuantity),
        },
      });
    }
  };

  const receiveAllPending = () => {
    if (mutationBlocked || !activePurchaseView) return;
    setQuickItemId(null);
    setRows(Object.fromEntries(activePurchaseView.items
      .filter((item) => item.pendingQuantity > 0)
      .map((item) => [item.purchaseItem.id, {
        ...rowFor(rows, item.purchaseItem.id),
        receivedQuantity: String(item.pendingQuantity),
        acceptedQuantity: String(item.pendingQuantity),
        damagedQuantity: '',
        rejectedQuantity: '',
        missingQuantity: '',
      }])));
  };

  const save = async () => {
    if (mutationBlocked || saving) return;
    setSaving(true);
    const result = await onSave?.({
      purchase: activePurchase,
      values: rows,
      observations,
      evidence: evidence.split(',').map((item) => item.trim()).filter(Boolean),
    });
    setSaving(false);
    if (!result?.error) {
      setRows({});
      setObservations('');
      setEvidence('');
      setQuickItemId(null);
    }
  };

  const printReceipt = () => {
    const history = relatedReceptions.map((reception) => (
      `<li><strong>${escapeHtml(displayDate(reception.receivedAt))}</strong>`
      + ` · ${reception.items.length} partida(s)<br>${escapeHtml(reception.observations)}</li>`
    )).join('');
    const html = `<!doctype html><html><head><title>Recepción de materiales</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17201b}.report-logo{display:block;width:180px;height:102px;object-fit:contain;margin-bottom:14px}li{margin:12px 0;padding:12px;border-bottom:1px solid #ddd;line-height:1.5}</style></head><body><img class="report-logo" src="/branding/br-logo-horizontal.png" alt="ALUXOR / BosqueReal"><h1>Historial de recepción</h1><p>${escapeHtml(form.producto || 'Centro operativo')} · ${escapeHtml(activePurchase?.folio || '')}</p><ul>${history || '<li>Sin recepciones.</li>'}</ul></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  const pendingByUnit = (summary?.pendingByUnit || [])
    .map((item) => `${decimal(item.quantity, 2)} ${item.unit}`)
    .join(' · ');

  return (
    <section className="receiving-section panel">
      <header className="receiving-hero">
        <div>
          <span>Centro operativo</span>
          <h2>Recepción</h2>
          <p>Todas las llegadas del workspace · {receptionSyncStatus}</p>
        </div>
        <PackageOpen size={36} />
      </header>

      <div className="receiving-stats" aria-label="Resumen global de Recepción">
        <div><span>Partidas pendientes</span><strong>{summary?.pendingItems || 0}</strong></div>
        <div><span>Parciales</span><strong>{summary?.partialItems || 0}</strong></div>
        <div><span>Completas</span><strong>{summary?.completeItems || 0}</strong></div>
        <div><span>Con incidencias</span><strong>{summary?.incidentItems || 0}</strong></div>
        <div><span>Pendiente por unidad</span><strong className="receiving-unit-total">{pendingByUnit || 'Sin pendientes'}</strong></div>
        <div><span>Actividad reciente</span><strong>{summary?.recentReceptions || 0}</strong></div>
      </div>

      <div className="receiving-actions">
        <button type="button" className="ghost" onClick={onSync}>
          <RefreshCw size={18} /> Sincronizar
        </button>
        <button type="button" className="ghost" disabled={!activePurchase} onClick={printReceipt}>
          <FileCheck2 size={18} /> Comprobante
        </button>
      </div>

      {pendingOperations.length > 0 && (
        <p className="inline-notice"><WifiOff size={16} /> {pendingOperations.length} operación(es) pendientes.</p>
      )}
      {conflicts.length > 0 && (
        <p className="inline-notice"><AlertTriangle size={16} /> Hay cambios remotos en conflicto; no se combinaron automáticamente.</p>
      )}
      {receptionError && <p className="inline-notice" role="alert">{receptionError}</p>}
      {receptionLoading && <p>Cargando recepciones…</p>}

      <nav className="receiving-tabs" aria-label="Vistas de Recepción">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            type="button"
            className={activeView === view.id ? 'active' : 'ghost'}
            aria-pressed={activeView === view.id}
            onClick={() => setActiveView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </nav>

      {!['history', 'activity'].includes(activeView) && (
        <>
          <div className="receiving-filters">
            <label className="receiving-search"><Search size={17} /><input type="search" aria-label="Buscar en Recepción" placeholder="Buscar proyecto, cliente, material, compra, OT, responsable…" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} /></label>
            <select aria-label="Filtrar por proyecto" value={filters.projectId} onChange={(event) => updateFilter('projectId', event.target.value)}>
              <option value="">Todos los proyectos</option>
              {options.projects.map((name) => {
                const row = inbox.find((item) => item.projectName === name);
                return <option key={name} value={row?.projectId || ''}>{name}</option>;
              })}
            </select>
            <select aria-label="Filtrar por cliente" value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)}><option value="">Todos los clientes</option>{options.customers.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filtrar por proveedor" value={filters.supplier} onChange={(event) => updateFilter('supplier', event.target.value)}><option value="">Todos los proveedores</option>{options.suppliers.map((value) => <option key={value}>{value}</option>)}</select>
            <select aria-label="Filtrar por responsable" value={filters.responsible} onChange={(event) => updateFilter('responsible', event.target.value)}><option value="">Todos los responsables</option>{options.responsible.map((value) => <option key={value}>{value}</option>)}</select>
            <input aria-label="Filtrar por material" placeholder="Material" value={filters.material} onChange={(event) => updateFilter('material', event.target.value)} />
            <input aria-label="Filtrar por compra" placeholder="UUID de compra" value={filters.purchaseId} onChange={(event) => updateFilter('purchaseId', event.target.value)} />
            <input aria-label="Filtrar por orden de producción" placeholder="UUID de OT" value={filters.productionOrderId} onChange={(event) => updateFilter('productionOrderId', event.target.value)} />
            <input aria-label="Recepciones desde" type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
            <input aria-label="Recepciones hasta" type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
            <select aria-label="Filtrar por modo" value={filters.readOnly} onChange={(event) => updateFilter('readOnly', event.target.value)}><option value="">Editable y consulta</option><option value="false">Editables</option><option value="true">Solo lectura</option></select>
            <button type="button" className="ghost" onClick={() => setFilters(EMPTY_FILTERS)}><X size={16} /> Limpiar filtros</button>
          </div>

          <div className="receiving-inbox" aria-label="Bandeja global de Recepción">
            {visibleRows.length ? visibleRows.map((row) => (
              <article key={row.purchaseItemId} className={`receiving-inbox-row status-${row.status}`}>
                <div className="receiving-inbox-context">
                  <span>{row.customerName}</span>
                  <strong>{row.projectName}</strong>
                  <small>{row.productionOrderFolio || 'Sin OT'} · {row.purchaseFolio || row.purchaseId}</small>
                </div>
                <div>
                  <strong>{row.material}</strong>
                  <span>{row.supplier} · {decimal(row.purchasedQuantity, 2)} {row.unit}</span>
                  <small>Aceptado {decimal(row.acceptedQuantity, 2)} · Pendiente {decimal(row.pendingQuantity, 2)} · {row.receptionCount} recepción(es)</small>
                </div>
                <div className="receiving-inbox-state">
                  <em>{STATUS_LABELS[row.status]}</em>
                  {row.hasOpenIncidents && <strong><AlertTriangle size={14} /> {row.openIncidentCount} incidencia(s) activa(s)</strong>}
                  <small>{displayDate(row.latestReceptionAt)}</small>
                </div>
                <div className="receiving-row-actions">
                  <button type="button" className="ghost" onClick={() => onOpenProject?.(row)}><ExternalLink size={15} /> Proyecto</button>
                  <button type="button" className="ghost" onClick={() => selectForCapture(row, false)}>Detalle</button>
                  {!readOnly && !row.readOnly && row.pendingQuantity > 0 && <button type="button" onClick={() => selectForCapture(row, true)}>Captura rápida</button>}
                </div>
              </article>
            )) : <div className="empty-state">No hay partidas que coincidan con la vista y los filtros.</div>}
          </div>
        </>
      )}

      {activeView === 'history' && (
        <div className="receiving-event-list">
          {events.length ? events.map((event) => (
            <article key={event.id}>
              <strong>{event.summary}</strong>
              <span>{event.type} · {displayDate(event.occurredAt)} · {event.responsible || 'Responsable no disponible'}</span>
              {event.observation && <p>{event.observation}</p>}
            </article>
          )) : <div className="empty-state">No existen eventos de Recepción.</div>}
        </div>
      )}

      {activeView === 'activity' && (
        <div className="receiving-event-list">
          {notifications.length ? notifications.map((notification) => (
            <article key={notification.id} className={`severity-${notification.severity}`}>
              <strong>{notification.label}</strong>
              <span>{notification.type}</span>
            </article>
          )) : <div className="empty-state">No hay notificaciones operativas pendientes.</div>}
        </div>
      )}

      {activePurchaseView && (
        <div className="receiving-layout receiving-capture" id="reception-capture">
          <div className="receiving-cards">
            <div className="receiving-actions">
              <strong>{quickItemId ? 'Captura rápida' : 'Captura detallada'} · {activePurchase?.folio || activePurchase?.id}</strong>
              <span>Responsable: usuario autenticado · Fecha: al guardar</span>
              {!mutationBlocked && <button type="button" onClick={receiveAllPending}><CheckCircle2 size={18} /> Recibir todo lo pendiente</button>}
              {mutationBlocked && <span className="inline-notice">Proyecto entregado o sin permiso: consulta solamente.</span>}
            </div>
            {activePurchaseView.items
              .filter((view) => !quickItemId || view.purchaseItem.id === quickItemId)
              .map((view) => {
                const item = view.purchaseItem;
                const input = rowFor(rows, item.id);
                return (
                  <article key={item.id} className={`receiving-card receiving-card-${view.status}`}>
                    <div className="receiving-card-head">
                      <div><strong>{item.name}</strong><span>Comprado {decimal(item.quantity, 2)} {item.unit || 'pieza'} · Aceptado {decimal(view.accumulated.accepted, 2)} · Pendiente {decimal(view.pendingQuantity, 2)}</span></div>
                      <em>{STATUS_LABELS[view.status]}</em>
                    </div>
                    <div className="receiving-fields">
                      <label>Recibido<input type="number" min="0" readOnly={mutationBlocked} value={input.receivedQuantity} onChange={(event) => updateRow(item.id, 'receivedQuantity', event.target.value)} /></label>
                      <label>Aceptado<input type="number" min="0" readOnly={mutationBlocked} value={input.acceptedQuantity} onChange={(event) => updateRow(item.id, 'acceptedQuantity', event.target.value)} /></label>
                      <label>Dañado<input type="number" min="0" readOnly={mutationBlocked} value={input.damagedQuantity} onChange={(event) => updateRow(item.id, 'damagedQuantity', event.target.value)} /></label>
                      <label>Rechazado<input type="number" min="0" readOnly={mutationBlocked} value={input.rejectedQuantity} onChange={(event) => updateRow(item.id, 'rejectedQuantity', event.target.value)} /></label>
                      <label>Faltante<input type="number" min="0" readOnly={mutationBlocked} value={input.missingQuantity} onChange={(event) => updateRow(item.id, 'missingQuantity', event.target.value)} /></label>
                    </div>
                    <label className="receiving-notes">Observaciones de la partida<textarea readOnly={mutationBlocked} value={input.observations} onChange={(event) => updateRow(item.id, 'observations', event.target.value)} /></label>
                  </article>
                );
              })}
            {!mutationBlocked && (
              <article className="receiving-card">
                <label className="receiving-notes">Observaciones generales<textarea value={observations} onChange={(event) => setObservations(event.target.value)} /></label>
                <label className="receiving-notes">Evidencia (URLs separadas por coma)<input value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
                <button type="button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar recepción'}</button>
              </article>
            )}
          </div>

          <aside className="receiving-side">
            <article><h3>Historial de la compra</h3>{relatedReceptions.length ? relatedReceptions.map((reception) => (
              <span key={reception.id}>{displayDate(reception.receivedAt)} · {reception.items.length} partida(s){!mutationBlocked && <button type="button" className="ghost" onClick={() => onDelete?.(reception.id, reception.version)} aria-label="Eliminar recepción"><Trash2 size={14} /></button>}</span>
            )) : <p>No hay recepciones registradas.</p>}</article>
            <article className="receiving-incidents"><h3>Incidencias globales</h3><span>Dañado: {decimal(summary?.damagedQuantity || 0, 2)}</span><span>Rechazado: {decimal(summary?.rejectedQuantity || 0, 2)}</span><span>Faltante: {decimal(summary?.missingQuantity || 0, 2)}</span></article>
          </aside>
        </div>
      )}
    </section>
  );
}
