import { useEffect, useMemo, useRef, useState } from 'react';
import { QuoteRepository } from '../lib/quotes/quoteRepository.js';
import { QuoteAdapter } from '../lib/quotes/quoteAdapter.js';
import { OfflineQueue } from '../lib/quotes/offlineQueue.js';
import { ConflictResolver } from '../lib/quotes/conflictResolver.js';
import {
  findQuoteForProductionOrder,
  normalizeQuoteReference,
  quoteReferencesFromProductionOrder,
  resolveSharedProjectNote,
} from '../lib/quotes/quoteReference.js';
import {
  Pricing,
  Report,
  Quote,
  HistoryEngine,
  Pdf,
  StorageEngine,
  AnalysisEngine,
} from '../lib/br-engine/index.js';
import {
  APP_VERSION,
  BRAND_NAME,
  HISTORY_API,
  LEGACY_HISTORY_COOLDOWN_MS,
} from '../app/config/constants.js';
import {
  defaults,
  quoteProfiles,
} from '../app/config/data.js';
import {
  analysisHelpers,
  clean,
  countScore,
  formatDimensions,
  historyHelpers,
  isNetworkError,
  isRemoteQuoteId,
  numberValue,
  pdfHelpers,
  percentValue,
  positiveNumber,
  queuedCreateMatchesRow,
  quoteDataHealth,
  quoteFieldValuesEqual,
  quoteFormChanges,
  quoteFormValue,
  quoteHelpers,
  reportHelpers,
  storageHelpers,
  withQuoteFormValue,
} from '../app/config/helpers.js';

export function createCleanQuoteForm(baseDefaults) {
  const cleanDefaults = typeof structuredClone === 'function'
    ? structuredClone(baseDefaults)
    : JSON.parse(JSON.stringify(baseDefaults));

  return {
    ...cleanDefaults,
    giro: '',
    tipoTrabajo: '',
    producto: '',
    material: '',
    medidas: '',
    acabado: '',
    precioManual: '',
    clienteNombre: '',
    clienteTelefono: '',
    ciudad: '',
    whatsapp: '',
    beneficio: '',
    incluye: '',
    entrega: '',
    promocion: '',
    objetivo: '',
    ancho: 0,
    alto: 0,
    fondo: 0,
    grosorMaterial: 0,
    cantidad: 0,
    measureItems: [],
    materialCotizacion: '',
    precioM2: 0,
    costoMaterialM2: 0,
    merma: 0,
    margenMaterial: 0,
    herrajes: '',
    costoHerrajes: 0,
    precioHerrajes: 0,
    manoObra: 0,
    extras: 0,
    descuento: 0,
    anticipo: 0,
    vigencia: 0,
    condiciones: '',
    folioManual: '',
    estadoCotizacion: 'Pendiente',
    formaPago: '',
    notasCliente: '',
    notasInternas: '',
    materialItems: [],
    accessoryItems: [],
    planItems: [],
  };
}

export function canSyncProductionFromQuoteStatus(status) {
  return QuoteAdapter.normalizeQuoteStatus(status) !== 'Cancelada';
}

export function quoteNoteUpdateFromProduction(quotes, order) {
  const quote = findQuoteForProductionOrder(quotes, order);
  if (!quote) return { quote: null, nextQuote: null, resolution: null };

  const resolution = resolveSharedProjectNote({
    quoteNote: quote.form?.notasInternas ?? quote.notasInternas,
    productionNote: order?.observaciones,
    quoteUpdatedAt: quote.updatedAt,
    productionUpdatedAt: order?.updatedAt,
    preferredSource: 'production',
  });
  if (!resolution.quoteNeedsUpdate) return { quote, nextQuote: null, resolution };

  const nextForm = { ...(quote.form || {}), notasInternas: resolution.value };
  return {
    quote,
    resolution,
    nextQuote: { ...quote, notasInternas: resolution.value, form: nextForm },
  };
}

export function isCurrentQuoteEditSession(editSessionRef, editSession) {
  return editSessionRef.current === editSession;
}

export function canScheduleQuoteAutoSave(autoSaveSuppressed, activeSection) {
  return !autoSaveSuppressed
    && ['cotizador', 'cotizador-rellenado'].includes(activeSection);
}

export function hasRealQuoteFormChanges(confirmedForm, currentForm) {
  return quoteFormChanges(confirmedForm, currentForm).size > 0;
}

export function hydrateExistingQuoteForm(form) {
  return form && typeof form === 'object' && !Array.isArray(form)
    ? structuredClone(form)
    : null;
}

export function quoteHydrationKey(item) {
  if (!item?.id) return '';
  return `${item.id}:${Number(item.version) || 0}`;
}

export function notifyQuoteDeletionCommitted({ source, quoteId, onCommitted }) {
  if (source !== 'repository' || !quoteId) return false;
  onCommitted?.({ quoteId });
  return true;
}

function quoteRevisionTimestamp(value) {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function compareQuoteRevisions(incoming = {}, current = {}) {
  const incomingVersion = Number(incoming.version);
  const currentVersion = Number(current.version);
  const hasIncomingVersion = Number.isInteger(incomingVersion) && incomingVersion > 0;
  const hasCurrentVersion = Number.isInteger(currentVersion) && currentVersion > 0;

  if (hasIncomingVersion && hasCurrentVersion && incomingVersion !== currentVersion) {
    return incomingVersion > currentVersion ? 1 : -1;
  }

  const incomingTimestamp = quoteRevisionTimestamp(incoming.updatedAt);
  const currentTimestamp = quoteRevisionTimestamp(current.updatedAt);
  if (incomingTimestamp && currentTimestamp && incomingTimestamp !== currentTimestamp) {
    return incomingTimestamp > currentTimestamp ? 1 : -1;
  }

  if (hasIncomingVersion && hasCurrentVersion) return 0;
  return 1;
}

export function isNewerRemoteQuoteVersion(remoteVersion, currentVersion) {
  return compareQuoteRevisions(
    { version: remoteVersion },
    { version: currentVersion },
  ) > 0;
}

export function shouldDeferRemoteQuoteField(focusedField, dirtyFields, fieldPath) {
  return focusedField === fieldPath && dirtyFields.has(fieldPath);
}

export function mergeRemoteQuoteForms({
  confirmedForm = {},
  localForm = {},
  remoteForm = {},
  dirtyFields = new Set(),
  fieldConflicts = new Set(),
  bufferedFields = new Map(),
  focusedField = null,
  remoteVersion = 0,
}) {
  const nextDirtyFields = new Set(dirtyFields);
  const nextFieldConflicts = new Set(fieldConflicts);
  const nextBufferedFields = new Map(bufferedFields);
  const changes = quoteFormChanges(confirmedForm, remoteForm);
  let nextForm = localForm;
  let changedVisibleForm = false;

  changes.forEach((remoteValue, fieldPath) => {
    const baseValue = quoteFormValue(confirmedForm, fieldPath);
    const localValue = quoteFormValue(nextForm, fieldPath);

    if (shouldDeferRemoteQuoteField(focusedField, nextDirtyFields, fieldPath)) {
      nextBufferedFields.set(fieldPath, { baseValue, remoteValue, version: remoteVersion });
      return;
    }

    if (nextDirtyFields.has(fieldPath)) {
      if (quoteFieldValuesEqual(fieldPath, localValue, remoteValue)) {
        nextDirtyFields.delete(fieldPath);
        nextFieldConflicts.delete(fieldPath);
        nextBufferedFields.delete(fieldPath);
      } else if (quoteFieldValuesEqual(fieldPath, localValue, baseValue)) {
        nextForm = withQuoteFormValue(nextForm, fieldPath, remoteValue);
        nextDirtyFields.delete(fieldPath);
        nextFieldConflicts.delete(fieldPath);
        nextBufferedFields.delete(fieldPath);
        changedVisibleForm = true;
      } else {
        nextBufferedFields.set(fieldPath, { baseValue, remoteValue, version: remoteVersion });
        nextFieldConflicts.delete(fieldPath);
      }
      return;
    }

    nextForm = withQuoteFormValue(nextForm, fieldPath, remoteValue);
    nextBufferedFields.delete(fieldPath);
    nextFieldConflicts.delete(fieldPath);
    changedVisibleForm = true;
  });

  return {
    nextForm,
    changedVisibleForm,
    hasRemoteChanges: changes.size > 0,
    dirtyFields: nextDirtyFields,
    fieldConflicts: nextFieldConflicts,
    bufferedFields: nextBufferedFields,
    suppressAutoSave: nextDirtyFields.size === 0,
  };
}

export function invalidateQuoteAsyncWork({
  editSessionRef,
  saveOperationRef,
  autoSaveTimerRef,
  realtimeDebounceRef,
  clearTimeout: clearScheduledTimeout,
}) {
  editSessionRef.current += 1;
  saveOperationRef.current = null;

  if (autoSaveTimerRef.current !== null) {
    clearScheduledTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }

  if (realtimeDebounceRef.current !== null) {
    clearScheduledTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = null;
  }

  return editSessionRef.current;
}

export function resetQuoteEditingState({
  baseDefaults,
  refs,
  setters,
  clearTimeout: clearScheduledTimeout,
}) {
  invalidateQuoteAsyncWork({
    editSessionRef: refs.editSession,
    saveOperationRef: refs.saveOperation,
    autoSaveTimerRef: refs.autoSaveTimer,
    realtimeDebounceRef: refs.realtimeDebounce,
    clearTimeout: clearScheduledTimeout,
  });

  const cleanForm = createCleanQuoteForm(baseDefaults);

  refs.saveInFlight.current = false;
  refs.autoSavePending.current = false;
  refs.autoSaveConflictRetry.current = false;
  refs.autoSaveSuppressed.current = true;
  refs.realtimeReloadPending.current = false;
  refs.realtimePendingRow.current = null;
  refs.realtimeNeedsReload.current = false;
  refs.remoteApply.current = false;
  refs.remoteRequest.current = {
    id: refs.remoteRequest.current.id + 1,
    inFlight: false,
    pending: false,
    pendingPreserveStatus: false,
    preserveCurrentStatus: false,
  };
  refs.latestForm.current = cleanForm;
  refs.lastConfirmedForm.current = cleanForm;
  refs.dirtyFields.current.clear();
  refs.fieldConflicts.current.clear();
  refs.remoteBuffer.current = { fields: new Map(), pendingRow: null };
  refs.focusedField.current = null;
  refs.activeIdentity.current = null;

  const previousPresence = refs.presence.current;
  refs.presence.current = null;
  void previousPresence?.unsubscribe?.();

  setters.setForm(cleanForm);
  setters.setSelectedHistoryPreview(null);
  setters.setActiveQuoteIdentity(null);
  setters.setPdfEditor(null);
  setters.setQuoteCollaborators([]);
  setters.setQuotePresenceStatus('CLOSED');
  setters.publishQuoteFieldConflicts();
  setters.setQuoteCollaborationStatus('Sincronizado');
  setters.setSyncStatus('Nueva cotización sin guardar');

  return cleanForm;
}

export default function useQuotes({
  authSession,
  activeWorkspace,
  workspaceAccessStatus,
  activeSection,
  setActiveSection,
  appLogo,
  workspaceSettings,
  syncProductionOrderFromQuote,
  onQuoteDeleteCommitted,
}) {
  const [form, setForm] = useState(defaults);
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  const remoteQuotesRequestRef = useRef({
    id: 0,
    inFlight: false,
    pending: false,
    pendingPreserveStatus: false,
    preserveCurrentStatus: false,
  });
  const supabaseTransportActiveRef = useRef(false);
  const quoteSaveInFlightRef = useRef(false);
  const quoteSaveOperationRef = useRef(null);
  const quoteEditSessionRef = useRef(0);
  const hydratedQuoteRevisionRef = useRef('');
  const quoteAutoSaveTimerRef = useRef(null);
  const quoteAutoSavePendingRef = useRef(false);
  const quoteAutoSaveInitializedRef = useRef(false);
  const quoteAutoSaveSuppressedRef = useRef(false);
  const quoteAutoSaveConflictRetryRef = useRef(false);
  const quoteRealtimeReloadPendingRef = useRef(false);
  const dirtyQuoteFieldsRef = useRef(new Set());
  const focusedQuoteFieldRef = useRef(null);
  const lastConfirmedQuoteFormRef = useRef(form);
  const remoteQuoteBufferRef = useRef({ fields: new Map(), pendingRow: null });
  const quoteFieldConflictsRef = useRef(new Set());
  const quoteRealtimeDebounceRef = useRef(null);
  const quoteRealtimePendingRowRef = useRef(null);
  const quoteRealtimeNeedsReloadRef = useRef(false);
  const quoteRemoteApplyRef = useRef(false);
  const legacyHistoryAvailabilityRef = useRef({
    unavailableUntil: 0,
    noticeShown: false,
    inFlight: false,
  });
  const offlineQueueProcessingRef = useRef(false);
  const [activeQuoteIdentity, setActiveQuoteIdentity] = useState(null);
  const activeQuoteIdentityRef = useRef(activeQuoteIdentity);
  const latestQuoteFormRef = useRef(form);
  const [selectedHistoryPreview, setSelectedHistoryPreview] = useState(null);
  const [quoteCollaborationStatus, setQuoteCollaborationStatus] = useState('Sincronizado');
  const [quoteFieldConflicts, setQuoteFieldConflicts] = useState([]);
  const [quoteCollaborators, setQuoteCollaborators] = useState([]);
  const [quotePresenceStatus, setQuotePresenceStatus] = useState('CLOSED');
  const quotePresenceRef = useRef(null);
  const [legacyHistoryStatus, setLegacyHistoryStatus] = useState('');
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const [legacyRecoveredCount, setLegacyRecoveredCount] = useState(0);
  const [copied, setCopied] = useState('');
  const [syncStatus, setSyncStatus] = useState('Historial local');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [pdfEditor, setPdfEditor] = useState(null);
  const [hydratedQuoteWorkspaceId, setHydratedQuoteWorkspaceId] = useState(null);
  const previousActiveSectionRef = useRef(activeSection);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) {
      setHydratedQuoteWorkspaceId(null);
      return;
    }

    const storedHistory = StorageEngine.loadHistory(storageHelpers);
    historyRef.current = storedHistory;
    setHistory(storedHistory);
    setPendingOfflineCount(OfflineQueue.getPendingCount());
    setHydratedQuoteWorkspaceId(workspaceId);
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!['suspended', 'revoked'].includes(workspaceAccessStatus)) return;

    setForm(defaults);
    setHistory([]);
    historyRef.current = [];
    setActiveQuoteIdentity(null);
    activeQuoteIdentityRef.current = null;
    setSelectedHistoryPreview(null);
    setPendingOfflineCount(0);
    setHydratedQuoteWorkspaceId(null);
    OfflineQueue.clearQueue();
    StorageEngine.saveHistory([]);
  }, [workspaceAccessStatus]);



  const visibleSyncStatus = pendingOfflineCount > 0
    ? `${syncStatus.includes('Sin conexión') ? 'Sin conexión' : syncStatus} · ${pendingOfflineCount} ${pendingOfflineCount === 1 ? 'operación pendiente' : 'operaciones pendientes'}`
    : syncStatus;

  supabaseTransportActiveRef.current = Boolean(
    authSession?.user?.id && activeWorkspace?.id
  );

  useEffect(() => {
    activeQuoteIdentityRef.current = activeQuoteIdentity;
  }, [activeQuoteIdentity]);

  useEffect(() => {
    latestQuoteFormRef.current = form;
  }, [form]);

  function publishQuoteFieldConflicts() {
    setQuoteFieldConflicts(Array.from(quoteFieldConflictsRef.current));
  }

  function markQuoteFormDirty(previousForm, nextForm) {
    quoteFormChanges(previousForm, nextForm).forEach((_, fieldPath) => {
      dirtyQuoteFieldsRef.current.add(fieldPath);
    });
    if (dirtyQuoteFieldsRef.current.size > 0) {
      quoteAutoSaveSuppressedRef.current = false;
    }
    latestQuoteFormRef.current = nextForm;
  }

  function confirmQuoteForm(remoteForm, savedForm = remoteForm, confirmedVersion = null) {
    const localForm = latestQuoteFormRef.current;
    lastConfirmedQuoteFormRef.current = remoteForm;
    const normalizedConfirmedVersion = Number(confirmedVersion);
    const hasConfirmedVersion = Number.isInteger(normalizedConfirmedVersion);

    dirtyQuoteFieldsRef.current.forEach((fieldPath) => {
      const savedValue = quoteFormValue(savedForm, fieldPath);
      const remoteValue = quoteFormValue(remoteForm, fieldPath);
      const localValue = quoteFormValue(localForm, fieldPath);

      if (
        quoteFieldValuesEqual(fieldPath, savedValue, remoteValue)
        && quoteFieldValuesEqual(fieldPath, localValue, savedValue)
      ) {
        dirtyQuoteFieldsRef.current.delete(fieldPath);
        quoteFieldConflictsRef.current.delete(fieldPath);
        const bufferedVersion = Number(
          remoteQuoteBufferRef.current.fields.get(fieldPath)?.version || 0
        );
        if (!hasConfirmedVersion || bufferedVersion <= normalizedConfirmedVersion) {
          remoteQuoteBufferRef.current.fields.delete(fieldPath);
        }
      }
    });

    remoteQuoteBufferRef.current.fields.forEach((buffered, fieldPath) => {
      const obsoleteByVersion = hasConfirmedVersion
        && Number(buffered.version || 0) <= normalizedConfirmedVersion;
      if (obsoleteByVersion) {
        remoteQuoteBufferRef.current.fields.delete(fieldPath);
      }
    });

    const pendingVersion = Number(remoteQuoteBufferRef.current.pendingRow?.version || 0);
    if (
      hasConfirmedVersion
      && pendingVersion > 0
      && pendingVersion <= normalizedConfirmedVersion
    ) {
      remoteQuoteBufferRef.current.pendingRow = null;
    }

    publishQuoteFieldConflicts();
    setQuoteCollaborationStatus('Sincronizado');
  }

  function applyRemoteQuoteRow(row, {
    ignoreSaveLock = false,
    editSession = quoteEditSessionRef.current,
  } = {}) {
    if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
      return { applied: false, hasConflicts: false };
    }

    const activeIdentity = activeQuoteIdentityRef.current;
    if (!row?.id || row.id !== activeIdentity?.id) {
      return { applied: false, hasConflicts: false };
    }

    const activeHistoryItem = historyRef.current.find((item) => item.id === activeIdentity.id);
    if (compareQuoteRevisions(
      { version: row.version, updatedAt: row.updated_at },
      {
        version: activeIdentity.version,
        updatedAt: activeIdentity.updatedAt || activeHistoryItem?.updatedAt,
      },
    ) <= 0) {
      return { applied: true, hasConflicts: false, ignoredStale: true };
    }

    if (
      !ignoreSaveLock
      && (quoteSaveInFlightRef.current || quoteAutoSavePendingRef.current)
    ) {
      remoteQuoteBufferRef.current.pendingRow = row;
      setQuoteCollaborationStatus('Guardando…');
      return { applied: false, hasConflicts: false };
    }

    const remoteItem = QuoteAdapter.quoteRowToHistoryItem(row);
    const remoteForm = remoteItem.form || {};
    const confirmedForm = lastConfirmedQuoteFormRef.current || {};
    const merge = mergeRemoteQuoteForms({
      confirmedForm,
      localForm: latestQuoteFormRef.current,
      remoteForm,
      dirtyFields: dirtyQuoteFieldsRef.current,
      fieldConflicts: quoteFieldConflictsRef.current,
      bufferedFields: remoteQuoteBufferRef.current.fields,
      focusedField: focusedQuoteFieldRef.current,
      remoteVersion: remoteItem.version,
    });

    dirtyQuoteFieldsRef.current = merge.dirtyFields;
    quoteFieldConflictsRef.current = merge.fieldConflicts;
    remoteQuoteBufferRef.current = {
      ...remoteQuoteBufferRef.current,
      fields: merge.bufferedFields,
    };

    lastConfirmedQuoteFormRef.current = remoteForm;
    if (merge.changedVisibleForm) {
      latestQuoteFormRef.current = merge.nextForm;
      quoteRemoteApplyRef.current = merge.suppressAutoSave;
      setForm(merge.nextForm);
    }

    const nextIdentity = {
      ...activeIdentity,
      folio: remoteItem.folio,
      createdAt: remoteItem.createdAt,
      updatedAt: remoteItem.updatedAt,
      version: remoteItem.version,
      remote: true,
    };
    activeQuoteIdentityRef.current = nextIdentity;
    setActiveQuoteIdentity(nextIdentity);

    const remoteHistory = HistoryEngine.mergeHistoryItems(
      [remoteItem],
      historyRef.current.filter((item) => item.id !== remoteItem.id),
    );
    historyRef.current = remoteHistory;
    setHistory(remoteHistory);
    StorageEngine.saveHistory(remoteHistory);
    publishQuoteFieldConflicts();

    const hasConflicts = quoteFieldConflictsRef.current.size > 0;
    setQuoteCollaborationStatus(
      hasConflicts
        ? 'Guardando…'
        : merge.hasRemoteChanges ? 'Actualizado por otro usuario' : 'Sincronizado'
    );
    return { applied: true, hasConflicts };
  }

  function flushRemoteQuoteBuffer() {
    const pendingRow = remoteQuoteBufferRef.current.pendingRow;
    remoteQuoteBufferRef.current.pendingRow = null;
    if (pendingRow) applyRemoteQuoteRow(pendingRow);

    Array.from(remoteQuoteBufferRef.current.fields.keys()).forEach((fieldPath) => {
      if (focusedQuoteFieldRef.current !== fieldPath) handleQuoteFieldBlur(fieldPath);
    });
  }

  function handleQuoteFieldFocus(fieldPath) {
    if (!fieldPath) return;

    focusedQuoteFieldRef.current = fieldPath;

    void quotePresenceRef.current?.track({
      editing: true,
      fieldPath,
    });
  }

  function handleQuoteFieldBlur(fieldPath) {
    if (!fieldPath) return;
    if (focusedQuoteFieldRef.current === fieldPath) focusedQuoteFieldRef.current = null;
    void quotePresenceRef.current?.track({
      editing: false,
      fieldPath: null,
    });
    if (quoteSaveInFlightRef.current || quoteAutoSavePendingRef.current) {
      setQuoteCollaborationStatus('Guardando…');
      return;
    }

    const buffered = remoteQuoteBufferRef.current.fields.get(fieldPath);
    if (!buffered) {
      setQuoteCollaborationStatus(
        dirtyQuoteFieldsRef.current.size ? 'Guardando…' : 'Sincronizado'
      );
      return;
    }

    const localValue = quoteFormValue(latestQuoteFormRef.current, fieldPath);
    const { baseValue, remoteValue } = buffered;

    if (!dirtyQuoteFieldsRef.current.has(fieldPath)) {
      remoteQuoteBufferRef.current.fields.delete(fieldPath);
      if (!quoteFieldValuesEqual(fieldPath, localValue, remoteValue)) {
        const nextForm = withQuoteFormValue(
          latestQuoteFormRef.current,
          fieldPath,
          remoteValue,
        );
        latestQuoteFormRef.current = nextForm;
        quoteRemoteApplyRef.current = dirtyQuoteFieldsRef.current.size === 0;
        setForm(nextForm);
      }
      quoteFieldConflictsRef.current.delete(fieldPath);
    } else if (quoteFieldValuesEqual(fieldPath, localValue, remoteValue)) {
      remoteQuoteBufferRef.current.fields.delete(fieldPath);
      dirtyQuoteFieldsRef.current.delete(fieldPath);
      quoteFieldConflictsRef.current.delete(fieldPath);
    } else if (quoteFieldValuesEqual(fieldPath, localValue, baseValue)) {
      remoteQuoteBufferRef.current.fields.delete(fieldPath);
      const nextForm = withQuoteFormValue(
        latestQuoteFormRef.current,
        fieldPath,
        remoteValue,
      );
      latestQuoteFormRef.current = nextForm;
      dirtyQuoteFieldsRef.current.delete(fieldPath);
      quoteFieldConflictsRef.current.delete(fieldPath);
      quoteRemoteApplyRef.current = dirtyQuoteFieldsRef.current.size === 0;
      setForm(nextForm);
    } else {
      quoteFieldConflictsRef.current.delete(fieldPath);
      setQuoteCollaborationStatus('Guardando…');
      publishQuoteFieldConflicts();
      return;
    }

    publishQuoteFieldConflicts();
    setQuoteCollaborationStatus(
      quoteFieldConflictsRef.current.size ? 'Guardando…' : 'Actualizado por otro usuario'
    );
  }

  const quote = useMemo(() => Quote.calculateQuote(form, quoteHelpers), [form]);
  const dataHealth = useMemo(() => quoteDataHealth(form, quote), [form, quote]);
  const selectedHistorySummary = useMemo(() => {
    if (!selectedHistoryPreview) return null;

    const previewForm = { ...(selectedHistoryPreview.form || {}) };
    const calculatedQuote = Quote.calculateQuote(previewForm, quoteHelpers);
    const total = numberValue(selectedHistoryPreview.total);
    const internalTotal = calculatedQuote.internalTotal;
    const previewQuote = {
      ...calculatedQuote,
      total,
      deposit: numberValue(selectedHistoryPreview.anticipo),
      rest: numberValue(selectedHistoryPreview.resto),
      profit: total - internalTotal,
    };
    const health = quoteDataHealth(previewForm, previewQuote);

    return {
      nombre: selectedHistoryPreview.producto || 'Proyecto sin nombre',
      descripcion: selectedHistoryPreview.notasCliente
        || previewForm.notasCliente
        || selectedHistoryPreview.tipoTrabajo
        || 'Sin descripción',
      quote: previewQuote,
      estado: selectedHistoryPreview.estadoCotizacion
        || selectedHistoryPreview.status
        || 'Pendiente',
      riesgos: health.warnings.length
        ? health.warnings.join(' · ')
        : 'Sin riesgos detectados',
      indicadores: `${health.score}% de datos completos`,
      progreso: health.score,
    };
  }, [selectedHistoryPreview]);
  const activeQuoteSummary = {
    nombre: form.producto || 'Proyecto sin nombre',
    descripcion: form.notasCliente || form.tipoTrabajo || 'Sin descripción',
    quote,
    estado: form.estadoCotizacion || 'Pendiente',
    riesgos: dataHealth.warnings.length
      ? dataHealth.warnings.join(' · ')
      : 'Sin riesgos detectados',
    indicadores: `${dataHealth.score}% de datos completos`,
    progreso: dataHealth.score,
  };
  const contextualQuoteSummary = activeSection === 'historial' && selectedHistorySummary
    ? selectedHistorySummary
    : activeQuoteSummary;
  const materials = useMemo(() => Report.generateMaterials(form, quote, reportHelpers), [form, quote]);
  const outputs = useMemo(() => Report.generateOutputs(form, quote, reportHelpers), [form, quote]);
  const roleCards = useMemo(() => Report.workRoleCards(form, quote, reportHelpers), [form, quote]);
  const professionalAnalysis = useMemo(() => Report.quoteProfessionalAnalysis(form, quote, reportHelpers), [form, quote]);
  const chainInsights = useMemo(() => AnalysisEngine.professionalChainInsights(quote, analysisHelpers), [quote]);
  const score = countScore(form);
  const mainOutput = outputs[0];
  const quoteOutput = outputs[1];

  useEffect(() => {
    historyRef.current = history;
    if (!activeWorkspace?.id || hydratedQuoteWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveHistory(history);
  }, [activeWorkspace?.id, history, hydratedQuoteWorkspaceId]);

  async function loadRemoteQuotes(options = {}) {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;
    console.log('loadRemoteQuotes', {
    userId,
      workspaceId,
    });
    const preserveStatus = Boolean(options?.preserveStatus);
    const fromRealtime = Boolean(options?.fromRealtime);

    if (!userId || !workspaceId) return;

    if (
      fromRealtime
      && (quoteSaveInFlightRef.current || quoteAutoSavePendingRef.current)
    ) {
      quoteRealtimeReloadPendingRef.current = true;
      return;
    }

    if (remoteQuotesRequestRef.current.inFlight) {
      remoteQuotesRequestRef.current = {
        ...remoteQuotesRequestRef.current,
        pending: true,
        pendingPreserveStatus:
          remoteQuotesRequestRef.current.pendingPreserveStatus || preserveStatus,
        preserveCurrentStatus:
          remoteQuotesRequestRef.current.preserveCurrentStatus || preserveStatus,
      };
      return;
    }

    const requestId = remoteQuotesRequestRef.current.id + 1;
    remoteQuotesRequestRef.current = {
      id: requestId,
      inFlight: true,
      pending: false,
      pendingPreserveStatus: false,
      preserveCurrentStatus: false,
    };

    try {
      const { data, error } = await QuoteRepository.loadQuotes(workspaceId);
      console.log('loadQuotes result', {
        error,
        rows: data?.length,
        data,
      });

      if (requestId !== remoteQuotesRequestRef.current.id) return;

      if (error) {
        if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
          setSyncStatus('Historial local · nube no disponible');
        }
        return;
      }

      const remoteRows = Array.isArray(data) ? data : [];
      const remoteHistory = remoteRows.map(QuoteAdapter.quoteRowToHistoryItem);
      const pendingOperations = OfflineQueue.loadQueue()
        .filter((operation) => operation.workspaceId === workspaceId);
      const pendingCreateOperations = pendingOperations
        .filter((operation) => operation.type === 'create');
      const pendingUpdateIds = new Set(
        pendingOperations
          .filter((operation) => operation.type === 'update')
          .map((operation) => operation.quoteId)
      );
      const pendingDeleteIds = new Set(
        pendingOperations
          .filter((operation) => operation.type === 'soft_delete')
          .map((operation) => operation.quoteId)
      );
      const localIds = new Set(historyRef.current.map((item) => item.id));
      const pendingCreateRemoteIds = new Set(
        remoteRows
          .filter((row) => pendingCreateOperations.some((operation) => (
            localIds.has(operation.quoteId)
            && queuedCreateMatchesRow(row, operation.payload)
          )))
          .map((row) => row.id)
      );
      const safeRemoteHistory = remoteHistory.filter((item) => (
        !pendingDeleteIds.has(item.id)
        && !pendingCreateRemoteIds.has(item.id)
        && !(pendingUpdateIds.has(item.id) && localIds.has(item.id))
      ));
      const protectedLocalHistory = historyRef.current.filter((item) => (
        !isRemoteQuoteId(item.id) || pendingUpdateIds.has(item.id)
      ));
      const merged = HistoryEngine.mergeHistoryItems(
        safeRemoteHistory,
        protectedLocalHistory,
      );

      historyRef.current = merged;
      console.log('merged history', merged.length, merged);
      setHistory(merged);
      StorageEngine.saveHistory(merged);
      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
        setSyncStatus('Historial sincronizado');
      }
      void processOfflineQueue();
    } catch (error) {
      if (requestId !== remoteQuotesRequestRef.current.id) return;
      console.warn('No fue posible cargar cotizaciones remotas:', error);
      if (!preserveStatus && !remoteQuotesRequestRef.current.preserveCurrentStatus) {
        setSyncStatus('Historial local · nube no disponible');
      }
    } finally {
      if (requestId !== remoteQuotesRequestRef.current.id) return;

      const shouldReload = remoteQuotesRequestRef.current.pending;
      const pendingPreserveStatus = remoteQuotesRequestRef.current.pendingPreserveStatus;
      remoteQuotesRequestRef.current = {
        id: requestId,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };

      if (shouldReload) {
        void loadRemoteQuotes({ preserveStatus: pendingPreserveStatus });
      }
    }
  }

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) {
      remoteQuotesRequestRef.current = {
        id: remoteQuotesRequestRef.current.id + 1,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };
      return undefined;
    }

    const reloadRemoteQuotes = () => {
      void loadRemoteQuotes();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reloadRemoteQuotes();
      }
    };

    reloadRemoteQuotes();
    window.addEventListener('focus', reloadRemoteQuotes);
    window.addEventListener('online', reloadRemoteQuotes);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      remoteQuotesRequestRef.current = {
        id: remoteQuotesRequestRef.current.id + 1,
        inFlight: false,
        pending: false,
        pendingPreserveStatus: false,
        preserveCurrentStatus: false,
      };

      window.removeEventListener('focus', reloadRemoteQuotes);
      window.removeEventListener('online', reloadRemoteQuotes);
      document.removeEventListener(
        'visibilitychange',
        onVisibilityChange
      );
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) return undefined;

    let subscriptionActive = true;
    const unsubscribe = QuoteRepository.subscribeQuotes(
      workspaceId,
      (payload) => {
        const eventEditSession = quoteEditSessionRef.current;
        const remoteRow = payload?.new?.id
          ? payload.new
          : null;

        const activeQuoteId =
          activeQuoteIdentityRef.current?.id;

        if (remoteRow?.deleted_at) {
          notifyQuoteDeletionCommitted({
            source: 'realtime',
            quoteId: remoteRow.id,
            onCommitted: onQuoteDeleteCommitted,
          });
        }

        if (
          remoteRow?.id === activeQuoteId
          && !remoteRow.deleted_at
        ) {
          const activeHistoryItem = historyRef.current.find(
            (item) => item.id === activeQuoteId,
          );
          if (compareQuoteRevisions(
            { version: remoteRow.version, updatedAt: remoteRow.updated_at },
            {
              version: activeQuoteIdentityRef.current?.version,
              updatedAt:
                activeQuoteIdentityRef.current?.updatedAt
                || activeHistoryItem?.updatedAt,
            },
          ) <= 0) {
            return;
          }

          if (
            !quoteSaveInFlightRef.current
            && !quoteAutoSavePendingRef.current
          ) {
            applyRemoteQuoteRow(remoteRow, { editSession: eventEditSession });
            return;
          }

          const previousPending =
            quoteRealtimePendingRowRef.current;

          const previousVersion = Number(
            previousPending?.version || 0
          );

          const incomingVersion = Number(
            remoteRow.version || 0
          );

          if (
            !previousPending
            || incomingVersion >= previousVersion
          ) {
            quoteRealtimePendingRowRef.current =
              remoteRow;
          }
        } else {
          quoteRealtimeNeedsReloadRef.current = true;
        }

        if (
          quoteRealtimeDebounceRef.current !== null
        ) {
          window.clearTimeout(
            quoteRealtimeDebounceRef.current
          );
        }

        quoteRealtimeDebounceRef.current =
          window.setTimeout(() => {
            quoteRealtimeDebounceRef.current = null;

            if (!isCurrentQuoteEditSession(quoteEditSessionRef, eventEditSession)) {
              return;
            }

            const pendingRow =
              quoteRealtimePendingRowRef.current;

            const needsReload =
              quoteRealtimeNeedsReloadRef.current;

            quoteRealtimePendingRowRef.current = null;
            quoteRealtimeNeedsReloadRef.current = false;

            if (pendingRow) {
              if (
                quoteSaveInFlightRef.current
                || quoteAutoSavePendingRef.current
              ) {
                const bufferedVersion = Number(
                  remoteQuoteBufferRef.current
                    .pendingRow?.version || 0
                );

                const pendingVersion = Number(
                  pendingRow.version || 0
                );

                if (
                  !remoteQuoteBufferRef.current
                    .pendingRow
                  || pendingVersion >= bufferedVersion
                ) {
                  remoteQuoteBufferRef.current
                    .pendingRow = pendingRow;
                }

                setQuoteCollaborationStatus(
                  'Guardando…'
                );
              } else {
                const mergeResult =
                  applyRemoteQuoteRow(pendingRow, { editSession: eventEditSession });

                if (!mergeResult.applied) {
                  quoteRealtimeNeedsReloadRef.current =
                    true;
                }
              }
            }

            if (
              needsReload
              || quoteRealtimeNeedsReloadRef.current
            ) {
              quoteRealtimeNeedsReloadRef.current =
                false;

              if (
                quoteSaveInFlightRef.current
                || quoteAutoSavePendingRef.current
              ) {
                quoteRealtimeReloadPendingRef.current =
                  true;
              } else {
                void loadRemoteQuotes({
                  fromRealtime: true,
                });
              }
            }
          }, 280);
      },
      (status, error) => {
        if (!subscriptionActive) return;

        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
          console.warn('Realtime de cotizaciones no disponible:', status, error);
          setQuoteCollaborationStatus('Realtime no disponible');
          return;
        }

        if (status === 'CLOSED') {
          setQuoteCollaborationStatus('Realtime cerrado');
          return;
        }

        if (
          status === 'SUBSCRIBED'
          && !quoteSaveInFlightRef.current
          && !quoteAutoSavePendingRef.current
          && dirtyQuoteFieldsRef.current.size === 0
          && quoteFieldConflictsRef.current.size === 0
        ) {
          setQuoteCollaborationStatus('Sincronizado');
        }
      }
    );

    return () => {
      subscriptionActive = false;
      if (
        quoteRealtimeDebounceRef.current !== null
      ) {
        window.clearTimeout(
          quoteRealtimeDebounceRef.current
        );

        quoteRealtimeDebounceRef.current = null;
      }

      quoteRealtimePendingRowRef.current = null;
      quoteRealtimeNeedsReloadRef.current = false;
      unsubscribe();
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const user = authSession?.user;
    const workspaceId = activeWorkspace?.id;
    const editSession = quoteEditSessionRef.current;

    const quoteId =
      activeQuoteIdentity?.remote
        ? activeQuoteIdentity.id
        : null;

    if (!user?.id || !workspaceId || !quoteId) {
      setQuoteCollaborators([]);
      setQuotePresenceStatus('CLOSED');
      quotePresenceRef.current = null;
      return undefined;
    }

    const presence =
      QuoteRepository.subscribeQuotePresence({
        workspaceId,
        quoteId,
        user: {
          id: user.id,
          email: user.email || '',
          name:
            user.user_metadata?.full_name
            || user.user_metadata?.name
            || user.email
            || 'Usuario',
        },
        onSync: (collaborators) => {
          if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
          const uniqueByUser = new Map();

          collaborators.forEach((collaborator) => {
            if (!collaborator?.userId) return;

            uniqueByUser.set(
              collaborator.userId,
              collaborator
            );
          });

          setQuoteCollaborators(
            Array.from(uniqueByUser.values())
          );
        },
        onStatus: (status) => {
          if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
          setQuotePresenceStatus(status);
        },
      });

    quotePresenceRef.current = presence;

    return () => {
      quotePresenceRef.current = null;
      setQuoteCollaborators([]);
      setQuotePresenceStatus('CLOSED');
      void presence.unsubscribe();
    };
  }, [
    authSession?.user?.id,
    authSession?.user?.email,
    activeWorkspace?.id,
    activeQuoteIdentity?.id,
    activeQuoteIdentity?.remote,
  ]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) return undefined;

    const processQueue = () => {
      void processOfflineQueue();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') processQueue();
    };

    processQueue();
    window.addEventListener('online', processQueue);
    window.addEventListener('focus', processQueue);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('online', processQueue);
      window.removeEventListener('focus', processQueue);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  function markLegacyHistoryUnavailable() {
    legacyHistoryAvailabilityRef.current.unavailableUntil =
      Date.now() + LEGACY_HISTORY_COOLDOWN_MS;
    legacyHistoryAvailabilityRef.current.inFlight = false;

    if (!legacyHistoryAvailabilityRef.current.noticeShown) {
      legacyHistoryAvailabilityRef.current.noticeShown = true;
      setLegacyHistoryStatus(
        'Historial legacy no disponible · usando almacenamiento actual'
      );
    }
  }

  function legacyHistoryIsAvailable() {
    const isMissingViteRoute = import.meta.env.DEV
      && historyHelpers.historyApi === HISTORY_API;

    if (isMissingViteRoute) {
      markLegacyHistoryUnavailable();
      return false;
    }

    return !legacyHistoryAvailabilityRef.current.inFlight
      && Date.now() >= legacyHistoryAvailabilityRef.current.unavailableUntil;
  }

  function markLegacyHistoryAvailable() {
    legacyHistoryAvailabilityRef.current = {
      unavailableUntil: 0,
      noticeShown: false,
      inFlight: false,
    };
    setLegacyHistoryStatus('');
  }

  async function syncHistory(uploadLocal = false) {
    if (supabaseTransportActiveRef.current) return;
    if (!legacyHistoryIsAvailable()) return;
    legacyHistoryAvailabilityRef.current.inFlight = true;

    try {
      if (!navigator.onLine) {
        setSyncStatus('Sin conexión: historial guardado localmente');
        return;
      }

      setSyncStatus('Sincronizando historial...');

      const recoveredLegacyHistory = HistoryEngine.recoverLegacyHistoryFromLocalStorage(historyHelpers);
      if (recoveredLegacyHistory.length > 0) {
        setLegacyRecoveredCount(recoveredLegacyHistory.length);
      }
      const local = StorageEngine.loadHistory(storageHelpers);
      const remote = await HistoryEngine.requestHistory({}, historyHelpers);

      if (supabaseTransportActiveRef.current) return;

      const merged = HistoryEngine.mergeHistoryItems(recoveredLegacyHistory, local, history, remote);

      if (uploadLocal || merged.length !== remote.length) {
        const saved = await HistoryEngine.requestHistory({
          method: 'PUT',
          body: JSON.stringify({ history: merged }),
        }, historyHelpers);

        if (supabaseTransportActiveRef.current) return;

        setHistory(saved);
      } else {
        setHistory(merged);
      }

      markLegacyHistoryAvailable();

      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );

      setSyncStatus('Historial sincronizado en la nube');
    } catch (error) {
      markLegacyHistoryUnavailable(error);
      if (!supabaseTransportActiveRef.current) {
        setSyncStatus('Historial local');
      }
    } finally {
      legacyHistoryAvailabilityRef.current.inFlight = false;
    }
  }

  function saveHistoryRemote(nextHistory) {
    if (supabaseTransportActiveRef.current) {
      return Promise.resolve(nextHistory);
    }
    const supabaseActive = supabaseTransportActiveRef.current;

    if (!legacyHistoryIsAvailable()) {
      return Promise.resolve(nextHistory);
    }

    if (!navigator.onLine) {
      if (!supabaseActive) {
        setSyncStatus('Guardado local; se sincroniza al volver internet');
      }
      return Promise.resolve(nextHistory);
    }
    legacyHistoryAvailabilityRef.current.inFlight = true;

    return HistoryEngine.requestHistory({
      method: 'PUT',
      body: JSON.stringify({ history: nextHistory }),
    }, historyHelpers)
      .then((saved) => {
        markLegacyHistoryAvailable();
        if (!supabaseActive && !supabaseTransportActiveRef.current) {
          historyRef.current = saved;
          setHistory(saved);
          setLastSyncAt(
            new Date().toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })
          );
          setSyncStatus('Historial sincronizado en la nube');
        }
        return saved;
      })
      .catch(() => {
        markLegacyHistoryUnavailable();
        if (!supabaseActive && !supabaseTransportActiveRef.current) {
          setSyncStatus('Guardado local; se sincroniza al volver internet');
        }
        return nextHistory;
      });
  }

  useEffect(() => {
    if (authSession?.user?.id) return undefined;

    syncHistory(true);

    const interval = window.setInterval(() => {
      syncHistory(false);
    }, 15000);

    const onFocus = () => syncHistory(false);
    const onOnline = () => syncHistory(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncHistory(false);
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authSession?.user?.id]);

  function updateDirtyQuoteForm(updater) {
    setQuoteCollaborationStatus('Guardando…');
    setForm((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      markQuoteFormDirty(current, next);
      return next;
    });
  }

  function update(field, value) {
    updateDirtyQuoteForm((current) => ({ ...current, [field]: value }));
  }

  function updateMeasure(field, value) {
    updateDirtyQuoteForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers);
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
      const nextMeasureItems = [{ ...first, [field]: value }, ...measureItems.slice(1)];
      const next = { ...current, [field]: value, measureItems: nextMeasureItems };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function updateMeasureItem(id, field, value) {
    updateDirtyQuoteForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      ));
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
      const next = {
        ...current,
        measureItems,
        ancho: first.ancho,
        alto: first.alto,
        fondo: first.fondo,
        grosorMaterial: first.grosorMaterial,
        cantidad: first.cantidad,
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function addMeasureItem() {
    updateDirtyQuoteForm((current) => {
      const measureItems = [
        ...Quote.measurementItemsFromForm(current, quoteHelpers),
        {
          id: `med-${Date.now()}`,
          nombre: `Medida ${Quote.measurementItemsFromForm(current, quoteHelpers).length + 1}`,
          ancho: current.ancho,
          alto: current.alto,
          fondo: current.fondo,
          grosorMaterial: current.grosorMaterial,
          cantidad: 1,
          nota: '',
        },
      ];
      const next = { ...current, measureItems };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function removeMeasureItem(id) {
    updateDirtyQuoteForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers).filter((item) => item.id !== id);
      const safeItems = measureItems.length ? measureItems : [Quote.normalizeMeasureItem({}, 0, current, quoteHelpers)];
      const first = safeItems[0];
      const next = {
        ...current,
        measureItems: safeItems,
        ancho: first.ancho,
        alto: first.alto,
        fondo: first.fondo,
        grosorMaterial: first.grosorMaterial,
        cantidad: first.cantidad,
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function updateMaterialItem(id, field, value, manualCapture = false) {
    updateDirtyQuoteForm((current) => {
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const materialItems = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (field === 'calculo') {
          next.usarArea = value !== 'manual';
          next.baseCalculo = value === 'area' ? 'medidas_area' : value;
        }
        if (field === 'baseCalculo') {
          next.usarArea = ['medidas_area', 'manual_area', 'lineal'].includes(value);
        }
        if (field === 'tipoCompra') {
          if (value === 'area' || value === 'hoja') next.unidad = 'm²';
          if (value === 'pieza' || value === 'manual') next.unidad = 'pieza';
          if (value === 'lineal') next.unidad = 'metro lineal';
        }
        if (field === 'unidad' && value === 'metro lineal') next.calculo = 'lineal';
        if (field === 'unidad' && value === 'm²') next.calculo = 'area';
        if (field === 'precioUnitario') next.precioManual = true;
        if (['costoUnitario', 'merma', 'margen'].includes(field) && !next.precioManual) {
          next.precioUnitario = Math.round(Pricing.aplicarMargenSobreCosto(
            positiveNumber(next.costoUnitario) * (1 + percentValue(next.merma) / 100),
            next.margen ?? current.margenMaterial
          ));
        }
        if (manualCapture) {
          Object.assign(next, {
            calculo: 'manual',
            tipoCompra: 'manual',
            baseCalculo: 'manual_qty',
            usarArea: false,
            unidad: 'pieza',
            merma: 0,
            margen: 0,
            precioManual: true,
          });
        }
        return next;
      });
      return { ...current, materialItems };
    });
  }

  function addMaterialItem(manualCapture = false) {
    updateDirtyQuoteForm((current) => ({
      ...current,
      materialItems: [
        ...Quote.materialItemsFromForm(current, Quote.quoteAreaTotal(current, quoteHelpers), quoteHelpers),
        {
          id: `mat-${Date.now()}`,
          nombre: 'Nuevo material',
          unidad: 'pieza',
          usarArea: false,
          calculo: 'manual',
          tipoCompra: 'manual',
          baseCalculo: 'manual_qty',
          cantidad: 1,
          ancho: 0,
          alto: 0,
          largo: 0,
          grosor: current.grosorMaterial,
          costoUnitario: 0,
          precioUnitario: 0,
          merma: 0,
          margen: manualCapture ? 0 : current.margenMaterial,
          precioManual: manualCapture,
          nota: '',
        },
      ],
    }));
  }

  function removeMaterialItem(id) {
    updateDirtyQuoteForm((current) => {
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const items = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).filter((item) => item.id !== id);
      return { ...current, materialItems: items.length ? items : [] };
    });
  }

  function applySuggestedPrices() {
    updateDirtyQuoteForm((current) => {
      const areaTotal = Quote.quoteAreaTotal(current, quoteHelpers);
      const currentQuote = Quote.calculateQuote(current, quoteHelpers);
      const materialItems = Quote.materialItemsFromForm(current, areaTotal, quoteHelpers).map((item) => ({
        ...item,
        precioUnitario: Math.round(positiveNumber(item.costoUnitario) * (1 + percentValue(item.merma) / 100) * (1 + positiveNumber(item.margen ?? current.margenMaterial) / 100)),
      }));
      return {
        ...current,
        precioM2: Math.round(currentQuote.suggestedPriceM2),
        materialItems,
      };
    });
  }

  function applyQuoteProfile(profileKey) {
    const profile = quoteProfiles[profileKey];
    if (!profile) return;
    updateDirtyQuoteForm((current) => {
      const measureItems = profile.measureItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const materialItems = profile.materialItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const accessoryItems = profile.accessoryItems.map((item) => ({ ...item, id: `${item.id}-${Date.now()}` }));
      const firstMeasure = measureItems[0];
      const next = {
        ...current,
        ...profile.fields,
        measureItems,
        materialItems,
        accessoryItems,
        ancho: firstMeasure.ancho,
        alto: firstMeasure.alto,
        fondo: firstMeasure.fondo,
        grosorMaterial: firstMeasure.grosorMaterial,
        cantidad: firstMeasure.cantidad,
      };
      return {
        ...next,
        medidas: formatDimensions(next),
      };
    });
  }

  function updateAccessoryItem(id, field, value) {
    updateDirtyQuoteForm((current) => ({
      ...current,
      accessoryItems: Quote.accessoryItemsFromForm(current, quoteHelpers).map((item) => {
        if (item.id !== id) return item;
        const next = {
          ...item,
          [field]: value,
          ...(field === 'precioUnitario' ? { precioManual: true } : {}),
        };
        if (['costoUnitario', 'merma', 'margen'].includes(field) && !next.precioManual) {
          next.precioUnitario = Math.round(Pricing.aplicarMargenSobreCosto(
            positiveNumber(next.costoUnitario) * (1 + percentValue(next.merma) / 100),
            next.margen ?? current.margenMaterial
          ));
        }
        return next;
      }),
    }));
  }

  function addAccessoryItem() {
    updateDirtyQuoteForm((current) => ({
      ...current,
      accessoryItems: [
        ...Quote.accessoryItemsFromForm(current, quoteHelpers),
        {
          id: `acc-${Date.now()}`,
          nombre: 'Nuevo accesorio',
          tipoCompra: 'pieza',
          cantidad: 1,
          costoUnitario: 0,
          precioUnitario: 0,
          merma: 0,
          margen: current.margenMaterial,
          precioManual: false,
          nota: '',
        },
      ],
    }));
  }

  function removeAccessoryItem(id) {
    updateDirtyQuoteForm((current) => {
      const items = Quote.accessoryItemsFromForm(current, quoteHelpers).filter((item) => item.id !== id);
      return { ...current, accessoryItems: items.length ? items : [] };
    });
  }


  function generateQuoteFolio(historyItems = []) {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const prefix = `ALX-${y}${m}${d}`;
    const folioPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const maxConsecutive = (Array.isArray(historyItems) ? historyItems : [])
      .reduce((maximum, item) => {
        const match = String(item?.folio || '').match(folioPattern);
        if (!match) return maximum;

        const consecutive = Number.parseInt(match[1], 10);
        return Number.isInteger(consecutive)
          ? Math.max(maximum, consecutive)
          : maximum;
      }, 0);

    return `${prefix}-${String(maxConsecutive + 1).padStart(3, '0')}`;
  }

  function isWorkspaceFolioConflict(error) {
    const description = `${error?.message || ''} ${error?.details || ''}`;
    return error?.code === '23505'
      && description.includes('quotes_workspace_folio_active_uidx');
  }

  function warnCreateQuoteError(error) {
    console.warn('createQuote falló:', {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  }

  function refreshPendingOfflineCount() {
    const count = OfflineQueue.getPendingCount();
    setPendingOfflineCount(count);
    return count;
  }

  function enqueueOfflineQuoteOperation({
    type,
    workspaceId,
    quoteId,
    expectedVersion = null,
    payload = null,
  }) {
    const operation = OfflineQueue.enqueueOperation({
      type,
      createdAt: Date.now(),
      attempts: 0,
      workspaceId,
      quoteId,
      expectedVersion,
      payload,
    });

    refreshPendingOfflineCount();
    return operation;
  }

  function removeQueuedQuoteOperations(type, workspaceId, quoteId) {
    OfflineQueue.loadQueue()
      .filter((operation) => (
        operation.type === type
        && operation.workspaceId === workspaceId
        && operation.quoteId === quoteId
      ))
      .forEach((operation) => OfflineQueue.removeOperation(operation.id));
    refreshPendingOfflineCount();
  }

  async function resolveQuoteConflict(
    localItem,
    queuedOperation = null,
    {
      allowPrompt = false,
      editSession = quoteEditSessionRef.current,
    } = {},
  ) {
    if (!localItem?.id) return false;

    const isActiveQuote = activeQuoteIdentityRef.current?.id === localItem.id;
    if (!allowPrompt || !isActiveQuote) {
      if (queuedOperation?.id) {
        OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      setSyncStatus('Conflicto de versión · cambios pendientes de revisión');
      return false;
    }

    setSyncStatus('La cotización fue modificada desde otro dispositivo.');
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return false;

    const keepRemote = window.confirm(
      'La cotización fue modificada desde otro dispositivo.\n\nAceptar: usar versión remota.\nCancelar: conservar la mía.'
    );
    const result = keepRemote
      ? await ConflictResolver.resolveKeepRemote(localItem)
      : await ConflictResolver.resolveKeepLocal(localItem);

    if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return false;

    if (result.error || !result.data) {
      if (queuedOperation?.id) {
        OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      setSyncStatus(
        result.error?.code === 'QUOTE_REMOTE_DELETED'
          ? 'La cotización fue eliminada en otro dispositivo.'
          : 'No se pudo resolver el conflicto · datos locales conservados'
      );
      return false;
    }

    const resolvedItem = result.data;
    const withoutConflictedItem = historyRef.current.filter((item) => (
      item.id !== localItem.id && item.id !== resolvedItem.id
    ));
    const resolvedHistory = HistoryEngine.mergeHistoryItems(
      [resolvedItem],
      withoutConflictedItem,
    );

    historyRef.current = resolvedHistory;
    setHistory(resolvedHistory);
    StorageEngine.saveHistory(resolvedHistory);
    const resolvedForm = { ...defaults, ...resolvedItem.form };
    latestQuoteFormRef.current = resolvedForm;
    setForm(resolvedForm);
    dirtyQuoteFieldsRef.current.clear();
    quoteFieldConflictsRef.current.clear();
    remoteQuoteBufferRef.current = { fields: new Map(), pendingRow: null };
    confirmQuoteForm(resolvedForm);
    setSelectedHistoryPreview(null);
    const nextIdentity = {
      id: resolvedItem.id,
      workspaceId: activeWorkspace?.id || null,
      folio: resolvedItem.folio,
      createdAt: resolvedItem.createdAt,
      updatedAt: resolvedItem.updatedAt,
      version: resolvedItem.version,
      remote: true,
    };
    activeQuoteIdentityRef.current = nextIdentity;
    setActiveQuoteIdentity(nextIdentity);

    const workspaceId = queuedOperation?.workspaceId || activeWorkspace?.id;
    if (workspaceId) {
      removeQueuedQuoteOperations('update', workspaceId, localItem.id);
    }

    setSyncStatus(keepRemote ? 'Versión remota aplicada' : 'Cambios locales guardados');
    void saveHistoryRemote(resolvedHistory);
    void loadRemoteQuotes({ preserveStatus: true });
    return true;
  }

  async function processOfflineQueue() {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!navigator.onLine) {
      if (OfflineQueue.getPendingCount() > 0) setSyncStatus('Sin conexión');
      return;
    }

    if (
      offlineQueueProcessingRef.current
      || quoteSaveInFlightRef.current
      || !userId
      || !workspaceId
    ) {
      return;
    }

    offlineQueueProcessingRef.current = true;
    let syncedCount = 0;
    let shouldReload = false;
    let stoppedByNetwork = false;
    let hasConflict = false;
    let lastSuccessMessage = '';
    let currentOperation = null;

    try {
      const operations = OfflineQueue.loadQueue()
        .filter((operation) => operation.workspaceId === workspaceId)
        .sort((left, right) => left.createdAt - right.createdAt);

      for (const operation of operations) {
        currentOperation = operation;
        if (!navigator.onLine) {
          stoppedByNetwork = true;
          break;
        }

        if (operation.conflict) {
          const localItem = historyRef.current
            .find((item) => item.id === operation.quoteId);
          const resolved = localItem
            ? await resolveQuoteConflict(localItem, operation)
            : false;
          if (!resolved) hasConflict = true;
          if (resolved) {
            syncedCount += 1;
            shouldReload = true;
          }
          continue;
        }

        let result;

        if (operation.type === 'create') {
          result = await QuoteRepository.createQuote(workspaceId, operation.payload);

          if (isWorkspaceFolioConflict(result.error)) {
            const remoteResult = await QuoteRepository.loadQuotes(workspaceId);
            if (remoteResult.error && isNetworkError(remoteResult.error)) {
              result = remoteResult;
            } else {
              const remoteRows = Array.isArray(remoteResult.data) ? remoteResult.data : [];
              const existingRow = remoteRows.find((row) => (
                queuedCreateMatchesRow(row, operation.payload)
              ));

              if (existingRow) {
                result = { data: existingRow, error: null };
              } else {
                const retryFolio = generateQuoteFolio([
                  ...historyRef.current,
                  ...remoteRows,
                ]);
                const retryPayload = { ...operation.payload, folio: retryFolio };
                OfflineQueue.updateOperation(operation.id, { payload: retryPayload });

                const retryHistory = HistoryEngine.normalizeHistory(
                  historyRef.current.map((item) => (
                    item.id === operation.quoteId
                      ? { ...item, folio: retryFolio, updatedAt: Date.now() }
                      : item
                  )),
                );
                historyRef.current = retryHistory;
                setHistory(retryHistory);
                StorageEngine.saveHistory(retryHistory);
                if (activeQuoteIdentityRef.current?.id === operation.quoteId) {
                  const nextIdentity = {
                    ...activeQuoteIdentityRef.current,
                    folio: retryFolio,
                    version: null,
                    remote: false,
                  };
                  activeQuoteIdentityRef.current = nextIdentity;
                  setActiveQuoteIdentity(nextIdentity);
                }

                result = await QuoteRepository.createQuote(workspaceId, retryPayload);
              }
            }
          }
        } else if (operation.type === 'update') {
          result = await QuoteRepository.updateQuote(
            operation.quoteId,
            operation.payload,
            operation.expectedVersion,
          );
        } else {
          result = await QuoteRepository.softDeleteQuote(operation.quoteId);
        }

        const operationFailed = result?.error || !result?.data;
        if (operationFailed) {
          const error = result?.error || new Error('Supabase no devolvió datos.');
          const attempts = operation.attempts + 1;

          if (operation.type === 'update' && error.code === 'QUOTE_VERSION_CONFLICT') {
            const localItem = historyRef.current
              .find((item) => item.id === operation.quoteId);
            const resolved = localItem
              ? await resolveQuoteConflict(localItem, operation)
              : false;
            if (resolved) {
              syncedCount += 1;
              shouldReload = true;
            } else {
              OfflineQueue.updateOperation(operation.id, {
                attempts,
                conflict: true,
              });
              hasConflict = true;
              refreshPendingOfflineCount();
            }
            continue;
          }

          OfflineQueue.updateOperation(operation.id, { attempts });
          refreshPendingOfflineCount();

          if (isNetworkError(error)) {
            stoppedByNetwork = true;
            break;
          }

          continue;
        }

        OfflineQueue.removeOperation(operation.id);
        refreshPendingOfflineCount();
        syncedCount += 1;
        shouldReload = true;

        if (operation.type === 'soft_delete') {
          const nextHistory = HistoryEngine.normalizeHistory(
            historyRef.current.filter((item) => item.id !== operation.quoteId)
          );
          historyRef.current = nextHistory;
          setHistory(nextHistory);
          StorageEngine.saveHistory(nextHistory);
          if (activeQuoteIdentityRef.current?.id === operation.quoteId) {
            activeQuoteIdentityRef.current = null;
            setActiveQuoteIdentity(null);
          }
          notifyQuoteDeletionCommitted({
            source: 'repository',
            quoteId: operation.quoteId,
            onCommitted: onQuoteDeleteCommitted,
          });
          lastSuccessMessage = 'Eliminación sincronizada';
          continue;
        }

        const remoteItem = QuoteAdapter.quoteRowToHistoryItem(result.data);
        const withoutLocalItem = historyRef.current.filter((item) => (
          item.id !== operation.quoteId && item.id !== remoteItem.id
        ));
        const nextHistory = HistoryEngine.mergeHistoryItems(
          [remoteItem],
          withoutLocalItem,
        );
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        StorageEngine.saveHistory(nextHistory);
        if (
          activeQuoteIdentityRef.current?.id === operation.quoteId
          || activeQuoteIdentityRef.current?.id === remoteItem.id
        ) {
          const nextIdentity = {
            id: remoteItem.id,
            workspaceId,
            folio: remoteItem.folio,
            createdAt: remoteItem.createdAt,
            updatedAt: remoteItem.updatedAt,
            version: remoteItem.version,
            remote: true,
          };
          activeQuoteIdentityRef.current = nextIdentity;
          setActiveQuoteIdentity(nextIdentity);
          confirmQuoteForm(
            remoteItem.form || {},
            operation.payload?.form_data || remoteItem.form || {},
            remoteItem.version,
          );
        }
        lastSuccessMessage = operation.type === 'create'
          ? 'Cotización sincronizada'
          : 'Cambios sincronizados';
      }
    } catch (error) {
      if (currentOperation) {
        OfflineQueue.updateOperation(currentOperation.id, {
          attempts: currentOperation.attempts + 1,
        });
      }
      stoppedByNetwork = isNetworkError(error);
    } finally {
      offlineQueueProcessingRef.current = false;
      const remainingCount = refreshPendingOfflineCount();

      if (stoppedByNetwork) {
        setSyncStatus('Sin conexión');
      } else if (hasConflict) {
        setSyncStatus('Conflicto de versión · cambios pendientes de revisión');
      } else if (syncedCount > 1 && remainingCount === 0) {
        setSyncStatus('Cola sincronizada');
      } else if (lastSuccessMessage) {
        setSyncStatus(lastSuccessMessage);
      } else if (remainingCount > 0) {
        setSyncStatus('Sincronización pendiente');
      }

      if (shouldReload && !stoppedByNetwork && navigator.onLine) {
        void loadRemoteQuotes({ preserveStatus: true });
      }
    }
  }

  function saveToHistory(options = {}) {
    const silent = Boolean(options.silent);
    const autoConflictRetry = Boolean(options.autoConflictRetry);
    const navigateToHistory = !silent && options.navigateToHistory !== false;
    const editSession = quoteEditSessionRef.current;

    if (quoteSaveInFlightRef.current) {
      if (silent) {
        quoteAutoSavePendingRef.current = true;
      }
      return;
    }

    let clearedTemporaryConflict = false;
    remoteQuoteBufferRef.current.fields.forEach((_, fieldPath) => {
      if (quoteFieldConflictsRef.current.delete(fieldPath)) {
        clearedTemporaryConflict = true;
      }
    });
    if (clearedTemporaryConflict) publishQuoteFieldConflicts();

    if (quoteFieldConflictsRef.current.size > 0) {
      if (silent) {
        setSyncStatus('Conflicto de versión · cambios pendientes de revisión');
        setQuoteCollaborationStatus('Cambios pendientes de revisión');
        return;
      }

      const keepLocal = window.confirm(
        'Hay campos modificados también por otro usuario.\n\nAceptar: conservar y guardar tus valores.\nCancelar: revisar antes de guardar.'
      );
      if (!keepLocal) return;
      quoteFieldConflictsRef.current.clear();
      remoteQuoteBufferRef.current.fields.clear();
      publishQuoteFieldConflicts();
    }

    quoteSaveInFlightRef.current = true;
    const saveOperation = { editSession };
    quoteSaveOperationRef.current = saveOperation;
    setQuoteCollaborationStatus('Guardando…');

    const now = Date.now();
    const currentIdentity = activeQuoteIdentityRef.current;
    const hasRemoteIdentity = Boolean(
      currentIdentity?.remote && isRemoteQuoteId(currentIdentity.id)
    );
    const folio = currentIdentity?.folio
      || clean(form.folioManual, generateQuoteFolio(history));
    const status = QuoteAdapter.normalizeQuoteStatus(form.estadoCotizacion);
    const historyForm = {
      ...form,
      estadoCotizacion: status,
    };
    const item = {
      id: currentIdentity?.id || `hist-${now}`,
      createdAt: currentIdentity?.createdAt || now,
      updatedAt: now,
      status,
      folio,
      estadoCotizacion: status,
      formaPago: clean(form.formaPago, 'Anticipo y saldo contra entrega'),
      notasCliente: clean(form.notasCliente),
      notasInternas: clean(form.notasInternas),
      clienteNombre: clean(form.clienteNombre, 'Cliente'),
      clienteTelefono: clean(form.clienteTelefono),
      producto: clean(form.producto, 'Proyecto a medida'),
      tipoTrabajo: clean(form.tipoTrabajo, 'Trabajo'),
      giro: clean(form.giro, 'Carpintería'),
      total: quote.total,
      anticipo: quote.deposit,
      resto: quote.rest,
      form: historyForm,
      ...(currentIdentity?.version ? { version: currentIdentity.version } : {}),
    };

    const nextHistory = HistoryEngine.mergeHistoryItems([item], historyRef.current);
    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    const shouldUseLegacyBackup = !supabaseTransportActiveRef.current;

    const legacySave = shouldUseLegacyBackup
      ? saveHistoryRemote(nextHistory)
      : Promise.resolve(nextHistory);
    if (!silent) {
      setSyncStatus('Guardada localmente · pendiente de sincronizar');
    }

    if (navigateToHistory) {
      setActiveSection('historial');
    }
    const localIdentity = {
      id: item.id,
      workspaceId: activeWorkspace?.id || null,
      folio,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      version: currentIdentity?.version || null,
      remote: hasRemoteIdentity,
    };
    activeQuoteIdentityRef.current = localIdentity;
    setActiveQuoteIdentity(localIdentity);

    if (hasRemoteIdentity && canSyncProductionFromQuoteStatus(status)) {
      syncProductionOrderFromQuote(
        currentIdentity.id,
        historyForm,
        currentIdentity.version,
        item.updatedAt,
        item,
      );
    }

    const workspaceId = activeWorkspace?.id;
    const userId = authSession?.user?.id;

    if (!workspaceId) {
      quoteSaveInFlightRef.current = false;
      quoteSaveOperationRef.current = null;
    void Promise.resolve(legacySave).finally(() => {
        if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          setSyncStatus('Guardada localmente · esperando conexión al workspace');
        }
      });
      return;
    }

    const {
      payload,
      error: payloadError,
    } = QuoteAdapter.quoteFormToPayload({
      form: historyForm,
      quote,
      workspaceId,
      folio,
    });

    if (payloadError || !payload) {
      quoteSaveInFlightRef.current = false;
      quoteSaveOperationRef.current = null;
      void Promise.resolve(legacySave).finally(() => {
        if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          setSyncStatus('Guardada localmente · pendiente de sincronizar');
        }
      });
      return;
    }

    if (!userId || !navigator.onLine) {
      enqueueOfflineQuoteOperation({
        type: hasRemoteIdentity ? 'update' : 'create',
        workspaceId,
        quoteId: item.id,
        expectedVersion: currentIdentity?.version || null,
        payload,
      });
      quoteSaveInFlightRef.current = false;
      quoteSaveOperationRef.current = null;
      setSyncStatus('Guardada localmente · pendiente de sincronizar');
      return;
    }

    const remoteSave = hasRemoteIdentity
      ? QuoteRepository.updateQuote(
        currentIdentity.id,
        payload,
        currentIdentity.version,
      )
      : (async () => {
        const firstAttempt = await QuoteRepository.createQuote(workspaceId, payload);
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          return firstAttempt;
        }
        if (!isWorkspaceFolioConflict(firstAttempt.error)) return firstAttempt;

        warnCreateQuoteError(firstAttempt.error);
        setSyncStatus('Folio duplicado · generando nuevo consecutivo');

        const {
          data: remoteQuotes,
          error: remoteQuotesError,
        } = await QuoteRepository.loadQuotes(workspaceId);
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          return { data: null, error: remoteQuotesError };
        }
        if (remoteQuotesError) return { data: null, error: remoteQuotesError };

        const existingRow = (Array.isArray(remoteQuotes) ? remoteQuotes : [])
          .find((row) => queuedCreateMatchesRow(row, payload));
        if (existingRow) return { data: existingRow, error: null };

        const retryFolio = generateQuoteFolio([
          ...historyRef.current,
          ...(Array.isArray(remoteQuotes) ? remoteQuotes : []),
        ]);
        const retryHistory = HistoryEngine.normalizeHistory(
          historyRef.current.map((historyItem) => (
            historyItem.id === item.id
              ? { ...historyItem, folio: retryFolio, updatedAt: Date.now() }
              : historyItem
          )),
        );

        historyRef.current = retryHistory;
        setHistory(retryHistory);
        StorageEngine.saveHistory(retryHistory);
        const retryIdentity = {
          id: item.id,
          workspaceId,
          folio: retryFolio,
          createdAt: item.createdAt,
          updatedAt: Date.now(),
          version: null,
          remote: false,
        };
        activeQuoteIdentityRef.current = retryIdentity;
        setActiveQuoteIdentity(retryIdentity);

        return QuoteRepository.createQuote(workspaceId, {
          ...payload,
          folio: retryFolio,
        });
      })();

    void remoteSave
      .then(async ({ data, error }) => {
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          if (data) {
            const remoteItem = QuoteAdapter.quoteRowToHistoryItem(data);
            const remoteHistory = HistoryEngine.mergeHistoryItems(
              [remoteItem],
              historyRef.current.filter((historyItem) => (
                historyItem.id !== item.id && historyItem.id !== remoteItem.id
              )),
            );
            historyRef.current = remoteHistory;
            setHistory(remoteHistory);
            StorageEngine.saveHistory(remoteHistory);
            removeQueuedQuoteOperations(
              hasRemoteIdentity ? 'update' : 'create',
              workspaceId,
              item.id,
            );
          } else if (isNetworkError(error)) {
            enqueueOfflineQuoteOperation({
              type: hasRemoteIdentity ? 'update' : 'create',
              workspaceId,
              quoteId: item.id,
              expectedVersion: currentIdentity?.version || null,
              payload,
            });
          }
          return;
        }

        if (error?.code === 'QUOTE_VERSION_CONFLICT') {
          let queuedOperation = enqueueOfflineQuoteOperation({
            type: 'update',
            workspaceId,
            quoteId: item.id,
            expectedVersion: currentIdentity?.version || null,
            payload,
          });

          if (silent) {
            const remoteResult = await QuoteRepository.getQuote(item.id);
            if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
            const remoteMatchesPreviousSave = !remoteResult.error
              && remoteResult.data
              && queuedCreateMatchesRow(remoteResult.data, payload);

            if (remoteMatchesPreviousSave) {
              const remoteItem = QuoteAdapter.quoteRowToHistoryItem(remoteResult.data);
              const remoteHistory = HistoryEngine.mergeHistoryItems(
                [remoteItem],
                historyRef.current.filter((historyItem) => historyItem.id !== remoteItem.id),
              );
              const nextIdentity = {
                id: remoteItem.id,
                workspaceId,
                folio: remoteItem.folio,
                createdAt: remoteItem.createdAt,
                updatedAt: remoteItem.updatedAt,
                version: remoteItem.version,
                remote: true,
              };
              activeQuoteIdentityRef.current = nextIdentity;
              setActiveQuoteIdentity(nextIdentity);
              historyRef.current = remoteHistory;
              setHistory(remoteHistory);
              StorageEngine.saveHistory(remoteHistory);
              confirmQuoteForm(
                remoteItem.form || {},
                historyForm,
                remoteItem.version,
              );
              removeQueuedQuoteOperations('update', workspaceId, item.id);

              const latestForm = latestQuoteFormRef.current;
              const latestQuote = Quote.calculateQuote(latestForm, quoteHelpers);
              const latestPayloadResult = QuoteAdapter.quoteFormToPayload({
                form: latestForm,
                quote: latestQuote,
                workspaceId,
                folio: remoteItem.folio,
              });
              const hasNewerLocalChanges = Boolean(
                latestPayloadResult.payload
                && !queuedCreateMatchesRow(remoteResult.data, latestPayloadResult.payload)
              );

              if (hasNewerLocalChanges && !autoConflictRetry) {
                quoteAutoSaveConflictRetryRef.current = true;
                quoteAutoSavePendingRef.current = true;
              } else if (hasNewerLocalChanges) {
                queuedOperation = enqueueOfflineQuoteOperation({
                  type: 'update',
                  workspaceId,
                  quoteId: item.id,
                  expectedVersion: remoteItem.version,
                  payload: latestPayloadResult.payload,
                });
                if (queuedOperation?.id) {
                  OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
                }
                quoteAutoSavePendingRef.current = false;
                setSyncStatus('Conflicto de versión · cambios pendientes de revisión');
              } else {
                setSyncStatus('Cotización sincronizada');
              }
              return;
            }

            if (remoteResult.data) {
              const mergeResult = applyRemoteQuoteRow(
                remoteResult.data,
                { ignoreSaveLock: true },
              );
              if (mergeResult.applied && !mergeResult.hasConflicts && !autoConflictRetry) {
                removeQueuedQuoteOperations('update', workspaceId, item.id);
                quoteAutoSaveConflictRetryRef.current = true;
                quoteAutoSavePendingRef.current = true;
                return;
              }
            }

            const latestForm = latestQuoteFormRef.current;
            const latestQuote = Quote.calculateQuote(latestForm, quoteHelpers);
            const latestPayloadResult = QuoteAdapter.quoteFormToPayload({
              form: latestForm,
              quote: latestQuote,
              workspaceId,
              folio: currentIdentity?.folio || folio,
            });
            if (latestPayloadResult.payload) {
              queuedOperation = enqueueOfflineQuoteOperation({
                type: 'update',
                workspaceId,
                quoteId: item.id,
                expectedVersion: remoteResult.data?.version || currentIdentity?.version || null,
                payload: latestPayloadResult.payload,
              });
            }
            if (queuedOperation?.id) {
              OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
              refreshPendingOfflineCount();
            }
            quoteAutoSavePendingRef.current = false;
            setSyncStatus('Conflicto de versión · cambios pendientes de revisión');
            return;
          }

          if (queuedOperation) {
            OfflineQueue.updateOperation(queuedOperation.id, { conflict: true });
            refreshPendingOfflineCount();
          }
          await resolveQuoteConflict(item, queuedOperation, {
            allowPrompt: true,
            editSession,
          });
          return;
        }

        if (error || !data) {
          if (isNetworkError(error)) {
            if (!hasRemoteIdentity) warnCreateQuoteError(error);
            enqueueOfflineQuoteOperation({
              type: hasRemoteIdentity ? 'update' : 'create',
              workspaceId,
              quoteId: item.id,
              expectedVersion: currentIdentity?.version || null,
              payload,
            });
            setSyncStatus('Guardada localmente · pendiente de sincronizar');
            return;
          }

          if (!hasRemoteIdentity) {
            warnCreateQuoteError(
              error || new Error('Supabase no devolvió la cotización creada.'),
            );
          }
          setSyncStatus(
            hasRemoteIdentity
              ? 'Guardada localmente · pendiente de sincronizar'
              : 'No se pudo crear la cotización en nube'
          );
          return;
        }

        const remoteItem = QuoteAdapter.quoteRowToHistoryItem(data);
        const withoutTemporaryItem = historyRef.current
          .filter((historyItem) => historyItem.id !== item.id);
        const remoteHistory = HistoryEngine.mergeHistoryItems(
          [remoteItem],
          withoutTemporaryItem,
        );

        historyRef.current = remoteHistory;
        setHistory(remoteHistory);
        StorageEngine.saveHistory(remoteHistory);
        const nextIdentity = {
          id: remoteItem.id,
          workspaceId,
          folio: remoteItem.folio,
          createdAt: remoteItem.createdAt,
          updatedAt: remoteItem.updatedAt,
          version: remoteItem.version,
          remote: true,
        };
        activeQuoteIdentityRef.current = nextIdentity;
        setActiveQuoteIdentity(nextIdentity);
        confirmQuoteForm(
          remoteItem.form || {},
          historyForm,
          remoteItem.version,
        );

        if (canSyncProductionFromQuoteStatus(remoteItem.estadoCotizacion)) {
          syncProductionOrderFromQuote(
            remoteItem.id,
            remoteItem.form || historyForm,
            remoteItem.version,
            remoteItem.updatedAt,
            remoteItem,
          );
        }

        removeQueuedQuoteOperations(
          hasRemoteIdentity ? 'update' : 'create',
          workspaceId,
          item.id,
        );
        setLastSyncAt(
          new Date().toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        setSyncStatus(
          hasRemoteIdentity
            ? 'Cotización actualizada en nube'
            : 'Cotización guardada en nube'
        );
        void loadRemoteQuotes({ preserveStatus: true });

        if (shouldUseLegacyBackup) {          void Promise.resolve(legacySave).finally(() => {
            void saveHistoryRemote(remoteHistory);
          });
        }
      })
      .catch((error) => {
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          if (isNetworkError(error)) {
            enqueueOfflineQuoteOperation({
              type: hasRemoteIdentity ? 'update' : 'create',
              workspaceId,
              quoteId: item.id,
              expectedVersion: currentIdentity?.version || null,
              payload,
            });
          }
          return;
        }

        if (isNetworkError(error)) {
          if (!hasRemoteIdentity) warnCreateQuoteError(error);
          enqueueOfflineQuoteOperation({
            type: hasRemoteIdentity ? 'update' : 'create',
            workspaceId,
            quoteId: item.id,
            expectedVersion: currentIdentity?.version || null,
            payload,
          });
          setSyncStatus('Guardada localmente · pendiente de sincronizar');
          return;
        }

        if (!hasRemoteIdentity) {
          warnCreateQuoteError(error);
        }
        setSyncStatus(
          hasRemoteIdentity
            ? 'Guardada localmente · pendiente de sincronizar'
            : 'No se pudo crear la cotización en nube'
        );
      })
      .finally(() => {
        if (quoteSaveOperationRef.current !== saveOperation) return;

        quoteSaveOperationRef.current = null;
        quoteSaveInFlightRef.current = false;
        const hasPendingAutoSave = quoteAutoSavePendingRef.current;
        quoteAutoSavePendingRef.current = false;

        flushRemoteQuoteBuffer();

        if (hasPendingAutoSave) {
          const autoConflictRetryPending = quoteAutoSaveConflictRetryRef.current;
          quoteAutoSaveConflictRetryRef.current = false;

          queueMicrotask(() => {
            if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
            saveToHistory({
              silent: true,
              autoConflictRetry: autoConflictRetryPending,
            });
          });
          return;
        }

        if (quoteRealtimeReloadPendingRef.current) {
          quoteRealtimeReloadPendingRef.current = false;
          void loadRemoteQuotes({ preserveStatus: true, fromRealtime: true });
        }
      });

  }

  useEffect(() => {
    if (activeSection !== 'cotizador-rellenado') return;

    setForm((current) => {
      const currentQuote = Quote.calculateQuote(current, quoteHelpers);
      const requiresManualConversion = currentQuote.materialRows.some((item) => (
        item.calculo !== 'manual'
        || item.tipoCompra !== 'manual'
        || item.usarArea
        || item.merma !== 0
        || !item.precioManual
      )) || currentQuote.accessoryRows.length > 0;

      if (!requiresManualConversion) return current;

      const materialItems = [
        ...currentQuote.materialRows.map((item) => ({
          id: item.id,
          nombre: item.nombre,
          unidad: 'pieza',
          usarArea: false,
          calculo: 'manual',
          tipoCompra: 'manual',
          baseCalculo: 'manual_qty',
          cantidad: 1,
          costoUnitario: item.costTotal,
          precioUnitario: item.saleTotal,
          merma: 0,
          margen: 0,
          precioManual: true,
          nota: item.nota,
        })),
        ...currentQuote.accessoryRows.map((item) => ({
          id: `filled-${item.id}`,
          nombre: item.nombre,
          unidad: 'pieza',
          usarArea: false,
          calculo: 'manual',
          tipoCompra: 'manual',
          baseCalculo: 'manual_qty',
          cantidad: 1,
          costoUnitario: item.costTotal,
          precioUnitario: item.saleTotal,
          merma: 0,
          margen: 0,
          precioManual: true,
          nota: item.nota,
        })),
      ];

      return {
        ...current,
        materialItems,
        accessoryItems: [],
        herrajes: 'Sin herrajes',
        costoHerrajes: 0,
        precioHerrajes: 0,
      };
    });
  }, [activeSection]);

  useEffect(() => {
    if (!quoteAutoSaveInitializedRef.current) {
      quoteAutoSaveInitializedRef.current = true;
      return undefined;
    }

    if (quoteRemoteApplyRef.current) {
      quoteRemoteApplyRef.current = false;
      return undefined;
    }

    if (
      quoteAutoSaveSuppressedRef.current
      && hasRealQuoteFormChanges(lastConfirmedQuoteFormRef.current, form)
    ) {
      quoteAutoSaveSuppressedRef.current = false;
    }

    if (!canScheduleQuoteAutoSave(
      quoteAutoSaveSuppressedRef.current,
      activeSection,
    )) return undefined;

    if (quoteAutoSaveTimerRef.current !== null) {
      window.clearTimeout(quoteAutoSaveTimerRef.current);
    }

    quoteAutoSaveTimerRef.current = window.setTimeout(() => {
      quoteAutoSaveTimerRef.current = null;

      saveToHistory({ silent: true });
    }, 700);

    return () => {
      if (quoteAutoSaveTimerRef.current !== null) {
        window.clearTimeout(quoteAutoSaveTimerRef.current);
        quoteAutoSaveTimerRef.current = null;
      }
    };
  }, [form, activeSection]);
  useEffect(() => {
    const previousSection = previousActiveSectionRef.current;
    previousActiveSectionRef.current = activeSection;

    if (
      ['cotizador', 'cotizador-rellenado'].includes(previousSection)
      && !['cotizador', 'cotizador-rellenado'].includes(activeSection)
    ) {
      if (quoteAutoSaveTimerRef.current !== null) {
        window.clearTimeout(quoteAutoSaveTimerRef.current);
        quoteAutoSaveTimerRef.current = null;
      }

      saveToHistory({ silent: true });
    }
  }, [activeSection]);

  function loadHistoryItem(item) {
    if (!item?.form) return;
    const hydrationKey = quoteHydrationKey(item);
    if (hydrationKey && hydratedQuoteRevisionRef.current === hydrationKey) {
      setSelectedHistoryPreview(null);
      setActiveSection('cotizador');
      return;
    }
    const version = numberValue(item.version);
    setSelectedHistoryPreview(null);
    const loadedForm = hydrateExistingQuoteForm(item.form);
    const nextIdentity = {
      id: item.id,
      workspaceId: activeWorkspace?.id || null,
      folio: item.folio,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      version: version || null,
      remote: isRemoteQuoteId(item.id) && version > 0,
    };
    latestQuoteFormRef.current = loadedForm;
    lastConfirmedQuoteFormRef.current = loadedForm;
    dirtyQuoteFieldsRef.current.clear();
    quoteFieldConflictsRef.current.clear();
    remoteQuoteBufferRef.current = { fields: new Map(), pendingRow: null };
    focusedQuoteFieldRef.current = null;
    activeQuoteIdentityRef.current = nextIdentity;
    hydratedQuoteRevisionRef.current = hydrationKey;
    setForm(loadedForm);
    setActiveQuoteIdentity(nextIdentity);
    publishQuoteFieldConflicts();
    setQuoteCollaborationStatus('Sincronizado');
    setActiveSection('cotizador');
  }
  async function openQuoteFromProduction(order) {
    const editSession = quoteEditSessionRef.current;
    const references = quoteReferencesFromProductionOrder(order);
    let relatedQuote = findQuoteForProductionOrder(historyRef.current, order);

    if (!relatedQuote && activeWorkspace?.id && references.length) {
      let relatedRow = null;

      for (const reference of references) {
        if (!isRemoteQuoteId(reference)) continue;
        const directResult = await QuoteRepository.getQuote(reference);
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return false;
        if (directResult.data && !directResult.data.deleted_at) {
          relatedRow = directResult.data;
          break;
        }
      }

      if (!relatedRow) {
        const remoteResult = await QuoteRepository.loadQuotes(activeWorkspace.id);
        if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return false;
        relatedRow = !remoteResult.error
          ? findQuoteForProductionOrder(remoteResult.data, order)
          : null;
      }

      relatedQuote = relatedRow ? QuoteAdapter.quoteRowToHistoryItem(relatedRow) : null;
    }

    if (!relatedQuote) {
      setSyncStatus('La cotización original de esta orden ya no está disponible.');
      return false;
    }

    if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return false;
    loadHistoryItem(relatedQuote);
    return true;
  }

  function startNewQuote() {
    hydratedQuoteRevisionRef.current = '';
    const confirmed = window.confirm(
      '¿Comenzar una nueva cotización?\n\nSe limpiarán los datos de la cotización actual. Esta acción no elimina historial, catálogo, precios ni configuración.'
    );

    if (!confirmed) return false;

    resetQuoteEditingState({
      baseDefaults: defaults,
      refs: {
        editSession: quoteEditSessionRef,
        saveOperation: quoteSaveOperationRef,
        saveInFlight: quoteSaveInFlightRef,
        autoSaveTimer: quoteAutoSaveTimerRef,
        autoSavePending: quoteAutoSavePendingRef,
        autoSaveConflictRetry: quoteAutoSaveConflictRetryRef,
        autoSaveSuppressed: quoteAutoSaveSuppressedRef,
        realtimeDebounce: quoteRealtimeDebounceRef,
        realtimeReloadPending: quoteRealtimeReloadPendingRef,
        realtimePendingRow: quoteRealtimePendingRowRef,
        realtimeNeedsReload: quoteRealtimeNeedsReloadRef,
        remoteApply: quoteRemoteApplyRef,
        remoteRequest: remoteQuotesRequestRef,
        latestForm: latestQuoteFormRef,
        lastConfirmedForm: lastConfirmedQuoteFormRef,
        dirtyFields: dirtyQuoteFieldsRef,
        fieldConflicts: quoteFieldConflictsRef,
        remoteBuffer: remoteQuoteBufferRef,
        focusedField: focusedQuoteFieldRef,
        activeIdentity: activeQuoteIdentityRef,
        presence: quotePresenceRef,
      },
      setters: {
        setForm,
        setSelectedHistoryPreview,
        setActiveQuoteIdentity,
        setPdfEditor,
        setQuoteCollaborators,
        setQuotePresenceStatus,
        publishQuoteFieldConflicts,
        setQuoteCollaborationStatus,
        setSyncStatus,
      },
      clearTimeout: window.clearTimeout.bind(window),
    });
    setActiveSection('cotizador');
    setCopied('Nueva cotización lista');
    return true;
  }

  function removeHistoryItem(id) {
    const workspaceId = activeWorkspace?.id;
    const removedItem = historyRef.current.find((item) => item.id === id);
    const nextHistory = HistoryEngine.normalizeHistory(
      historyRef.current.filter((item) => item.id !== id)
    );

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    setActiveQuoteIdentity((current) => (
      current?.id === id ? null : current
    ));
    void saveHistoryRemote(nextHistory);
    if (isRemoteQuoteId(id)) {
      if (workspaceId && (!authSession?.user?.id || !navigator.onLine)) {
        enqueueOfflineQuoteOperation({
          type: 'soft_delete',
          workspaceId,
          quoteId: id,
        });
        setSyncStatus('Guardada localmente · pendiente de sincronizar');
        return;
      }

      void QuoteRepository.softDeleteQuote(id)
        .then(({ data, error }) => {
          if (error || !data) {
            if (workspaceId && isNetworkError(error)) {
              enqueueOfflineQuoteOperation({
                type: 'soft_delete',
                workspaceId,
                quoteId: id,
              });
              setSyncStatus('Guardada localmente · pendiente de sincronizar');
              return;
            }

            if (removedItem) {
              const restoredHistory = HistoryEngine.mergeHistoryItems(
                [removedItem],
                historyRef.current,
              );
              historyRef.current = restoredHistory;
              setHistory(restoredHistory);
              StorageEngine.saveHistory(restoredHistory);
              void saveHistoryRemote(restoredHistory);
            }
            setSyncStatus('No se pudo eliminar en nube');
            return;
          }

          if (workspaceId) {
            removeQueuedQuoteOperations('soft_delete', workspaceId, id);
          }
          notifyQuoteDeletionCommitted({
            source: 'repository',
            quoteId: id,
            onCommitted: onQuoteDeleteCommitted,
          });
          setSyncStatus('Cotización eliminada en nube');
          void loadRemoteQuotes({ preserveStatus: true });
        })
        .catch((error) => {
          if (workspaceId && isNetworkError(error)) {
            enqueueOfflineQuoteOperation({
              type: 'soft_delete',
              workspaceId,
              quoteId: id,
            });
            setSyncStatus('Guardada localmente · pendiente de sincronizar');
            return;
          }

          if (removedItem) {
            const restoredHistory = HistoryEngine.mergeHistoryItems(
              [removedItem],
              historyRef.current,
            );
            historyRef.current = restoredHistory;
            setHistory(restoredHistory);
            StorageEngine.saveHistory(restoredHistory);
            void saveHistoryRemote(restoredHistory);
          }
          setSyncStatus('No se pudo eliminar en nube');
        });
      return;
    }

    if (workspaceId) {
      removeQueuedQuoteOperations('create', workspaceId, id);
    }
  }

  function exportHistoryBackup() {
    const exportedAt = new Date().toISOString();
    const backup = {
      app: BRAND_NAME,
      type: 'history-backup',
      version: APP_VERSION,
      exportedAt,
      history,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `aluxor-historial-${exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSyncStatus('Respaldo de historial exportado');
  }

  function importHistoryBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const importedHistory = Array.isArray(parsed) ? parsed : parsed?.history;
        if (!Array.isArray(importedHistory)) throw new Error('Formato de respaldo inválido');
        const nextHistory = HistoryEngine.mergeHistoryItems(importedHistory, history);
        setHistory(nextHistory);
        saveHistoryRemote(nextHistory);
        setSyncStatus('Respaldo de historial importado');
      } catch (error) {
        setSyncStatus(`No se pudo importar respaldo: ${error.message}`);
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      setSyncStatus('No se pudo leer el respaldo');
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  async function updateHistoryStatus(id, nextStatus) {
    const editSession = quoteEditSessionRef.current;
    const previousItem = historyRef.current.find((item) => item.id === id);
    if (!previousItem) return;

    const now = Date.now();
    const normalizedStatus = QuoteAdapter.normalizeQuoteStatus(nextStatus);
    const updatedItem = {
      ...previousItem,
      status: normalizedStatus,
      estadoCotizacion: normalizedStatus,
      form: {
        ...(previousItem.form || {}),
        estadoCotizacion: normalizedStatus,
      },
      updatedAt: now,
    };
    const nextHistory = HistoryEngine.normalizeHistory(
      historyRef.current.map((item) => (
        item.id === id ? updatedItem : item
      ))
    );

    historyRef.current = nextHistory;
    setHistory(nextHistory);
    StorageEngine.saveHistory(nextHistory);
    setForm((current) => (
      activeQuoteIdentity?.id === id
        ? { ...current, estadoCotizacion: normalizedStatus }
        : current
    ));
    setSelectedHistoryPreview((current) => (
      current?.id === id ? { ...updatedItem } : current
    ));

    const expectedVersion = Number(previousItem.version);
    const workspaceId = activeWorkspace?.id;
    const canUpdateRemote = isRemoteQuoteId(id)
      && Number.isInteger(expectedVersion)
      && expectedVersion > 0
      && authSession?.user?.id
      && workspaceId;

    if (!canUpdateRemote) {
      setSyncStatus('Estado actualizado localmente');
      return;
    }

    const payload = QuoteAdapter.historyItemToQuotePayload(updatedItem);
    const enqueueStatusUpdate = (conflict = false) => {
      const operation = enqueueOfflineQuoteOperation({
        type: 'update',
        workspaceId,
        quoteId: id,
        expectedVersion,
        payload,
      });
      if (conflict && operation?.id) {
        OfflineQueue.updateOperation(operation.id, { conflict: true });
        refreshPendingOfflineCount();
      }
      return operation;
    };

    if (!navigator.onLine) {
      enqueueStatusUpdate();
      setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
      return;
    }

    setSyncStatus('Actualizando estado...');

    try {
      const { data, error } = await QuoteRepository.updateQuote(
        id,
        payload,
        expectedVersion,
      );

      if (error?.code === 'QUOTE_VERSION_CONFLICT') {
        enqueueStatusUpdate(true);
        if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          setSyncStatus('Conflicto de versión · requiere revisión');
        }
        return;
      }

      if (error || !data) {
        if (isNetworkError(error)) {
          enqueueStatusUpdate();
          if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
            setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
          }
        } else if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          setSyncStatus('Estado actualizado localmente');
        }
        return;
      }

      const remoteItem = QuoteAdapter.quoteRowToHistoryItem(data);
      const confirmedItem = {
        ...remoteItem,
        id: updatedItem.id,
        folio: updatedItem.folio,
        createdAt: updatedItem.createdAt,
      };
      const confirmedHistory = HistoryEngine.normalizeHistory(
        historyRef.current.map((item) => (
          item.id === id ? confirmedItem : item
        ))
      );

      historyRef.current = confirmedHistory;
      setHistory(confirmedHistory);
      StorageEngine.saveHistory(confirmedHistory);
      if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
        setForm((current) => (
          activeQuoteIdentityRef.current?.id === id
            ? { ...current, estadoCotizacion: confirmedItem.estadoCotizacion }
            : current
        ));
        setActiveQuoteIdentity((current) => (
          current?.id === id
            ? { ...current, version: confirmedItem.version }
            : current
        ));
        setSelectedHistoryPreview((current) => (
          current?.id === id ? { ...confirmedItem } : current
        ));
      }
      removeQueuedQuoteOperations('update', workspaceId, id);
      if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
      setLastSyncAt(
        new Date().toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
      setSyncStatus('Estado actualizado en nube');
      void loadRemoteQuotes({ preserveStatus: true });
    } catch (error) {
      if (isNetworkError(error)) {
        enqueueStatusUpdate();
        if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
          setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
        }
      } else if (isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) {
        setSyncStatus('Estado actualizado localmente');
      }
    }
  }

  async function syncQuoteNoteFromProduction(order) {
    const editSession = quoteEditSessionRef.current;
    const update = quoteNoteUpdateFromProduction(historyRef.current, order);
    if (!update.nextQuote) {
      if (update.quote && update.resolution?.productionNeedsUpdate) {
        syncProductionOrderFromQuote(
          update.quote.id,
          update.quote.form || {},
          update.quote.version,
          update.quote.updatedAt,
          update.quote,
        );
      }
      return false;
    }

    const quoteId = update.quote.id;
    const applyHistoryItem = (item) => {
      const nextHistory = HistoryEngine.normalizeHistory(
        historyRef.current.map((current) => (
          normalizeQuoteReference(current.id) === normalizeQuoteReference(quoteId)
            ? item
            : current
        )),
      );
      historyRef.current = nextHistory;
      setHistory(nextHistory);
      StorageEngine.saveHistory(nextHistory);
      setSelectedHistoryPreview((current) => (
        normalizeQuoteReference(current?.id) === normalizeQuoteReference(quoteId)
          ? { ...item }
          : current
      ));
    };
    const applyActiveNote = (item) => {
      if (!isCurrentQuoteEditSession(quoteEditSessionRef, editSession)) return;
      if (normalizeQuoteReference(activeQuoteIdentityRef.current?.id)
        !== normalizeQuoteReference(quoteId)) return;

      quoteRemoteApplyRef.current = true;
      dirtyQuoteFieldsRef.current.delete('notasInternas');
      const nextForm = {
        ...latestQuoteFormRef.current,
        notasInternas: item.form?.notasInternas ?? item.notasInternas ?? '',
      };
      latestQuoteFormRef.current = nextForm;
      lastConfirmedQuoteFormRef.current = nextForm;
      setForm(nextForm);
      setActiveQuoteIdentity((current) => (
        normalizeQuoteReference(current?.id) === normalizeQuoteReference(quoteId)
          ? { ...current, version: item.version, updatedAt: item.updatedAt }
          : current
      ));
    };

    applyHistoryItem(update.nextQuote);
    applyActiveNote(update.nextQuote);

    const workspaceId = activeWorkspace?.id;
    const expectedVersion = Number(update.quote.version);
    const canUpdateRemote = workspaceId
      && authSession?.user?.id
      && isRemoteQuoteId(quoteId)
      && Number.isInteger(expectedVersion)
      && expectedVersion > 0;
    if (!canUpdateRemote) return true;

    let pendingItem = update.nextQuote;
    let pendingVersion = expectedVersion;
    const enqueueUpdate = (conflict = false) => {
      const queued = enqueueOfflineQuoteOperation({
        type: 'update',
        workspaceId,
        quoteId,
        expectedVersion: pendingVersion,
        payload: QuoteAdapter.historyItemToQuotePayload(pendingItem),
      });
      if (conflict && queued?.id) OfflineQueue.updateOperation(queued.id, { conflict: true });
      refreshPendingOfflineCount();
    };

    if (!navigator.onLine) {
      enqueueUpdate();
      return true;
    }

    let result = await QuoteRepository.updateQuote(
      quoteId,
      QuoteAdapter.historyItemToQuotePayload(pendingItem),
      pendingVersion,
    );

    if (result.error?.code === 'QUOTE_VERSION_CONFLICT') {
      const remoteResult = await QuoteRepository.getQuote(quoteId);
      if (remoteResult.data && !remoteResult.error) {
        const remoteItem = QuoteAdapter.quoteRowToHistoryItem(remoteResult.data);
        const retry = quoteNoteUpdateFromProduction([remoteItem], order);
        if (!retry.nextQuote) {
          applyHistoryItem(remoteItem);
          applyActiveNote(remoteItem);
          if (retry.resolution?.productionNeedsUpdate) {
            syncProductionOrderFromQuote(
              remoteItem.id,
              remoteItem.form || {},
              remoteItem.version,
              remoteItem.updatedAt,
              remoteItem,
            );
          }
          return false;
        }
        pendingItem = retry.nextQuote;
        pendingVersion = Number(remoteItem.version);
        result = await QuoteRepository.updateQuote(
          quoteId,
          QuoteAdapter.historyItemToQuotePayload(pendingItem),
          pendingVersion,
        );
      }
    }

    if (result.error || !result.data) {
      enqueueUpdate(Boolean(result.error?.code === 'QUOTE_VERSION_CONFLICT'));
      return true;
    }

    const remoteItem = QuoteAdapter.quoteRowToHistoryItem(result.data);
    applyHistoryItem(remoteItem);
    applyActiveNote(remoteItem);
    removeQueuedQuoteOperations('update', workspaceId, quoteId);
    return true;
  }

  function copyText(text, label = 'Texto') {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(`${label} copiado`);
      window.setTimeout(() => setCopied(''), 1800);
    }).catch(() => {
      setCopied('No se pudo copiar');
      window.setTimeout(() => setCopied(''), 1800);
    });
  }

  function openWhatsApp() {
    const phone = String(form.whatsapp || form.clienteTelefono || '').replace(/\D/g, '');
    const message = encodeURIComponent(`Hola, quiero cotizar ${form.producto || 'un proyecto'} con ALUXOR.`);
    const target = phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  function openPrint(mode = 'client') {
    setPdfEditor({ mode, view: mode, doc: Report.professionalDocFromQuote(form, quote, reportHelpers) });
  }

  function generateProfessionalPdf(mode = 'client') {
    const html = Pdf.quotePrintHtml(
      form,
      quote,
      materials,
      mode,
      pdfEditor?.doc,
      appLogo,
      { ...pdfHelpers, brandName: workspaceSettings?.company_name || BRAND_NAME }
    );
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
    setPdfEditor(null);
  }


  return {
    form,
    setForm,
    history,
    activeQuoteIdentity,
    selectedHistoryPreview,
    setSelectedHistoryPreview,
    syncStatus,
    setSyncStatus,
    lastSyncAt,
    pendingOfflineCount,
    legacyHistoryStatus,
    legacyRecoveredCount,
    copied,
    pdfEditor,
    setPdfEditor,
    quoteCollaborationStatus,
    quoteFieldConflicts,
    quoteCollaborators,
    quotePresenceStatus,
    visibleSyncStatus,
    quote,
    dataHealth,
    contextualQuoteSummary,
    materials,
    outputs,
    roleCards,
    professionalAnalysis,
    chainInsights,
    score,
    mainOutput,
    quoteOutput,
    updateDirtyQuoteForm,
    update,
    updateMeasure,
    updateMeasureItem,
    addMeasureItem,
    removeMeasureItem,
    updateMaterialItem,
    addMaterialItem,
    removeMaterialItem,
    applySuggestedPrices,
    applyQuoteProfile,
    updateAccessoryItem,
    addAccessoryItem,
    removeAccessoryItem,
    loadRemoteQuotes,
    saveToHistory,
    syncHistory,
    loadHistoryItem,
    openQuoteFromProduction,
    startNewQuote,
    removeHistoryItem,
    exportHistoryBackup,
    importHistoryBackup,
    updateHistoryStatus,
    syncQuoteNoteFromProduction,
    copyText,
    openWhatsApp,
    openPrint,
    generateProfessionalPdf,
    handleQuoteFieldFocus,
    handleQuoteFieldBlur,
  };
}
