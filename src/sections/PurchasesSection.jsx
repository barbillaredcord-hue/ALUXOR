import { CheckCircle2, Circle, Clock3, Printer, ShoppingCart } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PURCHASE_STATUSES,
  getPurchasesSummary,
  normalizePurchaseStatus,
} from '../lib/purchases/purchaseSummary.js';
import { sortPurchaseItems } from '../lib/purchases/purchaseEngine.js';

const statusConfig = {
  [PURCHASE_STATUSES.PENDING]: { label: 'Pendiente', icon: Circle },
  [PURCHASE_STATUSES.PURCHASED]: { label: 'Comprado', icon: Clock3 },
  [PURCHASE_STATUSES.RECEIVED]: { label: 'Recibido', icon: CheckCircle2 },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PURCHASE_DATE_FIELDS = new Set(['orderedAt', 'expectedAt', 'receivedAt']);

export function dateTimeInput(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function purchaseDateFromInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function displayDate(value) {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 'Por definir' : new Date(parsed).toLocaleDateString('es-MX');
}

function shortId(value) {
  const id = String(value || '').trim();
  return id.length > 8 ? `${id.slice(0, 8)}…` : (id || 'Por definir');
}

export function isPurchaseOverdue(purchase, now = Date.now()) {
  const expected = Date.parse(purchase?.expectedAt || '');
  return purchase?.status !== PURCHASE_STATUSES.RECEIVED
    && !Number.isNaN(expected)
    && expected < Number(now);
}

export function filterPurchases(purchases = [], filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase('es-MX');
  const status = String(filters.status || '').trim();
  return (Array.isArray(purchases) ? purchases : []).filter((purchase) => {
    if (status && purchase.status !== status) return false;
    if (!query) return true;
    return [
      purchase.folio,
      purchase.supplier,
      purchase.clientName,
      purchase.projectName,
      purchase.quoteId,
      purchase.productionOrderFolio,
      purchase.productionOrderId,
    ].some((value) => String(value || '').toLocaleLowerCase('es-MX').includes(query));
  });
}

export function purchaseDraftFieldKey(purchaseId, field) {
  return `${purchaseId}:purchase:${field}`;
}

export function purchaseItemDraftFieldKey(purchaseId, itemId, field) {
  return `${purchaseId}:item:${itemId}:${field}`;
}

function draftKeyParts(path) {
  const [purchaseId, scope, itemIdOrField, itemField] = String(path).split(':');
  return scope === 'item'
    ? { purchaseId, scope, itemId: itemIdOrField, field: itemField }
    : { purchaseId, scope, field: itemIdOrField };
}

function editorValue(purchase, path) {
  const key = draftKeyParts(path);
  if (key.purchaseId !== purchase?.id) return undefined;
  if (key.scope !== 'item') return purchase?.[key.field];
  return purchase?.items?.find((item) => item.id === key.itemId)?.[key.field];
}

export function purchaseDraftFieldPending(purchase, path) {
  const key = draftKeyParts(path);
  if (key.purchaseId !== purchase?.id) return false;
  if (key.scope !== 'item') {
    return Boolean(purchase.pendingSync && purchase.pendingFields?.includes(key.field));
  }
  const item = purchase.items?.find((candidate) => candidate.id === key.itemId);
  return Boolean(item?.pendingSync && item.pendingFields?.includes(key.field));
}

export function purchaseEditorValuesEqual(left, right, field = '') {
  if (PURCHASE_DATE_FIELDS.has(field)) {
    const leftTime = left ? Date.parse(left) : null;
    const rightTime = right ? Date.parse(right) : null;
    return leftTime === rightTime;
  }
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
  }
  return String(left ?? '') === String(right ?? '');
}

export function mergePurchaseEditorDraft(remote, draft, dirtyFields = new Set()) {
  if (!remote) return null;
  if (!draft || draft.id !== remote.id) return structuredClone(remote);
  const next = structuredClone(remote);
  dirtyFields.forEach((path) => {
    const key = draftKeyParts(path);
    if (key.purchaseId !== remote.id) return;
    if (key.scope !== 'item') {
      next[key.field] = draft[key.field];
      return;
    }
    const nextItem = next.items?.find((item) => item.id === key.itemId);
    const draftItem = draft.items?.find((item) => item.id === key.itemId);
    if (nextItem && draftItem) nextItem[key.field] = draftItem[key.field];
  });
  return next;
}

export function reconcilePurchaseEditorDirtyFields(remote, draft, dirtyFields = new Set()) {
  const next = new Set(dirtyFields);
  next.forEach((path) => {
    const { field } = draftKeyParts(path);
    const pending = purchaseDraftFieldPending(remote, path);
    const confirmed = purchaseEditorValuesEqual(
      editorValue(remote, path),
      editorValue(draft, path),
      field,
    );
    if (!pending || confirmed) next.delete(path);
  });
  return next;
}

export default function PurchasesSection({
  purchases = [],
  activePurchase,
  selectedPurchaseId,
  setSelectedPurchaseId,
  updatePurchase,
  updatePurchaseItem,
  flushPurchaseSave,
  purchasesLoading = false,
  purchasesError = '',
  purchasesSyncStatus = '',
  canManage = false,
  money,
  decimal,
}) {
  const [indexQuery, setIndexQuery] = useState('');
  const [indexStatus, setIndexStatus] = useState('');
  const [draft, setDraft] = useState(() => (
    activePurchase ? structuredClone(activePurchase) : null
  ));
  const draftRef = useRef(draft);
  const flushSaveRef = useRef(flushPurchaseSave);
  const dirtyFieldsRef = useRef(new Set());
  const focusedFieldRef = useRef(null);
  const displayPurchase = draft?.id === activePurchase?.id ? draft : activePurchase;
  flushSaveRef.current = flushPurchaseSave;
  const purchaseItems = useMemo(
    () => sortPurchaseItems(displayPurchase?.items || []),
    [displayPurchase?.items],
  );
  const summary = getPurchasesSummary(displayPurchase ? [displayPurchase] : []);
  const pendingItems = purchaseItems.filter((item) => (
    normalizePurchaseStatus(item.status) === PURCHASE_STATUSES.PENDING
  ));
  const groups = useMemo(() => purchaseItems.reduce((result, item) => {
    const group = item.group || 'Materiales';
    result[group] = [...(result[group] || []), item];
    return result;
  }, {}), [purchaseItems]);
  const filteredPurchases = useMemo(() => filterPurchases(purchases, {
    query: indexQuery,
    status: indexStatus,
  }), [indexQuery, indexStatus, purchases]);

  useEffect(() => {
    if (!activePurchase) {
      dirtyFieldsRef.current.clear();
      focusedFieldRef.current = null;
      draftRef.current = null;
      setDraft(null);
      return;
    }
    setDraft((current) => {
      if (current?.id !== activePurchase.id) {
        dirtyFieldsRef.current.clear();
        focusedFieldRef.current = null;
      } else {
        dirtyFieldsRef.current = reconcilePurchaseEditorDirtyFields(
          activePurchase,
          current,
          dirtyFieldsRef.current,
        );
      }
      const next = mergePurchaseEditorDraft(
        activePurchase,
        current,
        dirtyFieldsRef.current,
      );
      draftRef.current = next;
      return next;
    });
  }, [activePurchase]);

  useEffect(() => () => {
    if (draftRef.current?.id) void flushSaveRef.current?.(draftRef.current.id);
  }, [activePurchase?.id]);

  const updateHeader = (changes) => {
    if (!displayPurchase || !canManage) return;
    Object.keys(changes).forEach((field) => {
      if (!purchaseEditorValuesEqual(displayPurchase[field], changes[field], field)) {
        dirtyFieldsRef.current.add(purchaseDraftFieldKey(displayPurchase.id, field));
      }
    });
    const next = { ...displayPurchase, ...changes };
    draftRef.current = next;
    setDraft(next);
    updatePurchase(displayPurchase.id, changes);
  };
  const updateItem = (itemId, changes) => {
    if (!displayPurchase || !canManage) return;
    const currentItem = displayPurchase.items.find((item) => item.id === itemId);
    Object.keys(changes).forEach((field) => {
      if (!purchaseEditorValuesEqual(currentItem?.[field], changes[field], field)) {
        dirtyFieldsRef.current.add(purchaseItemDraftFieldKey(displayPurchase.id, itemId, field));
      }
    });
    const next = {
      ...displayPurchase,
      items: displayPurchase.items.map((item) => (
        item.id === itemId ? { ...item, ...changes } : item
      )),
    };
    draftRef.current = next;
    setDraft(next);
    updatePurchaseItem(displayPurchase.id, itemId, changes);
  };
  const focusField = (path) => { focusedFieldRef.current = path; };
  const blurField = () => {
    focusedFieldRef.current = null;
    if (displayPurchase?.id) void flushPurchaseSave?.(displayPurchase.id);
  };
  const enterField = (event) => {
    if (event.key === 'Enter' && displayPurchase?.id) {
      void flushPurchaseSave?.(displayPurchase.id);
    }
  };
  const markAllBought = () => {
    if (!displayPurchase || !canManage) return;
    purchaseItems.forEach((item) => {
      if (normalizePurchaseStatus(item.status) !== PURCHASE_STATUSES.PURCHASED) {
        dirtyFieldsRef.current.add(purchaseItemDraftFieldKey(
          displayPurchase.id,
          item.id,
          'status',
        ));
      }
    });
    const items = purchaseItems.map((item) => ({
        ...item,
        status: PURCHASE_STATUSES.PURCHASED,
      }));
    const next = { ...displayPurchase, items, status: PURCHASE_STATUSES.PURCHASED };
    draftRef.current = next;
    setDraft(next);
    updatePurchase(displayPurchase.id, {
      items,
    });
  };
  const printList = () => {
    if (!displayPurchase) return;
    const rows = purchaseItems.map((item) => (
      `<li><strong>${escapeHtml(item.name)}</strong> - ${escapeHtml(`${decimal(item.quantity)} ${item.unit}`)} <span>${escapeHtml(item.group)}</span></li>`
    )).join('');
    const html = `<!doctype html><html><head><title>Lista de compras</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#17201b}h1{margin:0 0 6px}p{color:#526159}li{margin:10px 0;padding:10px;border-bottom:1px solid #ddd}span{color:#617068}</style></head><body><h1>Lista de compras ALUXOR</h1><p>${escapeHtml(displayPurchase.folio)} · ${escapeHtml(displayPurchase.supplier || 'Proveedor pendiente')}</p><ul>${rows}</ul></body></html>`;
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

  return (
    <section className="purchases-section panel">
      <header className="purchases-hero">
        <div>
          <span>Centro de compras</span>
          <h2>{displayPurchase?.folio || 'Órdenes de compra'}</h2>
          <p>{activePurchase ? 'Compra generada desde Orden de Producción' : 'Consulta todas las órdenes del workspace.'}</p>
        </div>
        <ShoppingCart size={34} />
      </header>

      {(purchasesLoading || purchasesError || purchasesSyncStatus) && (
        <div className="purchase-actions" aria-live="polite">
          {purchasesLoading && <span>Cargando compras…</span>}
          {purchasesError && <span role="alert">{purchasesError}</span>}
          {!purchasesError && purchasesSyncStatus && <span>{purchasesSyncStatus}</span>}
        </div>
      )}

      {!activePurchase && (
        <>
          <div className="purchase-actions">
            <input
              type="search"
              aria-label="Buscar compras"
              placeholder="Buscar por folio, proveedor, cliente, proyecto u OT"
              value={indexQuery}
              onChange={(event) => setIndexQuery(event.target.value)}
            />
            <select
              aria-label="Filtrar compras por estado"
              value={indexStatus}
              onChange={(event) => setIndexStatus(event.target.value)}
            >
              <option value="">Todos los estados</option>
              {Object.entries(statusConfig).map(([value, config]) => (
                <option key={value} value={value}>{config.label}</option>
              ))}
            </select>
          </div>
          <div className="purchase-groups">
            <article className="purchase-group">
              <h3>Órdenes del workspace · {filteredPurchases.length}</h3>
              {filteredPurchases.length ? filteredPurchases.map((purchase) => {
                const purchaseSummary = getPurchasesSummary([purchase]);
                const overdue = isPurchaseOverdue(purchase);
                return (
                  <button
                    key={purchase.id}
                    type="button"
                    className={`purchase-item purchase-item-${normalizePurchaseStatus(purchase.status)}`}
                    onClick={() => setSelectedPurchaseId?.(purchase.id)}
                  >
                    <ShoppingCart size={18} />
                    <span>
                      <strong>{purchase.folio} · {purchase.supplier || 'Proveedor pendiente'}</strong>
                      <span>{purchase.clientName || 'Cliente pendiente'} · {purchase.projectName || 'Proyecto sin nombre'}</span>
                      <span>Cotización {shortId(purchase.quoteId)} · OT {purchase.productionOrderFolio || shortId(purchase.productionOrderId)}</span>
                      <span>
                        {purchaseSummary.total} partida(s) · {new Set((purchase.items || []).map((item) => item.supplier).filter(Boolean)).size} proveedor(es) · {money(purchaseSummary.totalCost)} · {purchase.status}
                      </span>
                      <span>Fecha {displayDate(purchase.createdAt)} · Esperada {displayDate(purchase.expectedAt)}</span>
                      <span>{purchase.pendingSync || purchase.items?.some((item) => item.pendingSync) ? 'Pendiente de sincronizar' : 'Sincronizada'}{overdue ? ' · Retrasada' : ''}</span>
                    </span>
                  </button>
                );
              }) : <p>No hay órdenes de compra.</p>}
            </article>
          </div>
        </>
      )}

      {displayPurchase ? (
        <>
          <div className="purchase-stats">
            <div><span>Pendientes</span><strong>{summary.pending}</strong></div>
            <div><span>Comprados</span><strong>{summary.purchased}</strong></div>
            <div><span>Recibidos</span><strong>{summary.received}</strong></div>
            <div><span>Progreso</span><strong>{decimal(summary.progress, 0)}%</strong><div className="purchase-progress"><i style={{ width: `${summary.progress}%` }} /></div></div>
          </div>

          <div className="form-grid">
            <label>Compra
              <select value={selectedPurchaseId || ''} onChange={(event) => {
                void flushPurchaseSave?.(displayPurchase.id);
                setSelectedPurchaseId(event.target.value);
              }}>
                {purchases.map((purchase) => <option key={purchase.id} value={purchase.id}>{purchase.folio}</option>)}
              </select>
            </label>
            <label>Folio
              <input disabled={!canManage} value={displayPurchase.folio} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'folio'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ folio: event.target.value })} />
            </label>
            <label>Proveedor
              <input disabled={!canManage} value={displayPurchase.supplier} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'supplier'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ supplier: event.target.value })} />
            </label>
            <label>Estado
              <select disabled={!canManage} value={displayPurchase.status} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'status'))} onBlur={blurField} onChange={(event) => updateHeader({ status: event.target.value })}>
                {Object.entries(statusConfig).map(([value, config]) => <option key={value} value={value}>{config.label}</option>)}
              </select>
            </label>
            <label>Fecha de compra
              <input disabled={!canManage} type="datetime-local" value={dateTimeInput(displayPurchase.orderedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'orderedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ orderedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Fecha esperada
              <input disabled={!canManage} type="datetime-local" value={dateTimeInput(displayPurchase.expectedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'expectedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ expectedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Fecha de recepción
              <input disabled={!canManage} type="datetime-local" value={dateTimeInput(displayPurchase.receivedAt)} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'receivedAt'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateHeader({ receivedAt: purchaseDateFromInput(event.target.value) })} />
            </label>
            <label>Notas
              <textarea disabled={!canManage} value={displayPurchase.notes} onFocus={() => focusField(purchaseDraftFieldKey(displayPurchase.id, 'notes'))} onBlur={blurField} onChange={(event) => updateHeader({ notes: event.target.value })} />
            </label>
          </div>

          <div className="purchase-actions">
            <button type="button" className="ghost" onClick={() => {
              void flushPurchaseSave?.(displayPurchase.id);
              setSelectedPurchaseId?.(null);
            }}>Volver al índice</button>
            <button type="button" disabled={!canManage} onClick={markAllBought}>Marcar todo como comprado</button>
            <button type="button" className="ghost" onClick={printList}><Printer size={18} /> Generar lista imprimible</button>
          </div>

          <div className="purchases-layout">
            <div className="purchase-groups">
              {Object.entries(groups).map(([group, items]) => (
                <article key={group} className="purchase-group">
                  <h3>{group}</h3>
                  {items.map((item) => {
                    const status = normalizePurchaseStatus(item.status);
                    const Icon = statusConfig[status].icon;
                    return (
                      <div key={item.id} className={`purchase-item purchase-item-${status}`}>
                        <Icon size={18} />
                        <div>
                          <input disabled={!canManage} aria-label="Material" value={item.name} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'name'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { name: event.target.value })} />
                          <span>{decimal(item.quantity)} {item.unit} · {money(item.quantity * item.unitCost)}</span>
                          <span>
                            <input disabled={!canManage} aria-label="Cantidad" type="number" min="0" step="any" value={item.quantity} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'quantity'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />
                            <input disabled={!canManage} aria-label="Costo unitario" type="number" min="0" step="any" value={item.unitCost} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'unitCost'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { unitCost: event.target.value })} />
                          </span>
                          <input disabled={!canManage} aria-label="Proveedor de partida" value={item.supplier || ''} placeholder="Proveedor" onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'supplier'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { supplier: event.target.value })} />
                          <input disabled={!canManage} aria-label="Fecha de partida" type="datetime-local" value={dateTimeInput(item.itemDate)} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'itemDate'))} onBlur={blurField} onKeyDown={enterField} onChange={(event) => updateItem(item.id, { itemDate: event.target.value })} />
                          <textarea disabled={!canManage} aria-label="Notas de partida" value={item.notes || ''} placeholder="Notas" onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'notes'))} onBlur={blurField} onChange={(event) => updateItem(item.id, { notes: event.target.value })} />
                        </div>
                        <select disabled={!canManage} value={status} onFocus={() => focusField(purchaseItemDraftFieldKey(displayPurchase.id, item.id, 'status'))} onBlur={blurField} onChange={(event) => updateItem(item.id, { status: event.target.value })}>
                          {Object.entries(statusConfig).map(([value, config]) => (
                            <option key={value} value={value}>{config.label}</option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>

            <aside className="purchase-pending">
              <h3>Pendientes de compra</h3>
              <strong>Total: {money(summary.totalCost)}</strong>
              {pendingItems.length > 0 ? pendingItems.map((item) => (
                <span key={item.id}>{item.name} · {decimal(item.quantity)} {item.unit}</span>
              )) : <p>No hay materiales pendientes.</p>}
            </aside>
          </div>
        </>
      ) : null}
    </section>
  );
}
