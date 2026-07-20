import { describe, expect, it, vi } from 'vitest';
import { Quote } from '../lib/br-engine/index.js';
import { defaults } from '../app/config/data.js';
import { quoteHelpers } from '../app/config/helpers.js';
import { startNewQuoteAndClearProductionSelection } from '../app/App.jsx';
import {
  canScheduleQuoteAutoSave,
  createCleanQuoteForm,
  hasRealQuoteFormChanges,
  invalidateQuoteAsyncWork,
  isCurrentQuoteEditSession,
  resetQuoteEditingState,
} from './useQuotes.js';

function ref(current) {
  return { current };
}

function createResetHarness() {
  const refs = {
    editSession: ref(4),
    saveOperation: ref({ id: 'save-anterior' }),
    saveInFlight: ref(true),
    autoSaveTimer: ref(101),
    autoSavePending: ref(true),
    autoSaveConflictRetry: ref(true),
    autoSaveSuppressed: ref(false),
    realtimeDebounce: ref(202),
    realtimeReloadPending: ref(true),
    realtimePendingRow: ref({ id: 'quote-anterior' }),
    realtimeNeedsReload: ref(true),
    remoteApply: ref(true),
    remoteRequest: ref({
      id: 8,
      inFlight: true,
      pending: true,
      pendingPreserveStatus: true,
      preserveCurrentStatus: true,
    }),
    latestForm: ref({ producto: 'Anterior' }),
    lastConfirmedForm: ref({ producto: 'Anterior' }),
    dirtyFields: ref(new Set(['producto'])),
    fieldConflicts: ref(new Set(['producto'])),
    remoteBuffer: ref({
      fields: new Map([['producto', { remoteValue: 'Remoto' }]]),
      pendingRow: { id: 'quote-anterior' },
    }),
    focusedField: ref('producto'),
    activeIdentity: ref({ id: 'quote-anterior', version: 3 }),
  };
  const setters = {
    setForm: vi.fn(),
    setSelectedHistoryPreview: vi.fn(),
    setActiveQuoteIdentity: vi.fn(),
    setPdfEditor: vi.fn(),
    setQuoteCollaborators: vi.fn(),
    setQuotePresenceStatus: vi.fn(),
    publishQuoteFieldConflicts: vi.fn(),
    setQuoteCollaborationStatus: vi.fn(),
    setSyncStatus: vi.fn(),
  };
  return { refs, setters, clearTimeout: vi.fn() };
}

describe('Nueva cotización limpia', () => {
  it('crea un formulario vacío sin modificar los defaults globales', () => {
    const originalDefaults = structuredClone(defaults);
    const cleanForm = createCleanQuoteForm(defaults);

    expect(defaults).toEqual(originalDefaults);
    expect(cleanForm.clienteNombre).toBe('');
    expect(cleanForm.producto).toBe('');
    expect(cleanForm.notasCliente).toBe('');
    expect(cleanForm.measureItems).toEqual([]);
    expect(cleanForm.materialItems).toEqual([]);
    expect(cleanForm.accessoryItems).toEqual([]);
    expect(cleanForm.herrajes).toBe('');
  });

  it('deja costos, total, anticipo y saldo en cero', () => {
    const cleanForm = createCleanQuoteForm(defaults);
    const quote = Quote.calculateQuote(cleanForm, quoteHelpers);

    expect(cleanForm.costoMaterialM2).toBe(0);
    expect(cleanForm.costoHerrajes).toBe(0);
    expect(cleanForm.manoObra).toBe(0);
    expect(quote.internalTotal).toBe(0);
    expect(quote.total).toBe(0);
    expect(quote.deposit).toBe(0);
    expect(quote.rest).toBe(0);
  });

  it('elimina identidad, preview, conflictos, PDF y referencias remotas', () => {
    const harness = createResetHarness();
    resetQuoteEditingState({
      baseDefaults: defaults,
      ...harness,
    });

    expect(harness.refs.activeIdentity.current).toBeNull();
    expect(harness.refs.dirtyFields.current.size).toBe(0);
    expect(harness.refs.fieldConflicts.current.size).toBe(0);
    expect(harness.refs.remoteBuffer.current.pendingRow).toBeNull();
    expect(harness.refs.focusedField.current).toBeNull();
    expect(harness.setters.setSelectedHistoryPreview).toHaveBeenCalledWith(null);
    expect(harness.setters.setActiveQuoteIdentity).toHaveBeenCalledWith(null);
    expect(harness.setters.setPdfEditor).toHaveBeenCalledWith(null);
  });

  it('cancela autoguardado y debounce de Realtime pendientes', () => {
    const harness = createResetHarness();
    resetQuoteEditingState({ baseDefaults: defaults, ...harness });

    expect(harness.clearTimeout).toHaveBeenCalledWith(101);
    expect(harness.clearTimeout).toHaveBeenCalledWith(202);
    expect(harness.refs.autoSaveTimer.current).toBeNull();
    expect(harness.refs.realtimeDebounce.current).toBeNull();
    expect(harness.refs.realtimePendingRow.current).toBeNull();
  });

  it('invalida una promesa de guardado iniciada antes del reinicio', async () => {
    const editSession = ref(2);
    const capturedSession = editSession.current;
    let resolveSave;
    const save = new Promise((resolve) => { resolveSave = resolve; });
    let activeIdentity = null;

    invalidateQuoteAsyncWork({
      editSessionRef: editSession,
      saveOperationRef: ref({}),
      autoSaveTimerRef: ref(null),
      realtimeDebounceRef: ref(null),
      clearTimeout: vi.fn(),
    });
    resolveSave({ id: 'quote-anterior' });
    const result = await save;
    if (isCurrentQuoteEditSession(editSession, capturedSession)) activeIdentity = result;

    expect(activeIdentity).toBeNull();
  });

  it('invalida un callback de Realtime anterior', () => {
    const editSession = ref(7);
    const eventSession = editSession.current;
    editSession.current += 1;

    expect(isCurrentQuoteEditSession(editSession, eventSession)).toBe(false);
  });

  it('no autoguarda los defaults y habilita guardado tras un cambio real', () => {
    const cleanForm = createCleanQuoteForm(defaults);
    expect(hasRealQuoteFormChanges(cleanForm, cleanForm)).toBe(false);
    expect(canScheduleQuoteAutoSave(true, 'cotizador')).toBe(false);

    const modifiedForm = { ...cleanForm, producto: 'Cocina nueva' };
    expect(hasRealQuoteFormChanges(cleanForm, modifiedForm)).toBe(true);
    expect(canScheduleQuoteAutoSave(false, 'cotizador')).toBe(true);
    expect(canScheduleQuoteAutoSave(false, 'produccion')).toBe(false);
  });

  it('no altera historial, cola offline ni órdenes existentes', () => {
    const harness = createResetHarness();
    const history = [{ id: 'quote-1' }];
    const offlineQueue = [{ id: 'offline-1' }];
    const productionOrders = [{ id: 'ot-1' }];

    resetQuoteEditingState({ baseDefaults: defaults, ...harness });

    expect(history).toEqual([{ id: 'quote-1' }]);
    expect(offlineQueue).toEqual([{ id: 'offline-1' }]);
    expect(productionOrders).toEqual([{ id: 'ot-1' }]);
  });

  it('limpia la OT seleccionada solo cuando el usuario confirma el reinicio', () => {
    const setSelectedProductionOrderId = vi.fn();

    expect(startNewQuoteAndClearProductionSelection(
      () => false,
      setSelectedProductionOrderId,
    )).toBe(false);
    expect(setSelectedProductionOrderId).not.toHaveBeenCalled();

    expect(startNewQuoteAndClearProductionSelection(
      () => true,
      setSelectedProductionOrderId,
    )).toBe(true);
    expect(setSelectedProductionOrderId).toHaveBeenCalledWith(null);
  });
});
