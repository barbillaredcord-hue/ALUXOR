import { useEffect, useMemo, useRef, useState } from 'react';
import { createUuid } from '../lib/identity/createUuid.js';

export const RECEPTION_CORRECTION_FIELDS = Object.freeze([
  'receivedQuantity', 'acceptedQuantity', 'damagedQuantity', 'rejectedQuantity', 'missingQuantity',
  'actualUnitCost', 'additionalCharges', 'discounts',
]);

const number = (value) => Math.max(0, Number(value) || 0);
const currentValues = (item = {}) => Object.fromEntries(RECEPTION_CORRECTION_FIELDS.map((field) => [field, number(item[field])]));

export function getReceptionItemCorrectionChanges(effectiveItem = {}, draft = {}) {
  const effective = currentValues(effectiveItem);
  return Object.fromEntries(RECEPTION_CORRECTION_FIELDS
    .filter((field) => number(draft[field]) !== effective[field])
    .map((field) => [field, number(draft[field])]));
}

export function buildReceptionItemRealCorrectionInput({
  workspaceId,
  reception,
  receptionItem,
  effectiveItem,
  purchase,
  purchaseItem,
  review,
  values,
  acceptedQuantity,
  reason,
  notes,
  idempotencyKey,
  occurredAt = new Date().toISOString(),
} = {}) {
  const newValues = values
    ? getReceptionItemCorrectionChanges(effectiveItem, values)
    : { acceptedQuantity: number(acceptedQuantity) };
  return {
    workspaceId,
    receptionId: reception?.id,
    receptionItemId: receptionItem?.id,
    purchaseId: purchase?.id,
    purchaseItemId: purchaseItem?.id,
    reviewRequestId: review?.id,
    correctionType: 'REAL_DATA_CORRECTION',
    newValues,
    reason: String(reason || '').trim(),
    notes: String(notes || '').trim(),
    occurredAt,
    expectedVersion: Number(effectiveItem?.effectiveVersion) || Number(receptionItem?.version) || 1,
    idempotencyKey,
  };
}

export default function ReceptionItemRealCorrectionForm({
  workspaceId,
  reception,
  receptionItem,
  effectiveItem,
  purchase,
  purchaseItem,
  review,
  autoOpen = false,
  disabled = false,
  onCreateCorrection,
}) {
  const effective = useMemo(() => currentValues(effectiveItem), [effectiveItem]);
  const [open, setOpen] = useState(autoOpen);
  const [draft, setDraft] = useState(effective);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const idempotencyKeyRef = useRef(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) setDraft(effective);
  }, [effective, open]);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);

  const changes = useMemo(() => getReceptionItemCorrectionChanges(effectiveItem, draft), [draft, effectiveItem]);
  const hasChanges = Object.keys(changes).length > 0;
  const resetAttempt = () => { idempotencyKeyRef.current = null; setSuccess(false); };
  const update = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    resetAttempt();
  };
  const save = async () => {
    if (submittingRef.current || saving || disabled) return;
    if (!reason.trim()) { setError('Indica el motivo de la corrección.'); return; }
    if (!hasChanges) { setError('No hay cambios que registrar.'); return; }
    if (number(draft.acceptedQuantity) > number(draft.receivedQuantity)) {
      setError('La cantidad aceptada no puede ser mayor que la recibida efectiva.');
      return;
    }
    submittingRef.current = true;
    setSaving(true);
    setError('');
    if (!idempotencyKeyRef.current) idempotencyKeyRef.current = createUuid();
    const result = await onCreateCorrection?.(buildReceptionItemRealCorrectionInput({
      workspaceId, reception, receptionItem, effectiveItem, purchase, purchaseItem, review,
      values: draft, reason, notes, idempotencyKey: idempotencyKeyRef.current,
    }));
    submittingRef.current = false;
    setSaving(false);
    if (result?.error) {
      setError(result.error.message || result.error.code || 'No fue posible registrar la corrección.');
      return;
    }
    setSuccess(true);
    setOpen(false);
    idempotencyKeyRef.current = null;
  };

  return <section className="reception-item-real-correction" data-reception-item-id={receptionItem?.id}>
    <button type="button" disabled={disabled} onClick={() => setOpen((current) => !current)}>
      Registrar corrección
    </button>
    {success && <p className="reception-correction-success" role="status">Corrección registrada.</p>}
    {open && <div className="reception-item-real-correction-form">
      <strong>Corrección física autorizada · solo esta partida</strong>
      <span>Original: recibido {number(receptionItem?.receivedQuantity)} · aceptado {number(receptionItem?.acceptedQuantity)} · v{receptionItem?.version || 1}</span>
      <span>Efectivo actual: recibido {effective.receivedQuantity} · aceptado {effective.acceptedQuantity} · v{effectiveItem?.effectiveVersion || receptionItem?.version || 1}</span>
      <label>Cantidad aceptada real<input aria-label="Cantidad aceptada real" type="number" min="0" max={number(draft.receivedQuantity)} value={draft.acceptedQuantity} onChange={(event) => update('acceptedQuantity', event.target.value)} disabled={saving || disabled} /></label>
      <label>Motivo<textarea aria-label="Motivo de corrección física" value={reason} onChange={(event) => { setReason(event.target.value); resetAttempt(); }} disabled={saving || disabled} /></label>
      <label>Notas opcionales<textarea aria-label="Notas de corrección física" value={notes} onChange={(event) => { setNotes(event.target.value); resetAttempt(); }} disabled={saving || disabled} /></label>
      <details><summary>Más datos</summary><div className="reception-correction-advanced-fields">
        <label>Recibido<input type="number" min="0" value={draft.receivedQuantity} onChange={(event) => update('receivedQuantity', event.target.value)} disabled={saving || disabled} /></label>
        <label>Dañado<input type="number" min="0" value={draft.damagedQuantity} onChange={(event) => update('damagedQuantity', event.target.value)} disabled={saving || disabled} /></label>
        <label>Rechazado<input type="number" min="0" value={draft.rejectedQuantity} onChange={(event) => update('rejectedQuantity', event.target.value)} disabled={saving || disabled} /></label>
        <label>Faltante<input type="number" min="0" value={draft.missingQuantity} onChange={(event) => update('missingQuantity', event.target.value)} disabled={saving || disabled} /></label>
        <label>Precio unitario real<input type="number" min="0" step="any" value={draft.actualUnitCost} onChange={(event) => update('actualUnitCost', event.target.value)} disabled={saving || disabled} /></label>
        <label>Cargos<input type="number" min="0" step="any" value={draft.additionalCharges} onChange={(event) => update('additionalCharges', event.target.value)} disabled={saving || disabled} /></label>
        <label>Descuentos<input type="number" min="0" step="any" value={draft.discounts} onChange={(event) => update('discounts', event.target.value)} disabled={saving || disabled} /></label>
      </div></details>
      <small>Proveedor: {purchaseItem?.supplier || 'no disponible'} · observaciones: {receptionItem?.observations || reception?.observations || 'sin observaciones'}</small>
      {!hasChanges && <small>No hay cambios que registrar.</small>}
      {error && <p className="inline-notice" role="alert">{error}</p>}
      <button type="button" disabled={saving || disabled || !hasChanges} onClick={save}>{saving ? 'Registrando…' : 'Registrar corrección'}</button>
    </div>}
  </section>;
}
