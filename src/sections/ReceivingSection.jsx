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
import { useEffect, useMemo, useRef, useState } from 'react';
import PurchaseItemAmendmentForm from '../components/PurchaseItemAmendmentForm.jsx';
import ReceptionItemRealCorrectionForm from '../components/ReceptionItemRealCorrectionForm.jsx';
import FinancialSummaryPanel from '../components/FinancialSummaryPanel.jsx';
import ReceptionReceipt from '../components/ReceptionReceipt.jsx';
import { selectPurchaseItemOperationalTimeline } from '../lib/material-traceability/materialTraceabilitySelectors.js';
import {
  filterReceptionInbox,
  filterReceptionProjects,
  getPurchaseReceptionHistoryEntry,
  selectReceptionProjectIndex,
} from '../lib/receptions/receptionSelectors.js';
import {
  getOriginalQuotedQuantity,
  getPurchaseItemFulfillment,
} from '../lib/purchases/materialFulfillment.js';
import {
  getReceptionFinancialSummary,
  getReceptionReceiptReadiness,
} from '../lib/receptions/receptionCostSummary.js';
import { getAuthorizedReceptionPhysicalCorrection, getReceptionReviewVisualState, selectReceptionPurchaseQuantityReviewInbox } from '../lib/purchases/purchaseQuantityReviewSelectors.js';
import { projectEffectiveReceptionItems } from '../lib/receptions/receptionEffectiveItems.js';

const STATUS_LABELS = Object.freeze({
  pending: 'Pendiente',
  partial: 'Parcial',
  complete: 'Completa',
  rejected: 'Rechazada',
  MATERIALS_READY: 'Materiales listos',
  RECEPTION_COMPLETE_BUT_PURCHASE_MISSING: 'Recepción completa; falta compra',
});

export const RECEIVING_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIVING_EVIDENCE_TYPES = Object.freeze([
  'factura', 'nota_proveedor', 'material_recibido', 'daño', 'rechazo',
  'devolución', 'faltante', 'etiqueta_lote', 'general',
]);

export function getReviewReceptionTarget(review, receptions = []) {
  if (!review?.receptionId) return null;
  return receptions.find((reception) => (
    reception.id === review.receptionId
    && reception.purchaseId === review.purchaseId
  )) || null;
}

export function resolveReviewReceptionItem(review, receptions = [], workspaceId = null) {
  if (!review?.receptionId) return { target: null, error: 'Falta seleccionar la recepción relacionada.' };
  const reception = receptions.find((candidate) => candidate.id === review.receptionId
    && candidate.purchaseId === review.purchaseId
    && (!workspaceId || !candidate.workspaceId || candidate.workspaceId === workspaceId));
  if (!reception) return { target: null, error: 'No se encontró la recepción relacionada.' };
  if (reception.revertedAt) return { target: null, error: 'Esta recepción fue revertida.' };
  const candidates = (reception.items || []).filter((item) => (
    item.purchaseItemId === review.purchaseItemId
    && (!review.receptionItemId || item.id === review.receptionItemId)
  ));
  if (candidates.length === 0) return { target: null, error: 'No se encontró la partida relacionada dentro de esta recepción.' };
  if (candidates.length > 1) return { target: null, error: 'La partida relacionada no puede resolverse de forma inequívoca.' };
  return { target: Object.freeze({
    workspaceId: workspaceId || review.workspaceId || reception.workspaceId || null,
    purchaseId: review.purchaseId,
    purchaseItemId: review.purchaseItemId,
    receptionId: reception.id,
    receptionItemId: candidates[0].id,
    reviewRequestId: review.id,
  }), error: null };
}

export function createReceivingEvidenceDraft(file, evidenceType = 'general', {
  createPreview = (value) => globalThis.URL?.createObjectURL?.(value),
} = {}) {
  if (!file?.type?.startsWith('image/')) return { data: null, error: 'Solo se permiten imágenes.' };
  if (file.size > RECEIVING_EVIDENCE_MAX_BYTES) return { data: null, error: 'La imagen supera el límite de 10 MB.' };
  return {
    data: {
      id: globalThis.crypto?.randomUUID?.() || `${file.name}-${file.lastModified}`,
      file,
      name: file.name,
      size: file.size,
      mimeType: file.type,
      evidenceType: RECEIVING_EVIDENCE_TYPES.includes(evidenceType) ? evidenceType : 'general',
      previewUrl: createPreview(file),
      status: 'pending_remote_file_service',
    },
    error: null,
  };
}

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
    excessDecision: 'none',
    shortageClosed: false,
    shortageReason: '',
    actualUnitCost: '',
    additionalCharges: '',
    discounts: '',
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
  corrections = [],
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
  onAmendPurchaseItem,
  traceEvents = [],
  inventoryMovements = [],
  workspaceId = null,
  actorRole = '',
  initialProjectId = null,
  targetReceptionId = null,
  targetPurchaseItemId = null,
  targetReceptionItemId = null,
  targetReviewRequestId = null,
  targetCorrectionMode = false,
  onClearCorrectionTarget,
  onOpenReviewReception,
  purchaseQuantityReviewRequests = [],
  completePurchaseQuantityReviewRequest,
  onCreateReceptionItemRealCorrection,
  decimal,
  readOnly = false,
}) {
  const [activeView, setActiveView] = useState('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [rows, setRows] = useState({});
  const [observations, setObservations] = useState('');
  const [evidence, setEvidence] = useState('');
  const [evidenceType, setEvidenceType] = useState('general');
  const [evidenceAttachments, setEvidenceAttachments] = useState([]);
  const [evidenceError, setEvidenceError] = useState('');
  const evidenceAttachmentsRef = useRef([]);
  const [saving, setSaving] = useState(false);
  const [quickItemId, setQuickItemId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [showReceipt, setShowReceipt] = useState(false);
  const [highlightedReceptionId, setHighlightedReceptionId] = useState(null);
  const [highlightedReceptionItemId, setHighlightedReceptionItemId] = useState(null);
  const [deepLinkError, setDeepLinkError] = useState('');

  useEffect(() => {
    if (initialProjectId) setSelectedProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (!targetReceptionId) return undefined;
    const target = receptions.find((reception) => reception.id === targetReceptionId);
    if (!target) {
      setDeepLinkError('No se encontró la recepción relacionada para esta solicitud.');
      return undefined;
    }
    if (activePurchase?.id !== target.purchaseId) {
      onSelectPurchase?.(target.purchaseId);
      return undefined;
    }
    setDeepLinkError('');
    setSelectedProjectId(target.quoteId || activePurchase?.quoteId || initialProjectId);
    setActiveView('all');
    const timer = setTimeout(() => {
      const node = document.querySelector(`[data-reception-id="${target.id}"]`);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedReceptionId(target.id);
    }, 0);
    const highlightTimer = setTimeout(() => setHighlightedReceptionId(null), 2500);
    return () => {
      clearTimeout(timer);
      clearTimeout(highlightTimer);
    };
  }, [targetReceptionId, activePurchase?.id, activePurchase?.quoteId, initialProjectId, onSelectPurchase, receptions]);

  useEffect(() => {
    if (!targetPurchaseItemId || !activePurchase?.items?.some((item) => item.id === targetPurchaseItemId)) return;
    setSelectedProjectId(activePurchase.quoteId || initialProjectId);
    setQuickItemId(targetPurchaseItemId);
    setActiveView('all');
  }, [targetPurchaseItemId, activePurchase?.id, activePurchase?.quoteId, activePurchase?.items, initialProjectId]);

  useEffect(() => {
    if (!targetReceptionItemId) return undefined;
    const timer = setTimeout(() => {
      const node = document.querySelector(`[data-reception-item-id="${targetReceptionItemId}"]`);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedReceptionItemId(targetReceptionItemId);
    }, 0);
    const highlightTimer = setTimeout(() => setHighlightedReceptionItemId(null), 2500);
    return () => { clearTimeout(timer); clearTimeout(highlightTimer); };
  }, [targetReceptionItemId, targetReceptionId]);

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
        receivedQuantity: String(quickRow.receptionPendingQuantity),
        acceptedQuantity: String(quickRow.receptionPendingQuantity),
      },
    } : {});
    setObservations('');
    setEvidence('');
    setEvidenceAttachments((current) => {
      current.forEach((item) => item.previewUrl && globalThis.URL?.revokeObjectURL?.(item.previewUrl));
      return [];
    });
    setEvidenceError('');
  }, [activePurchase?.id]);

  useEffect(() => {
    evidenceAttachmentsRef.current = evidenceAttachments;
  }, [evidenceAttachments]);

  useEffect(() => () => {
    evidenceAttachmentsRef.current.forEach((item) => item.previewUrl && globalThis.URL?.revokeObjectURL?.(item.previewUrl));
  }, []);

  const selectedPurchaseRows = useMemo(() => inbox.filter((item) => (
    item.purchaseId === activePurchase?.id
  )), [activePurchase?.id, inbox]);
  const selectedPurchaseReadOnly = selectedPurchaseRows.some((item) => item.readOnly);
  const mutationBlocked = readOnly || selectedPurchaseReadOnly;
  const relatedReceptions = useMemo(() => receptions.filter((item) => (
    item.purchaseId === activePurchase?.id
  )), [activePurchase?.id, receptions]);
  const receptionFinancialSummary = useMemo(() => getReceptionFinancialSummary({
    purchases: activePurchase ? [activePurchase] : [], receptions: relatedReceptions, corrections,
  }), [activePurchase, corrections, relatedReceptions]);
  const receiptReadiness = useMemo(() => getReceptionReceiptReadiness({
    purchase: activePurchase || {}, receptions: relatedReceptions, corrections, inbox, pendingOperations, conflicts,
  }), [activePurchase, corrections, relatedReceptions, inbox, pendingOperations, conflicts]);
  const receptionReviews = selectReceptionPurchaseQuantityReviewInbox(purchaseQuantityReviewRequests, {
    workspaceId,
    receptions,
    corrections,
  });
  const focusedRelatedReceptions = targetReceptionId
    ? relatedReceptions.filter((reception) => reception.id === targetReceptionId)
    : relatedReceptions;
  const openReviewReception = (review, correctionMode) => {
    const resolved = resolveReviewReceptionItem(review, receptions, workspaceId || activePurchase?.workspaceId);
    if (resolved.error) { setDeepLinkError(resolved.error); return; }
    setDeepLinkError('');
    onOpenReviewReception?.(review, { ...resolved.target, correctionMode });
  };

  const viewFilters = useMemo(() => ({
    ...filters,
    statuses: ['pending', 'partial', 'complete', 'rejected'].includes(activeView)
      ? [activeView]
      : [],
    incidents: activeView === 'incidents' ? true : undefined,
    readOnly: filters.readOnly === '' ? undefined : filters.readOnly === 'true',
  }), [activeView, filters]);
  const visibleRows = useMemo(() => filterReceptionInbox(inbox, {
    ...viewFilters,
    projectId: selectedProjectId || viewFilters.projectId,
  }), [inbox, selectedProjectId, viewFilters]);
  const projectIndex = useMemo(() => selectReceptionProjectIndex(inbox), [inbox]);
  const visibleProjects = useMemo(() => filterReceptionProjects(projectIndex, {
    query: filters.query,
    customer: filters.customer,
    material: filters.material,
    status: activeView === 'incidents' ? 'incidents' : activeView,
  }), [activeView, filters.customer, filters.material, filters.query, projectIndex]);
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

  const addEvidence = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const result = createReceivingEvidenceDraft(file, evidenceType);
    if (result.error) {
      setEvidenceError(result.error);
      return;
    }
    setEvidenceError('');
    setEvidenceAttachments((current) => [...current, result.data]);
  };

  const removeEvidence = (id) => setEvidenceAttachments((current) => current.filter((item) => {
    if (item.id !== id) return true;
    if (item.previewUrl) globalThis.URL?.revokeObjectURL?.(item.previewUrl);
    return false;
  }));

  const selectForCapture = (row, quick = false) => {
    onSelectPurchase?.(row.purchaseId);
    setQuickItemId(quick ? row.purchaseItemId : null);
    if (quick && !readOnly && !row.readOnly && row.receptionPendingQuantity > 0) {
      setRows({
        [row.purchaseItemId]: {
          ...rowFor({}, row.purchaseItemId),
          receivedQuantity: String(row.receptionPendingQuantity),
          acceptedQuantity: String(row.receptionPendingQuantity),
        },
      });
    }
  };

  const openReceptionProject = (project) => {
    setSelectedProjectId(project.projectId);
    const first = inbox.find((row) => row.projectId === project.projectId);
    if (first) onSelectPurchase?.(first.purchaseId);
  };

  const receiveAllPending = () => {
    if (mutationBlocked || !activePurchaseView) return;
    setQuickItemId(null);
    setRows(Object.fromEntries(activePurchaseView.items
      .filter((item) => item.receptionPendingQuantity > 0)
      .map((item) => [item.purchaseItem.id, {
        ...rowFor(rows, item.purchaseItem.id),
        receivedQuantity: String(item.receptionPendingQuantity),
        acceptedQuantity: String(item.receptionPendingQuantity),
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
      evidenceAttachments: evidenceAttachments.map(({ file, previewUrl, ...attachment }) => ({
        ...attachment,
        workspaceId,
        projectId: activePurchase?.quoteId || null,
        purchaseId: activePurchase?.id || null,
        actor: null,
        createdAt: new Date().toISOString(),
      })),
    });
    setSaving(false);
    if (!result?.error) {
      setRows({});
      setObservations('');
      setEvidence('');
      setEvidenceAttachments((current) => {
        current.forEach((item) => item.previewUrl && globalThis.URL?.revokeObjectURL?.(item.previewUrl));
        return [];
      });
      setQuickItemId(null);
    }
  };

  const openReceipt = () => setShowReceipt(true);

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
        <button type="button" className="ghost" disabled={!activePurchase || !receiptReadiness.completed} onClick={openReceipt}>
          <FileCheck2 size={18} /> Comprobante
        </button>
      </div>

      {selectedProjectId && (
        <button type="button" className="ghost" onClick={() => {
          setSelectedProjectId(null);
          setQuickItemId(null);
        }}>Volver al índice de proyectos</button>
      )}
      {targetPurchaseItemId && <button type="button" className="ghost" onClick={() => {
        setQuickItemId(null);
        onClearCorrectionTarget?.();
      }}>Volver a ver todas las partidas</button>}

      {pendingOperations.length > 0 && (
        <p className="inline-notice"><WifiOff size={16} /> {pendingOperations.length} operación(es) pendientes.</p>
      )}
      {conflicts.length > 0 && (
        <p className="inline-notice"><AlertTriangle size={16} /> Hay cambios remotos en conflicto; no se combinaron automáticamente.</p>
      )}
      {receptionError && <p className="inline-notice" role="alert">{receptionError}</p>}
      {deepLinkError && <p className="inline-notice" role="alert">{deepLinkError}</p>}
      {receptionLoading && <p>Cargando recepciones…</p>}
      {receptionReviews.length > 0 && <section className="receiving-review-inbox"><h3>Revisiones que requieren acción física</h3>{receptionReviews.map((review) => {
        const resolution = resolveReviewReceptionItem(review, receptions, workspaceId);
        const purchase = purchases.find((item) => item.id === review.purchaseId);
        const purchaseItem = purchase?.items?.find((item) => item.id === review.purchaseItemId);
        const authorization = resolution.target && getAuthorizedReceptionPhysicalCorrection({ reviews: [review], workspaceId, purchaseId: review.purchaseId, purchaseItemId: review.purchaseItemId, receptionId: resolution.target.receptionId, currentVersion: purchaseItem?.version });
        const correctionDisabled = readOnly || !authorization || Boolean(resolution.error);
        const difference = review.currentAcceptedQuantity - review.requestedPurchasedQuantity;
        return <article key={review.id}><strong>{review.status} · compra {review.currentPurchasedQuantity} · aceptado {review.currentAcceptedQuantity} · solicitado {review.requestedPurchasedQuantity}</strong><span>Diferencia física: {difference} · {review.reason}</span><button type="button" disabled={correctionDisabled} onClick={() => openReviewReception(review, true)}>Corregir solo esta partida</button><button type="button" className="ghost" disabled={Boolean(resolution.error)} onClick={() => openReviewReception(review, false)}>Abrir recepción relacionada</button>{resolution.error ? <small>{resolution.error}</small> : !authorization ? <small>La corrección física requiere autorización vigente de Owner/Admin.</small> : <small>Se abrirá únicamente la partida relacionada.</small>}</article>;
      })}</section>}
      {activePurchase && !receiptReadiness.completed && <p className="inline-notice">El comprobante se habilita al recibir todo lo comprado o cerrar explícitamente los faltantes definitivos.</p>}
      {activePurchase && receiptReadiness.draft && <p className="inline-notice"><AlertTriangle size={16} /> El comprobante estará marcado como borrador por incidencias, conflictos u operaciones pendientes.</p>}

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

      {!selectedProjectId && !['history', 'activity'].includes(activeView) && (
        <>
          <div className="receiving-filters">
            <label className="receiving-search"><Search size={17} /><input type="search" aria-label="Buscar proyectos en Recepción" placeholder="Buscar proyecto, cliente, folio o material…" value={filters.query} onChange={(event) => updateFilter('query', event.target.value)} /></label>
            <select aria-label="Filtrar proyectos por cliente" value={filters.customer} onChange={(event) => updateFilter('customer', event.target.value)}><option value="">Todos los clientes</option>{options.customers.map((value) => <option key={value}>{value}</option>)}</select>
            <input aria-label="Filtrar proyectos por material" placeholder="Material" value={filters.material} onChange={(event) => updateFilter('material', event.target.value)} />
            <button type="button" className="ghost" onClick={() => setFilters(EMPTY_FILTERS)}><X size={16} /> Limpiar filtros</button>
          </div>
          <div className="receiving-inbox" aria-label="Índice de proyectos de Recepción">
            {visibleProjects.length ? visibleProjects.map((project) => (
              <article key={project.id} className={`receiving-inbox-row tone-${project.cardTone}`}>
                <div className="receiving-inbox-context"><span>{project.customerName}</span><strong>{project.projectName}</strong><small>{project.projectFolio || project.projectId} · {project.productionOrderFolio || project.productionOrderId || 'Sin OT'}</small></div>
                <div><strong>{project.purchases} compra(s) · {project.totalItems} partida(s)</strong><span>Pendientes de compra {project.purchasePendingItems} · pendientes de recepción {project.receptionPendingItems} · materiales listos {project.materialsReadyItems}</span><small>{project.materials.join(', ')} · {Object.entries(project.pendingByUnit).map(([unit, quantity]) => `${decimal(quantity, 2)} ${unit} por recibir`).join(' · ') || 'Sin pendiente de recepción'}</small></div>
                <div className="receiving-inbox-state"><em>{STATUS_LABELS[project.status]}</em>{project.attentionRequired && <strong><AlertTriangle size={14} /> {project.activeIncidents} incidencia(s)</strong>}<small>{displayDate(project.latestReceptionAt)}</small></div>
                <div className="receiving-row-actions"><button type="button" onClick={() => openReceptionProject(project)}>Abrir recepción</button><button type="button" className="ghost" onClick={() => onOpenProject?.(inbox.find((row) => row.projectId === project.projectId))}><ExternalLink size={15} /> Proyecto</button></div>
              </article>
            )) : <div className="empty-state">No hay proyectos que coincidan con la vista y los filtros.</div>}
          </div>
        </>
      )}

      {selectedProjectId && !['history', 'activity'].includes(activeView) && (
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
              <article key={row.purchaseItemId} className={`receiving-inbox-row tone-${row.cardTone}`}>
                <div className="receiving-inbox-context">
                  <span>{row.customerName}</span>
                  <strong>{row.projectName}</strong>
                  <small>{row.productionOrderFolio || 'Sin OT'} · {row.purchaseFolio || row.purchaseId}</small>
                </div>
                <div>
                  <strong>{row.material}</strong>
                  <span>{row.supplier} · necesario {decimal(row.requiredQuantity, 2)} · ordenado {decimal(row.orderedQuantity, 2)} · comprado {decimal(row.purchasedQuantity, 2)} · recibido/aceptado {decimal(row.acceptedQuantity, 2)} {row.unit}</span>
                  <small>Pendiente de compra {decimal(row.purchasePendingQuantity, 2)} · pendiente de recepción {decimal(row.receptionPendingQuantity, 2)} · faltante del proyecto {decimal(row.projectMissingQuantity, 2)} · {row.receptionCount} recepción(es)</small>
                  {row.receptionPendingQuantity === 0 && row.purchasedQuantity > 0 && <small>Recepción completa de lo comprado</small>}
                  {row.purchasePendingQuantity > 0 && <small>Faltan {decimal(row.purchasePendingQuantity, 2)} por comprar para cubrir el proyecto</small>}
                  {row.purchasePendingQuantity === 0 && row.receptionPendingQuantity === 0 && row.requiredQuantity > 0 && <small>Compra y recepción completas</small>}
                  {(row.surplusPurchasedQuantity > 0 || row.surplusReceivedQuantity > 0) && <small>Excedente comprado {decimal(row.surplusPurchasedQuantity, 2)} · excedente recibido {decimal(row.surplusReceivedQuantity, 2)}</small>}
                </div>
                <div className="receiving-inbox-state">
                  <em>{STATUS_LABELS[row.status]}</em>
                  {row.hasOpenIncidents && <strong><AlertTriangle size={14} /> {row.openIncidentCount} incidencia(s) activa(s)</strong>}
                  <small>{displayDate(row.latestReceptionAt)}</small>
                </div>
                <div className="receiving-row-actions">
                  <button type="button" className="ghost" onClick={() => onOpenProject?.(row)}><ExternalLink size={15} /> Proyecto</button>
                  <button type="button" className="ghost" onClick={() => selectForCapture(row, false)}>Detalle</button>
                  {!readOnly && !row.readOnly && row.receptionPendingQuantity > 0 && <button type="button" onClick={() => selectForCapture(row, true)}>Captura rápida</button>}
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

      {selectedProjectId && activePurchaseView && (
        <div className="receiving-layout receiving-capture" id="reception-capture">
          <div className="receiving-cards">
            <div className="receiving-actions">
              <strong>{quickItemId ? 'Captura rápida' : 'Captura detallada'} · {activePurchase?.folio || activePurchase?.id}</strong>
              <span>Responsable: usuario autenticado · Fecha: al guardar</span>
              {!mutationBlocked && <button type="button" disabled={!activePurchaseView.items.some((item) => item.receptionPendingQuantity > 0)} onClick={receiveAllPending}><CheckCircle2 size={18} /> {activePurchaseView.items.some((item) => item.receptionPendingQuantity > 0) ? 'Recibir todo lo pendiente de recepción' : 'No hay material comprado pendiente de recepción'}</button>}
              {mutationBlocked && <span className="inline-notice">Proyecto entregado o sin permiso: consulta solamente.</span>}
            </div>
            {activePurchaseView.items
              .filter((view) => !quickItemId || view.purchaseItem.id === quickItemId)
              .map((view) => {
                const item = view.purchaseItem;
                const timeline = selectPurchaseItemOperationalTimeline({
                  workspaceId: workspaceId || activePurchase.workspaceId,
                  purchaseItem: item, purchases: [activePurchase], receptions,
                  inventoryMovements, traceEvents,
                });
                const operational = {
                  ...view,
                  ...getPurchaseItemFulfillment({
                    ...item,
                    originalQuotedQuantity: getOriginalQuotedQuantity(item, timeline),
                  }, view.accumulated.accepted),
                };
                const reviewVisual = getReceptionReviewVisualState({
                  reviewRequests: purchaseQuantityReviewRequests,
                  workspaceId: workspaceId || activePurchase.workspaceId,
                  purchaseId: activePurchase.id,
                  purchaseItemId: item.id,
                  receptions,
                  corrections,
                });
                const input = rowFor(rows, item.id);
                const receivedNow = Math.max(0, Number(input.receivedQuantity) || 0);
                const acceptedNow = Math.max(0, Number(input.acceptedQuantity) || 0);
                const excessNow = Math.max(0, receivedNow - operational.receptionPendingQuantity);
                const actualUnitCost = input.actualUnitCost === ''
                  ? Number(item.unitCost || 0)
                  : Math.max(0, Number(input.actualUnitCost) || 0);
                const expectedImpact = Math.max(0,
                  (acceptedNow * actualUnitCost)
                    + Math.max(0, Number(input.additionalCharges) || 0)
                    - Math.max(0, Number(input.discounts) || 0),
                );
                return (
                  <article key={item.id} data-purchase-id={activePurchase.id} data-purchase-item-id={item.id} data-review-state={reviewVisual.visualState} className={`receiving-card tone-${operational.cardTone || 'gray'} ${reviewVisual.hasActiveReview ? 'reception-review-blocked' : ''}`}>
                    <div className="receiving-card-head">
                      <div><strong>{item.name}</strong><span>Cotizado originalmente {decimal(operational.originalQuotedQuantity, 2)} · necesario actual {decimal(operational.requiredQuantity, 2)} · comprado realmente {decimal(operational.purchasedQuantity, 2)} · recibido {decimal(operational.acceptedQuantity, 2)} {item.unit || 'pieza'} · pendiente de compra {decimal(operational.purchasePendingQuantity, 2)} · pendiente de recepción {decimal(operational.receptionPendingQuantity, 2)} · faltante actual {decimal(operational.projectMissingQuantity, 2)} · excedente comprado {decimal(operational.surplusPurchasedQuantity, 2)} · excedente recibido {decimal(operational.surplusReceivedQuantity, 2)}</span></div>
                      <em>{STATUS_LABELS[view.status]}</em>
                    </div>
                    {reviewVisual.hasActiveReview && <aside className="reception-review-badge"><strong>Revisión física pendiente</strong><span>Aceptado {decimal(reviewVisual.activeReview.currentAcceptedQuantity, 2)} · solicitado {decimal(reviewVisual.activeReview.requestedPurchasedQuantity, 2)} · diferencia {decimal(reviewVisual.activeReview.currentAcceptedQuantity - reviewVisual.activeReview.requestedPurchasedQuantity, 2)}</span><span>{reviewVisual.activeReview.reason || reviewVisual.activeReview.notes || 'Sin motivo'} · {reviewVisual.activeReview.status}</span>{!reviewVisual.activeReview.receptionId && <small>Revisión relacionada con esta compra/partida. Falta asignar una recepción específica.</small>}</aside>}
                    <div className="receiving-fields">
                      <label>Recibido<input type="number" min="0" readOnly={mutationBlocked} value={input.receivedQuantity} onChange={(event) => updateRow(item.id, 'receivedQuantity', event.target.value)} /></label>
                      <label>Aceptado<input type="number" min="0" readOnly={mutationBlocked} value={input.acceptedQuantity} onChange={(event) => updateRow(item.id, 'acceptedQuantity', event.target.value)} /></label>
                      <label>Dañado<input type="number" min="0" readOnly={mutationBlocked} value={input.damagedQuantity} onChange={(event) => updateRow(item.id, 'damagedQuantity', event.target.value)} /></label>
                      <label>Rechazado<input type="number" min="0" readOnly={mutationBlocked} value={input.rejectedQuantity} onChange={(event) => updateRow(item.id, 'rejectedQuantity', event.target.value)} /></label>
                      <label>Faltante<input type="number" min="0" readOnly={mutationBlocked} value={input.missingQuantity} onChange={(event) => updateRow(item.id, 'missingQuantity', event.target.value)} /></label>
                      <label>Precio unitario real<input type="number" min="0" step="any" readOnly={mutationBlocked} value={input.actualUnitCost} placeholder={String(item.unitCost || 0)} onChange={(event) => updateRow(item.id, 'actualUnitCost', event.target.value)} /></label>
                      <label>Cargos adicionales<input type="number" min="0" step="any" readOnly={mutationBlocked} value={input.additionalCharges} onChange={(event) => updateRow(item.id, 'additionalCharges', event.target.value)} /></label>
                      <label>Descuentos<input type="number" min="0" step="any" readOnly={mutationBlocked} value={input.discounts} onChange={(event) => updateRow(item.id, 'discounts', event.target.value)} /></label>
                    </div>
                    {excessNow > 0 && (
                      <label>Decisión sobre excedente ({decimal(excessNow, 2)} {item.unit})
                        <select disabled={mutationBlocked} value={input.excessDecision} onChange={(event) => updateRow(item.id, 'excessDecision', event.target.value)}>
                          <option value="none">Seleccionar decisión</option>
                          <option value="accept">Aceptar excedente</option>
                          <option value="reject">Rechazar excedente</option>
                          <option value="pending_authorization">Pendiente de autorización</option>
                        </select>
                      </label>
                    )}
                    {operational.receptionPendingQuantity > acceptedNow && (
                      <label><input type="checkbox" disabled={mutationBlocked} checked={input.shortageClosed} onChange={(event) => updateRow(item.id, 'shortageClosed', event.target.checked)} /> Cerrar partida con faltante definitivo</label>
                    )}
                    {input.shortageClosed && <label>Motivo del faltante<input readOnly={mutationBlocked} value={input.shortageReason} onChange={(event) => updateRow(item.id, 'shortageReason', event.target.value)} /></label>}
                    <p>Impacto esperado: Inventario +{decimal(acceptedNow, 2)} {item.unit} · costo real +{expectedImpact.toFixed(2)}</p>
                    <label className="receiving-notes">Observaciones de la partida<textarea readOnly={mutationBlocked} value={input.observations} onChange={(event) => updateRow(item.id, 'observations', event.target.value)} /></label>
                    <PurchaseItemAmendmentForm purchase={activePurchase} item={item} acceptedQuantity={view.accumulated.accepted} sourceModule="RECEIVING" actorRole={actorRole} disabled={mutationBlocked} onAmend={onAmendPurchaseItem} />
                    <details><summary>Trazabilidad operativa · {timeline.length}</summary>{timeline.map((entry) => <span key={entry.id}>{displayDate(entry.createdAt)} · {entry.eventType} · {entry.sourceModule} · v{entry.version}{entry.reason ? ` · ${entry.reason}` : ''}</span>)}</details>
                  </article>
                );
              })}
            {!mutationBlocked && (
              <article className="receiving-card receiving-evidence-panel">
                <label className="receiving-notes">Observaciones generales<textarea value={observations} onChange={(event) => setObservations(event.target.value)} /></label>
                <label className="receiving-notes">Referencias de evidencia ya alojada (URLs separadas por coma)<input value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label>
                <div className="receiving-evidence-controls">
                  <label>Tipo de evidencia<select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)}>{RECEIVING_EVIDENCE_TYPES.map((type) => <option key={type} value={type}>{type.replace('_', ' ')}</option>)}</select></label>
                  <label className="ghost receiving-evidence-action">Tomar foto<input aria-label="Tomar foto" type="file" accept="image/*" capture="environment" onChange={addEvidence} /></label>
                  <label className="ghost receiving-evidence-action">Elegir archivo<input aria-label="Elegir imagen o archivo" type="file" accept="image/*" onChange={addEvidence} /></label>
                </div>
                <small>La evidencia nueva es opcional y permanece solo como preview hasta definir servicio remoto de archivos, bucket, RLS y referencias canónicas.</small>
                {evidenceError && <p className="inline-notice" role="alert">{evidenceError} Puedes elegir una imagen desde tu dispositivo.</p>}
                {evidenceAttachments.length > 0 && <div className="receiving-evidence-preview">{evidenceAttachments.map((attachment) => <article key={attachment.id}><img src={attachment.previewUrl} alt={`Preview ${attachment.name}`} /><span>{attachment.evidenceType} · {attachment.name} · pendiente de almacenamiento remoto</span><label>Nota opcional<input value={attachment.note || ''} onChange={(event) => setEvidenceAttachments((current) => current.map((item) => item.id === attachment.id ? { ...item, note: event.target.value } : item))} /></label><button type="button" className="ghost" onClick={() => removeEvidence(attachment.id)}>Eliminar</button></article>)}</div>}
                <button type="button" disabled={saving} onClick={save}>{saving ? 'Guardando…' : 'Guardar recepción'}</button>
              </article>
            )}
          </div>

          <aside className="receiving-side">
            <FinancialSummaryPanel
              title="Resumen real de recepción"
              money={(value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0)}
              rows={[
                { label: 'Compra registrada', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.registeredPurchaseCost) },
                { label: 'Valor recibido', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.receivedValue) },
                { label: 'Valor aceptado', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.acceptedValue) },
                { label: 'Rechazado', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.rejectedValue) },
                { label: 'Devuelto / dañado', value: `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.returnedValue)} / ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.damagedValue)}` },
                { label: 'Diferencia de factura', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.invoiceDifference) },
                { label: 'Cargos reales / descuentos reales', value: `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.realAdditionalCharges)} / ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.realDiscounts)}` },
                { label: 'Gasto real confirmado', value: new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(receptionFinancialSummary.confirmedRealSpend), emphasis: true },
                { label: 'Recepción: completa / parcial / pendiente', value: `${receptionFinancialSummary.completedItems} / ${receptionFinancialSummary.partialItems} / ${receptionFinancialSummary.pendingReceptionItems}` },
                { label: 'Partidas con observaciones', value: String(receptionFinancialSummary.itemsWithNotes) },
                { label: 'Incidencias bloqueantes', value: String(receptionFinancialSummary.blockingIncidents) },
              ]}
              actions={[
                { label: 'Ver incidencias', onClick: () => setActiveView('incidents') },
                { label: 'Ver facturas', onClick: () => setEvidenceType('factura') },
                { label: 'Generar comprobante', onClick: openReceipt, disabled: !receiptReadiness.completed },
              ]}
            />
            <article><h3>Historial de la compra</h3>{focusedRelatedReceptions.length ? focusedRelatedReceptions.map((reception) => {
              const reviewVisual = getReceptionReviewVisualState({ reviewRequests: purchaseQuantityReviewRequests, workspaceId: workspaceId || activePurchase?.workspaceId, purchaseId: activePurchase?.id, receptionId: reception.id, receptions: relatedReceptions, corrections });
              const entry = getPurchaseReceptionHistoryEntry(reception, activePurchase, purchaseQuantityReviewRequests, corrections);
              const effectiveItems = projectEffectiveReceptionItems({ receptionItems: reception.items, corrections });
              return <details key={reception.id} data-purchase-id={activePurchase?.id} data-reception-id={reception.id} data-review-state={reviewVisual.visualState} className={`reception-history-entry ${highlightedReceptionId===reception.id?'reception-highlight':''} ${reviewVisual.hasActiveReview?'reception-review-blocked':''}`} open={targetReceptionId === reception.id}><summary>{displayDate(reception.receivedAt)} · responsable {String(reception.receivedBy || '').slice(0, 8) || 'no disponible'} · {entry.items.length} partida(s) · {entry.status} · ${entry.totalReal.toFixed(2)} · {reception.id.slice(0, 8)}</summary>{reviewVisual.hasActiveReview && <strong className="reception-review-badge">Revisión física pendiente</strong>}<div>{entry.items.filter((item) => !targetReceptionItemId || item.id === targetReceptionItemId).map((item) => {
                const originalItem = reception.items.find((candidate) => candidate.id === item.id) || item;
                const effectiveItem = effectiveItems.find((candidate) => candidate.id === item.id) || originalItem;
                const purchaseItem = activePurchase?.items?.find((candidate) => candidate.id === item.purchaseItemId);
                const authorization = getAuthorizedReceptionPhysicalCorrection({ reviews: purchaseQuantityReviewRequests.filter((review) => !targetReviewRequestId || review.id === targetReviewRequestId), workspaceId: workspaceId || activePurchase?.workspaceId, purchaseId: activePurchase?.id, purchaseItemId: item.purchaseItemId, receptionId: reception.id, currentVersion: purchaseItem?.version });
                const alreadyCorrected = corrections.some((correction) => correction.reviewRequestId === authorization?.id && correction.receptionItemId === item.id && correction.status === 'active');
                return <article key={item.id} className={highlightedReceptionItemId === item.id ? 'reception-item-highlight' : ''}><strong>{item.material} · {item.unit}</strong><span>Original: recibido {item.receivedQuantity} · aceptado {item.acceptedQuantity} · dañado {item.damagedQuantity} · rechazado {item.rejectedQuantity} · faltante {item.missingQuantity || 0}</span><span>Efectivo: recibido {effectiveItem.receivedQuantity} · aceptado {effectiveItem.acceptedQuantity} · v{effectiveItem.effectiveVersion}</span><span>Precio real {effectiveItem.actualUnitCost || 0} · cargos {effectiveItem.additionalCharges || 0} · descuentos {effectiveItem.discounts || 0} · total ${item.totalReal.toFixed(2)}</span><span>Proveedor {item.supplier || 'no disponible'} · v{item.version} · partida {item.id}</span><small>{item.observations || reception.observations || 'Sin observaciones'} · evidencias {Array.isArray(item.evidence) ? item.evidence.join(', ') : 'sin evidencias'}</small>{effectiveItem.activeCorrections?.map((correction) => <small key={correction.id} className="reception-correction-history">Corrección física · {correction.previousValues?.acceptedQuantity ?? item.acceptedQuantity} → {correction.newValues?.acceptedQuantity ?? effectiveItem.acceptedQuantity} · {correction.reason} · {displayDate(correction.occurredAt)} · {String(correction.createdBy || '').slice(0, 8) || 'responsable no disponible'}</small>)}{authorization && !alreadyCorrected && !reception.revertedAt && <ReceptionItemRealCorrectionForm workspaceId={workspaceId || activePurchase?.workspaceId} reception={reception} receptionItem={originalItem} effectiveItem={effectiveItem} purchase={activePurchase} purchaseItem={purchaseItem} review={authorization} autoOpen={Boolean(targetCorrectionMode && targetReceptionItemId === item.id)} disabled={mutationBlocked} onCreateCorrection={onCreateReceptionItemRealCorrection} />}{authorization && alreadyCorrected && <small>Corrección física registrada; la proyección efectiva conserva el historial original.</small>}</article>;
              })}</div>{reception.revertedAt && <small>Revertida {displayDate(reception.revertedAt)} · {reception.reversalReason || 'Sin motivo'} · por {String(reception.revertedBy || '').slice(0, 8)}</small>}{!mutationBlocked && !reception.revertedAt && <button type="button" className="ghost" onClick={() => onDelete?.(reception.id, reception.version)}>Revertir recepción</button>}</details>;
            })
            : <p>No hay recepciones registradas.</p>}</article>
            <article className="receiving-incidents"><h3>Incidencias globales</h3><span>Dañado: {decimal(summary?.damagedQuantity || 0, 2)}</span><span>Rechazado: {decimal(summary?.rejectedQuantity || 0, 2)}</span><span>Faltante: {decimal(summary?.missingQuantity || 0, 2)}</span></article>
          </aside>
        </div>
      )}
      {showReceipt && activePurchase && <div className="reception-receipt-dialog" role="dialog" aria-modal="true" aria-label="Comprobante de recepción"><div className="reception-receipt-actions"><button type="button" className="ghost" onClick={() => setShowReceipt(false)}>Cerrar</button><button type="button" onClick={() => window.print()}>Imprimir comprobante</button></div><ReceptionReceipt purchase={activePurchase} receptions={relatedReceptions} summary={receptionFinancialSummary} form={form} money={(value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0)} decimal={decimal} draft={!receiptReadiness.definitive} /></div>}
    </section>
  );
}
