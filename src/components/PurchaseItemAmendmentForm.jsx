import { useEffect, useState } from 'react';
import { createUuid } from '../lib/identity/createUuid.js';
import { canApplyAuthorizedPurchaseCorrection } from '../lib/purchases/purchaseQuantityReviewSelectors.js';

export function purchaseDateInputValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 23);
}

const amendmentFields = Object.freeze([
  'requiredQuantity', 'purchasedQuantity', 'purchasedAt', 'unitCost', 'supplier',
  'additionalCharges', 'discounts', 'unit', 'notes',
]);

export function createPurchaseItemAmendmentValues(item = {}) {
  return {
    requiredQuantity: item.requiredQuantity ?? item.quantity,
    purchasedQuantity: item.purchasedQuantity || 0,
    purchasedAt: purchaseDateInputValue(item.purchasedAt),
    unitCost: item.unitCost,
    supplier: item.supplier || '',
    additionalCharges: item.additionalCharges || 0,
    discounts: item.discounts || 0,
    unit: item.unit,
    notes: item.notes || '',
    reason: '',
    amendmentNotes: '',
  };
}

export function buildPurchaseItemAmendmentRequest(item = {}, values = {}) {
  const previousValues = Object.fromEntries(amendmentFields.map((field) => (
    [field, item[field] ?? '']
  )));
  const purchasedAt = values.purchasedAt === purchaseDateInputValue(item.purchasedAt)
    ? (item.purchasedAt || '')
    : values.purchasedAt ? new Date(values.purchasedAt).toISOString() : '';
  const normalizedValues = { ...values, purchasedAt };
  const requestedChanges = Object.fromEntries(amendmentFields
    .filter((field) => String(previousValues[field] ?? '') !== String(normalizedValues[field] ?? ''))
    .map((field) => [field, normalizedValues[field]]));
  return { previousValues, requestedChanges };
}

export default function PurchaseItemAmendmentForm({ purchase, item, sourceModule, actorRole, disabled, onAmend, acceptedQuantity = 0, reviewState, authorizedCorrection, onCreateReviewRequest }) {
  const [reviewError, setReviewError] = useState('');
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(null);
  const values = draft || createPurchaseItemAmendmentValues(item);
  const update = (field, value) => setDraft({ ...values, [field]: value });
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setDraft(null);
        setOpen(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);
  const submit = (event) => {
    event.preventDefault();
    if (authorizedCorrection && !canApplyAuthorizedPurchaseCorrection({ authorization: authorizedCorrection, nextPurchasedQuantity: values.purchasedQuantity, currentVersion: item.version, acceptedQuantity })) return;
    const { previousValues, requestedChanges } = buildPurchaseItemAmendmentRequest(item, values);
    if (onAmend?.(purchase.id, item.id, { previousValues: { ...previousValues, acceptedQuantity }, requestedChanges, reason: values.reason,
      notes: values.amendmentNotes, sourceModule, actorRole })) {
      setDraft(null); setOpen(false);
    }
  };
  const requestReview = async () => {
    if (!values.reason.trim()) return;
    setReviewError('');
    let id;
    try { id = createUuid(); } catch (error) {
      setReviewError(error?.message || 'No se pudo generar el UUID de la revisión.');
      return;
    }
    const result = await onCreateReviewRequest?.({ id, workspaceId: purchase.workspaceId, purchaseId: purchase.id, purchaseItemId: item.id, requestedPurchasedQuantity: Number(values.purchasedQuantity), reason: values.reason, notes: values.amendmentNotes, sourceModule, expectedVersion: item.version, idempotencyKey: `${item.id}:${item.version}:${values.purchasedQuantity}` });
    if (!result?.error) { setDraft(null); setOpen(false); }
  };
  if (!open) return <button type="button" className="ghost" disabled={disabled} onClick={() => setOpen(true)}>{item.purchasedQuantity > 0 ? 'Corregir compra' : 'Marcar como comprado'}</button>;
  const authorizedValue = authorizedCorrection?.requestedPurchasedQuantity;
  const authorizedExact = authorizedCorrection && canApplyAuthorizedPurchaseCorrection({ authorization: authorizedCorrection, nextPurchasedQuantity: values.purchasedQuantity, currentVersion: item.version, acceptedQuantity });
  return (
    <form className="purchase-amendment-form" onSubmit={submit}>
      <strong>Corrección explícita · versión {item.version}</strong>
      {reviewError && <p role="alert">{reviewError}</p>}
      <label>Cantidad necesaria actual<input aria-label="Cantidad necesaria actual" type="number" min="0" step="any" value={values.requiredQuantity} onChange={(e) => update('requiredQuantity', e.target.value)} /><small>Corrige lo que realmente se necesita comprar desde este punto. La cantidad original de Cotización permanece en el historial.</small></label>
      <label>Cantidad comprada<input aria-label="Cantidad comprada" type="number" min="0" step="any" value={values.purchasedQuantity} onChange={(e) => update('purchasedQuantity', e.target.value)} /><small>Registra cuánto se compró realmente. No modifica la cantidad original cotizada.</small></label>
      {authorizedCorrection ? <p className="inline-notice">Corrección autorizada por Owner/Admin · revisión {authorizedCorrection.id.slice(0, 8)} · cantidad autorizada: {authorizedValue}.</p> : Number(values.purchasedQuantity) < Number(acceptedQuantity) && <p className="inline-notice">Mínimo permitido: {acceptedQuantity}. La reducción requiere solicitar revisión.</p>}
      {authorizedCorrection && !authorizedExact && <p className="inline-notice">Esta autorización solo permite guardar exactamente {authorizedValue}.</p>}
      {reviewState && <p className="inline-notice">Revisión administrativa: {reviewState.status}.</p>}
      <label>Fecha de compra<input aria-label="Fecha real de compra" type="datetime-local" step="0.001" required={Number(values.purchasedQuantity) > 0} value={values.purchasedAt} onInput={(e) => update('purchasedAt', e.currentTarget.value)} /></label>
      <label>Unidad<input aria-label="Unidad corregida" value={values.unit} onChange={(e) => update('unit', e.target.value)} /></label>
      <label>Precio unitario<input aria-label="Precio unitario corregido" type="number" min="0" step="any" value={values.unitCost} onChange={(e) => update('unitCost', e.target.value)} /></label>
      <label>Cargos<input aria-label="Cargos adicionales" type="number" min="0" step="any" value={values.additionalCharges} onChange={(e) => update('additionalCharges', e.target.value)} /></label>
      <label>Descuentos<input aria-label="Descuentos" type="number" min="0" step="any" value={values.discounts} onChange={(e) => update('discounts', e.target.value)} /></label>
      <label>Proveedor<input aria-label="Proveedor corregido" value={values.supplier} onChange={(e) => update('supplier', e.target.value)} /></label>
      <label>Observaciones<textarea aria-label="Observaciones corregidas" value={values.notes} onChange={(e) => update('notes', e.target.value)} /></label>
      <label>Motivo obligatorio<textarea required aria-label="Motivo de corrección" value={values.reason} onChange={(e) => update('reason', e.target.value)} /></label>
      <label>Notas del evento<textarea aria-label="Notas de corrección" value={values.amendmentNotes} onChange={(e) => update('amendmentNotes', e.target.value)} /></label>
      <span>Necesario actual {Number(values.requiredQuantity)} · ordenado originalmente {Number(item.quantity)} · comprado {Number(values.purchasedQuantity)} {values.unit} · costo comprado {(Math.max(0, Number(values.purchasedQuantity) * Number(values.unitCost) + Number(values.additionalCharges) - Number(values.discounts))).toFixed(2)}</span>
      <div>{authorizedCorrection ? <button type="submit" disabled={!authorizedExact}>Aplicar corrección autorizada</button> : Number(values.purchasedQuantity) < Number(acceptedQuantity) ? <button type="button" disabled={!values.reason.trim() || !onCreateReviewRequest} onClick={requestReview}>Solicitar revisión</button> : <button type="submit">Registrar compra/corrección</button>}<button type="button" className="ghost" onClick={() => { setDraft(null); setOpen(false); }}>Cancelar</button></div>
    </form>
  );
}
