import { describe, expect, it, vi } from 'vitest';
import { Quote } from '../lib/br-engine/index.js';
import { defaults } from '../app/config/data.js';
import { quoteHelpers } from '../app/config/helpers.js';
import { startNewQuoteAndClearProductionSelection } from '../app/App.jsx';
import {
  canScheduleQuoteAutoSave,
  compareQuoteRevisions,
  createCleanQuoteForm,
  hasRealQuoteFormChanges,
  invalidateQuoteAsyncWork,
  isCurrentQuoteEditSession,
  isNewerRemoteQuoteVersion,
  mergeRemoteQuoteForms,
  quoteNoteUpdateFromProduction,
  resetQuoteEditingState,
  shouldDeferRemoteQuoteField,
} from './useQuotes.js';
import {
  productionChangesWithSharedNote,
  productionOrderNoteFromQuote,
} from './useProduction.js';

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
    presence: ref({
      untrack: vi.fn(),
      unsubscribe: vi.fn(),
    }),
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
    const anotherCleanForm = createCleanQuoteForm(defaults);
    expect(anotherCleanForm).not.toBe(cleanForm);
    expect(anotherCleanForm.measureItems).not.toBe(cleanForm.measureItems);
    expect(anotherCleanForm.materialItems).not.toBe(cleanForm.materialItems);
    expect(anotherCleanForm.accessoryItems).not.toBe(cleanForm.accessoryItems);
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
    expect(harness.refs.presence.current).toBeNull();
    expect(harness.setters.setSelectedHistoryPreview).toHaveBeenCalledWith(null);
    expect(harness.setters.setActiveQuoteIdentity).toHaveBeenCalledWith(null);
    expect(harness.setters.setPdfEditor).toHaveBeenCalledWith(null);
  });

  it('cierra Presence de la cotización anterior', () => {
    const harness = createResetHarness();
    const previousPresence = harness.refs.presence.current;

    resetQuoteEditingState({ baseDefaults: defaults, ...harness });

    expect(previousPresence.unsubscribe).toHaveBeenCalledOnce();
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
    let currentForm = createCleanQuoteForm(defaults);

    invalidateQuoteAsyncWork({
      editSessionRef: editSession,
      saveOperationRef: ref({}),
      autoSaveTimerRef: ref(null),
      realtimeDebounceRef: ref(null),
      clearTimeout: vi.fn(),
    });
    resolveSave({ id: 'quote-anterior' });
    const result = await save;
    if (isCurrentQuoteEditSession(editSession, capturedSession)) {
      activeIdentity = result;
      currentForm = { producto: 'Cotización anterior' };
    }

    expect(activeIdentity).toBeNull();
    expect(currentForm.producto).toBe('');
  });

  it('invalida un callback de Realtime anterior', () => {
    const editSession = ref(7);
    const eventSession = editSession.current;
    let currentForm = createCleanQuoteForm(defaults);
    editSession.current += 1;

    if (isCurrentQuoteEditSession(editSession, eventSession)) {
      currentForm = { producto: 'Remoto anterior' };
    }

    expect(isCurrentQuoteEditSession(editSession, eventSession)).toBe(false);
    expect(currentForm.producto).toBe('');
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

describe('Nota interna y observaciones', () => {
  it('copia Nota interna al crear la entrada de una OT', () => {
    expect(productionOrderNoteFromQuote({ notasInternas: '  Nota de taller  ' }))
      .toBe('Nota de taller');
    expect(productionOrderNoteFromQuote({ notasInternas: '' })).toBe('');
  });

  it('crea el cambio de Cotización desde una observación más reciente', () => {
    const quote = {
      id: 'quote-1',
      version: 2,
      updatedAt: '2026-07-20T10:00:00.000Z',
      form: { notasInternas: 'Anterior' },
    };
    const result = quoteNoteUpdateFromProduction([quote], {
      quoteId: 'quote-1',
      observaciones: 'Nueva desde Producción',
      updatedAt: '2026-07-20T11:00:00.000Z',
    });

    expect(result.nextQuote.form.notasInternas).toBe('Nueva desde Producción');
    expect(quote.form.notasInternas).toBe('Anterior');
  });

  it('actualiza una cotización relacionada mediante referencia heredada', () => {
    const result = quoteNoteUpdateFromProduction([
      { id: 'quote-new', legacyId: 'quote-old', form: { notasInternas: '' } },
    ], {
      formSnapshot: { legacy_id: 'quote-old' },
      observaciones: 'Nota heredada',
    });

    expect(result.nextQuote?.id).toBe('quote-new');
    expect(result.nextQuote?.form.notasInternas).toBe('Nota heredada');
  });

  it('no genera retorno cuando ambos lados ya coinciden', () => {
    const result = quoteNoteUpdateFromProduction([
      { id: 'quote-1', form: { notasInternas: 'Misma nota' } },
    ], { quoteId: 'quote-1', observaciones: 'Misma nota' });

    expect(result.nextQuote).toBeNull();
    expect(result.resolution.quoteNeedsUpdate).toBe(false);
  });

  it('un vacío de Producción no borra la nota válida de Cotización', () => {
    const result = quoteNoteUpdateFromProduction([
      { id: 'quote-1', form: { notasInternas: 'Conservar' } },
    ], { quoteId: 'quote-1', observaciones: '' });

    expect(result.nextQuote).toBeNull();
    expect(result.resolution.value).toBe('Conservar');
  });

  it('una edición de Producción alinea observaciones y snapshot sin mutar la OT', () => {
    const order = {
      observaciones: 'Anterior',
      formSnapshot: { producto: 'Mesa', notasInternas: 'Anterior' },
    };
    const changes = productionChangesWithSharedNote(
      order,
      { observaciones: 'Nueva' },
      '2026-07-20T12:00:00.000Z',
    );

    expect(changes.observaciones).toBe('Nueva');
    expect(changes.formSnapshot).toEqual({ producto: 'Mesa', notasInternas: 'Nueva' });
    expect(order.formSnapshot.notasInternas).toBe('Anterior');
  });

  it('una edición ajena a observaciones no crea cambios adicionales', () => {
    const changes = { estado: 'En proceso' };
    expect(productionChangesWithSharedNote({}, changes, new Date().toISOString()))
      .toBe(changes);
  });

  it('una observación antigua no reemplaza una Nota interna más reciente', () => {
    const result = quoteNoteUpdateFromProduction([
      {
        id: 'quote-1',
        updatedAt: '2026-07-20T13:00:00.000Z',
        form: { notasInternas: 'Última desde Cotización' },
      },
    ], {
      quoteId: 'quote-1',
      observaciones: 'Producción anterior',
      updatedAt: '2026-07-20T12:00:00.000Z',
    });

    expect(result.nextQuote).toBeNull();
    expect(result.resolution.value).toBe('Última desde Cotización');
  });
});

describe('merge Realtime de cotizaciones', () => {
  it('aplica un payload remoto reciente sin requerir interacción local', () => {
    const merge = mergeRemoteQuoteForms({
      confirmedForm: { producto: 'Anterior', clienteNombre: 'Cliente anterior' },
      localForm: { producto: 'Anterior', clienteNombre: 'Cliente anterior' },
      remoteForm: { producto: 'Remoto', clienteNombre: 'Cliente remoto' },
    });

    expect(merge.nextForm).toEqual({
      producto: 'Remoto',
      clienteNombre: 'Cliente remoto',
    });
    expect(merge.changedVisibleForm).toBe(true);
    expect(merge.bufferedFields.size).toBe(0);
  });

  it('aplica inmediatamente un campo enfocado si no tiene cambios locales', () => {
    expect(shouldDeferRemoteQuoteField('producto', new Set(), 'producto')).toBe(false);
    expect(shouldDeferRemoteQuoteField(
      'producto',
      new Set(['producto']),
      'producto',
    )).toBe(true);
  });

  it('rechaza versiones anteriores o repetidas y acepta una versión nueva', () => {
    expect(isNewerRemoteQuoteVersion(4, 3)).toBe(true);
    expect(isNewerRemoteQuoteVersion(3, 3)).toBe(false);
    expect(isNewerRemoteQuoteVersion(2, 3)).toBe(false);
    expect(isNewerRemoteQuoteVersion(undefined, 3)).toBe(true);
    expect(compareQuoteRevisions(
      { version: 3, updatedAt: '2026-07-20T18:00:00.000Z' },
      { version: 3, updatedAt: '2026-07-20T19:00:00.000Z' },
    )).toBe(-1);
    expect(compareQuoteRevisions(
      { version: 3, updatedAt: '2026-07-20T20:00:00.000Z' },
      { version: 3, updatedAt: '2026-07-20T19:00:00.000Z' },
    )).toBe(1);
  });

  it('suprime autoguardado cuando el cambio visible es únicamente remoto', () => {
    const merge = mergeRemoteQuoteForms({
      confirmedForm: { producto: 'Anterior' },
      localForm: { producto: 'Anterior' },
      remoteForm: { producto: 'Remoto' },
    });

    expect(merge.suppressAutoSave).toBe(true);
    expect(merge.dirtyFields.size).toBe(0);
  });
});
