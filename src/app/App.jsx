// cSpell:words ALUXOR AnunciaPro anunciapro aluxor Clóset clóset clósets Cotizacion cotizacion Telefono telefono whatsapp promocion jaladera Jaladera jaladeras Jaladeras tornillería Silicón categoria bano economico descripcion triplay Triplay buro buró Buró burós pzas Vidrieria Carpinteria zoclo herrajes melamina merma cotizador metalness
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  Archive,
  Box,
  Calculator,
  ClipboardList,
  DoorOpen,
  Eraser,
  FileText,
  Hammer,
  History,
  LayoutDashboard,
  MessageCircle,
  Package,
  RefreshCw,
  Ruler,
  Scissors,
  Sparkles,
  Store,
  TableProperties,
  UserCheck,
} from 'lucide-react';
import AuthGate from '../components/auth/AuthGate.jsx';
import UserSessionCard from '../components/auth/UserSessionCard.jsx';
import Field from '../components/Field.jsx';
import InspectorPanel from '../components/InspectorPanel.jsx';
import PlanCanvas3D from '../components/PlanCanvas3D.jsx';
import ProjectFlow from '../components/ProjectFlow.jsx';
import SummaryPanel from '../components/SummaryPanel.jsx';
import WorkspaceLayout from '../layouts/WorkspaceLayout.jsx';
import AnnouncementSection from '../sections/AnnouncementSection.jsx';
import CatalogSection from '../sections/CatalogSection.jsx';
import CutOptimizerSection from '../sections/CutOptimizerSection.jsx';
import QuoteSection from '../sections/QuoteSection.jsx';
import DashboardSection from '../sections/DashboardSection.jsx';
import FabricationSection from '../sections/FabricationSection.jsx';
import HistorySection from '../sections/HistorySection.jsx';
import InventorySection from '../sections/InventorySection.jsx';
import ProductionSection from '../sections/ProductionSection.jsx';
import PurchasesSection from '../sections/PurchasesSection.jsx';
import ReceivingSection from '../sections/ReceivingSection.jsx';
import SettingsSection from '../sections/SettingsSection.jsx';
import TextSection from '../sections/TextSection.jsx';
import WorkspaceAccessRequestsSection, {
  WorkspaceAccessGate,
} from '../sections/WorkspaceAccessRequestsSection.jsx';
import { AuthService } from '../lib/auth/authService.js';
import { canAccessSection } from '../lib/workspace/permissions.js';
import useWorkspace from '../hooks/useWorkspace.js';
import { QuoteRepository } from '../lib/quotes/quoteRepository.js';
import { QuoteAdapter } from '../lib/quotes/quoteAdapter.js';
import { OfflineQueue } from '../lib/quotes/offlineQueue.js';
import { ConflictResolver } from '../lib/quotes/conflictResolver.js';
import useProduction from '../hooks/useProduction.js';
import {
  Materials,
  Pricing,
  Report,
  Quote,
  HistoryEngine,
  Pdf,
  StorageEngine,
  PlanEngine,
  AnalysisEngine,
} from '../lib/br-engine/index.js';

import {
  APP_VERSION,
  BRAND_NAME,
  HISTORY_API,
  LEGACY_HISTORY_COOLDOWN_MS,
} from './config/constants.js';
import {
  catalogDefaults,
  defaultTypeDetails,
  defaults,
  formasPlano,
  plantillasPlano,
  quoteProfiles,
  tonos,
} from './config/data.js';
import { guideFor } from './config/guides.js';
import {
  analysisHelpers,
  clean,
  countScore,
  decimal,
  formatDimensions,
  historyHelpers,
  isNetworkError,
  isRemoteQuoteId,
  money,
  normalizeCatalogItem,
  numberValue,
  pdfHelpers,
  percentValue,
  planHelpers,
  positiveNumber,
  queuedCreateMatchesRow,
  quoteDataHealth,
  quoteFieldValuesEqual,
  quoteFormChanges,
  quoteFormValue,
  quoteHelpers,
  refreshInstalledApp,
  reportHelpers,
  storageHelpers,
  typeOptionsFor,
  withQuoteFormValue,
} from './config/helpers.js';

function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [form, setForm] = useState(defaults);
  const [catalog, setCatalog] = useState(catalogDefaults);
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
  const quoteAutoSaveTimerRef = useRef(null);
  const quoteAutoSavePendingRef = useRef(false);
  const quoteAutoSaveInitializedRef = useRef(false);
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
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const previousActiveSectionRef = useRef(activeSection);
  const [syncStatus, setSyncStatus] = useState('Historial local');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [planView, setPlanView] = useState('3d');
  const [planRotation, setPlanRotation] = useState(0);
  const [planZoom, setPlanZoom] = useState(100);
  const [typeDetails, setTypeDetails] = useState(defaultTypeDetails);
  const [floatingSummary, setFloatingSummary] = useState({ x: 24, y: 120, compact: false, minimized: false });
  const [quickCalc, setQuickCalc] = useState({ materialId: '', nombre: 'Melamina', categoria: 'Madera/Melamina', tipoCompra: 'hoja', baseUso: 'medidas', ancho: 122, alto: 244, largo: 100, cantidad: 1, precioTotal: 1200, areaManual: 0, linealManual: 0, cantidadManual: 1, merma: 8, margen: 35 });
  const [pdfEditor, setPdfEditor] = useState(null);
  const {
    activeWorkspace,
    activeMembership,
    workspaceLoading,
    workspaceError,
    workspaceAccessStatus,
    workspaceSettings,
    workspaceSettingsSaving,
    workspaceSettingsError,
    hydratedWorkspaceId,
    appLogo,
    currentWorkspaceRole,
    canManageWorkspaceAccess,
    canEditWorkspaceQuotes,
    canEditWorkspaceSettings,
    refreshWorkspace,
    saveWorkspaceSettings: saveWorkspaceCompanyName,
    handleLogoUpload,
    removeAppLogo,
  } = useWorkspace({
    authSession,
    catalogDefaults,
    defaultTypeDetails,
    defaults,
    setForm,
    setCatalog,
    setTypeDetails,
    setHistory,
    setActiveQuoteIdentity,
    setSelectedHistoryPreview,
    setPendingOfflineCount,
    StorageEngine,
    OfflineQueue,
    historyRef,
  });
  const {
    productionOrders,
    selectedProductionOrderId,
    productionLoading,
    productionError,
    productionSyncStatus,
    activeProductionOrder,
    canGenerateProductionOrder,
    setSelectedProductionOrderId,
    createProductionOrder: generateProductionOrderFromCurrentQuote,
    updateProductionOrder: handleUpdateProductionOrder,
    refreshProduction,
    syncProductionOrderFromQuote,
  } = useProduction({
    authSession,
    activeWorkspace,
    workspaceAccessStatus,
    activeQuoteIdentity,
    form,
    setSyncStatus,
    setActiveSection,
  });
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

  function applyRemoteQuoteRow(row, { ignoreSaveLock = false } = {}) {
    const activeIdentity = activeQuoteIdentityRef.current;
    if (!row?.id || row.id !== activeIdentity?.id) {
      return { applied: false, hasConflicts: false };
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
    const changes = quoteFormChanges(confirmedForm, remoteForm);
    const hasRemoteChanges = changes.size > 0;
    let nextForm = latestQuoteFormRef.current;
    let changedVisibleForm = false;

    changes.forEach((remoteValue, fieldPath) => {
      const baseValue = quoteFormValue(confirmedForm, fieldPath);
      const localValue = quoteFormValue(nextForm, fieldPath);

      if (focusedQuoteFieldRef.current === fieldPath) {
        remoteQuoteBufferRef.current.fields.set(fieldPath, {
          baseValue,
          remoteValue,
          version: remoteItem.version,
        });
        return;
      }

      if (dirtyQuoteFieldsRef.current.has(fieldPath)) {
        if (quoteFieldValuesEqual(fieldPath, localValue, remoteValue)) {
          dirtyQuoteFieldsRef.current.delete(fieldPath);
          quoteFieldConflictsRef.current.delete(fieldPath);
          remoteQuoteBufferRef.current.fields.delete(fieldPath);
        } else if (quoteFieldValuesEqual(fieldPath, localValue, baseValue)) {
          nextForm = withQuoteFormValue(nextForm, fieldPath, remoteValue);
          dirtyQuoteFieldsRef.current.delete(fieldPath);
          quoteFieldConflictsRef.current.delete(fieldPath);
          remoteQuoteBufferRef.current.fields.delete(fieldPath);
          changedVisibleForm = true;
        } else {
          remoteQuoteBufferRef.current.fields.set(fieldPath, {
            baseValue,
            remoteValue,
            version: remoteItem.version,
          });
          quoteFieldConflictsRef.current.delete(fieldPath);
        }
        return;
      }

      nextForm = withQuoteFormValue(nextForm, fieldPath, remoteValue);
      remoteQuoteBufferRef.current.fields.delete(fieldPath);
      quoteFieldConflictsRef.current.delete(fieldPath);
      changedVisibleForm = true;
    });

    lastConfirmedQuoteFormRef.current = remoteForm;
    if (changedVisibleForm) {
      latestQuoteFormRef.current = nextForm;
      quoteRemoteApplyRef.current = dirtyQuoteFieldsRef.current.size === 0;
      setForm(nextForm);
    }

    const nextIdentity = {
      ...activeIdentity,
      folio: remoteItem.folio,
      createdAt: remoteItem.createdAt,
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
        : hasRemoteChanges ? 'Actualizado por otro usuario' : 'Sincronizado'
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

  useEffect(() => {
    let isMounted = true;

    AuthService.getSession()
      .then((session) => {
        if (isMounted) setAuthSession(session);
      })
      .catch(() => {
        if (isMounted) setAuthSession(null);
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    const subscription = AuthService.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setAuthSession(session);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

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
  const currentTypeOptions = typeOptionsFor(form.giro, typeDetails);
  const quickCantidad = Math.max(1, positiveNumber(quickCalc.cantidad) || 1);
  const quickPrecioUnidadCompra = positiveNumber(quickCalc.precioTotal) / quickCantidad;
  const quickAreaPorPieza = (positiveNumber(quickCalc.ancho) / 100) * (positiveNumber(quickCalc.alto) / 100);
  const quickArea = quickAreaPorPieza * quickCantidad;
  const quickLinear = (positiveNumber(quickCalc.largo) / 100) * quickCantidad;
  const quickCostoM2 = quickArea > 0 ? positiveNumber(quickCalc.precioTotal) / quickArea : 0;
  const quickCostoLineal = quickLinear > 0 ? positiveNumber(quickCalc.precioTotal) / quickLinear : 0;
  const quickCostoUnitario = quickCalc.tipoCompra === 'lineal' ? quickCostoLineal : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickPrecioUnidadCompra : quickCostoM2;
  const quickAreaNecesaria = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.areaManual) : quote.areaTotal;
  const quickLinealNecesario = quickCalc.baseUso === 'manual' ? positiveNumber(quickCalc.linealManual) : quote.linearTotal;
  const quickCantidadNecesaria = quickCalc.baseUso === 'manual' ? Math.max(1, positiveNumber(quickCalc.cantidadManual) || 1) : Math.max(1, quote.cantidad || 1);
  const quickMaterialCalc = Materials.calcularMaterial({
    tipoCompra: quickCalc.tipoCompra,
    areaNecesaria: quickAreaNecesaria,
    linealNecesario: quickLinealNecesario,
    cantidad: quickCantidadNecesaria,
    ancho: positiveNumber(quickCalc.ancho) / 100,
    alto: positiveNumber(quickCalc.alto) / 100,
    precioUnidad: quickPrecioUnidadCompra,
    precioMetroCuadrado: quickCostoM2,
    precioMetroLineal: quickCostoLineal,
    costoInterno: quickCostoUnitario,
    merma: percentValue(quickCalc.merma),
    margen: positiveNumber(quickCalc.margen),
  });
  const quickCostoBase = positiveNumber(quickCostoUnitario);
  const quickCostoConMerma = quickCostoBase * (1 + percentValue(quickCalc.merma) / 100);
  const quickPricing = {
    costoBase: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCostoBase,
    costoConMerma: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCostoConMerma,
    precioCliente: quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.precioCliente : Pricing.aplicarMargenSobreCosto(quickCostoConMerma, quickCalc.margen),
  };
  const quickFactorMerma = 1 + percentValue(quickCalc.merma) / 100;
  const quickHojasComprar = quickAreaPorPieza > 0 ? Math.ceil((quickAreaNecesaria * quickFactorMerma) / quickAreaPorPieza) : 0;
  const quickPiezasComprar = Math.ceil(quickCantidadNecesaria * quickFactorMerma);
  const quickCompraSinMerma = quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickCostoLineal : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickCostoUnitario : quickAreaNecesaria * quickCostoM2;
  const quickCompraConMerma = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.costoInterno : quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickFactorMerma * quickCostoLineal : quickPiezasComprar * quickCostoUnitario;
  const quickTotalClienteSinMargen = quickCompraSinMerma * quickFactorMerma;
  const quickTotalClienteConMargen = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.precioCliente : quickCalc.tipoCompra === 'lineal' ? quickLinealNecesario * quickPricing.precioCliente : quickCalc.tipoCompra === 'pieza' || quickCalc.tipoCompra === 'manual' ? quickCantidadNecesaria * quickPricing.precioCliente : quickAreaNecesaria * quickPricing.precioCliente;
  const quickProfit = quickCalc.tipoCompra === 'hoja' ? quickMaterialCalc.utilidad : quickTotalClienteConMargen - quickCompraConMerma;
  const quickProfitPercent = quickCompraConMerma > 0 ? (quickProfit / quickCompraConMerma) * 100 : 0;
  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: LayoutDashboard },
    { id: 'anuncio', label: 'Anuncio', icon: Package },
    { id: 'cotizador-rellenado', label: 'Cotizador rellenado', icon: FileText },
    { id: 'cotizador', label: 'Cotizador', icon: Calculator },
    { id: 'produccion', label: 'Producción', icon: ClipboardList },
    { id: 'compras', label: 'Compras', icon: Store },
    { id: 'recepcion', label: 'Recepción', icon: DoorOpen },
    { id: 'inventario', label: 'Inventario', icon: Archive },
    { id: 'fabricacion', label: 'Fabricación', icon: Hammer },
    { id: 'corte', label: 'Cut Optimizer', icon: Scissors },
    { id: 'catalogo', label: 'Catálogo', icon: TableProperties },
    { id: 'historial', label: 'Historial', icon: History },
    { id: 'textos', label: 'Textos', icon: Sparkles },
    { id: 'ajustes', label: 'Ajustes', icon: Accessibility },
  ].filter((item) => canAccessSection(currentWorkspaceRole, item.id));

  if (canManageWorkspaceAccess) {
    menuItems.push({ id: 'solicitudes-acceso', label: 'Solicitudes', icon: UserCheck });
  }

  useEffect(() => {
    const allowed = activeSection === 'solicitudes-acceso'
      ? canManageWorkspaceAccess
      : canAccessSection(currentWorkspaceRole, activeSection);
    if (currentWorkspaceRole && !allowed) setActiveSection('inicio');
  }, [activeSection, canManageWorkspaceAccess, currentWorkspaceRole]);

  useEffect(() => {
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveCatalog(catalog);
  }, [activeWorkspace?.id, catalog, hydratedWorkspaceId]);

  useEffect(() => {
    historyRef.current = history;
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveHistory(history);
  }, [activeWorkspace?.id, history, hydratedWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveTypeDetails(typeDetails);
  }, [activeWorkspace?.id, hydratedWorkspaceId, typeDetails]);

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

    const unsubscribe = QuoteRepository.subscribeQuotes(
      workspaceId,
      (payload) => {
        const remoteRow = payload?.new?.id
          ? payload.new
          : null;

        const activeQuoteId =
          activeQuoteIdentityRef.current?.id;

        if (
          remoteRow?.id === activeQuoteId
          && !remoteRow.deleted_at
        ) {
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
                  applyRemoteQuoteRow(pendingRow);

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
      }
    );

    return () => {
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

  function addTypeDetail() {
    setTypeDetails((items) => [
      ...items,
      {
        id: `tipo-${Date.now()}`,
        giro: form.giro,
        tipo: form.giro === 'Vidriería' ? 'Nuevo tipo de vidrio' : 'Nuevo tipo de mueble',
        descripcion: 'Describe cuándo se usa este tipo.',
      },
    ]);
  }

  function updateTypeDetail(id, field, value) {
    setTypeDetails((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function removeTypeDetail(id) {
    setTypeDetails((items) => items.filter((item) => item.id !== id));
  }

  function updatePlanItem(id, field, value) {
    updateDirtyQuoteForm((current) => ({
      ...current,
      planItems: PlanEngine.planItemsFromForm(current, planHelpers).map((item) => (
        item.id === id ? { ...item, [field]: value } : item
      )),
    }));
  }

  function addPlanItem() {
    updateDirtyQuoteForm((current) => ({
      ...current,
      planItems: [
        ...PlanEngine.planItemsFromForm(current, planHelpers),
        {
          id: `plano-${Date.now()}`,
          nombre: 'Nueva pieza',
          forma: 'Pieza vertical',
          ancho: current.ancho,
          alto: current.alto,
          fondo: current.fondo,
          cantidad: 1,
          nota: '',
          posX: '',
          posY: '',
          posZ: '',
        },
      ],
    }));
  }

  function removePlanItem(id) {
    updateDirtyQuoteForm((current) => {
      const items = PlanEngine.planItemsFromForm(current, planHelpers).filter((item) => item.id !== id);
      return { ...current, planItems: items.length ? items : [] };
    });
  }

  function syncPlanWithMeasures() {
    setForm((current) => ({
      ...current,
      planItems: [
        {
          id: 'pieza-principal',
          nombre: current.tipoTrabajo || 'Vista principal',
          forma: 'Pieza vertical',
          ancho: numberValue(current.ancho),
          alto: numberValue(current.alto),
          fondo: numberValue(current.fondo),
          cantidad: Math.max(1, numberValue(current.cantidad) || 1),
          nota: 'Medida general del proyecto',
          posX: '',
          posY: '',
          posZ: '',
        },
      ],
    }));
    setActiveSection('plano');
  }

  function applyPlanTemplate(template) {
    setForm((current) => ({
      ...current,
      giro: template.giro,
      tipoTrabajo: template.tipoTrabajo,
      producto: template.tipoTrabajo === 'Cancel'
        ? 'Cancel a medida'
        : template.tipoTrabajo === 'Ventana'
          ? 'Ventana a medida'
          : `${template.label} a medida`,
      planItems: PlanEngine.planTemplateData(template.id, current, planHelpers),
    }));
    setPlanView('3d');
    setActiveSection('plano');
  }

  function updateCatalogItem(id, field, value) {
    setCatalog((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function addCatalogItem() {
    setCatalog((items) => [
      ...items,
      normalizeCatalogItem({
        id: `cat-${Date.now()}`,
        categoria: form.giro,
        tipoTrabajo: form.tipoTrabajo,
        nombre: form.producto || 'Nuevo producto',
        materialCotizacion: form.materialCotizacion,
        herrajes: form.herrajes,
        unidad: 'm²',
        costo: numberValue(form.costoMaterialM2),
        precio: numberValue(form.precioM2),
        costoHerrajes: numberValue(form.costoHerrajes),
        precioHerrajes: numberValue(form.precioHerrajes),
        merma: numberValue(form.merma),
        manoObra: numberValue(form.manoObra),
        extras: numberValue(form.extras),
      }),
    ]);
  }

  function removeCatalogItem(id) {
    setCatalog((items) => items.filter((item) => item.id !== id));
  }

  function applyCatalogItem(item) {
    const next = {
      ...form,
      giro: item.categoria || form.giro,
      tipoTrabajo: item.tipoTrabajo || form.tipoTrabajo,
      producto: item.nombre || form.producto,
      materialCotizacion: item.materialCotizacion || form.materialCotizacion,
      herrajes: item.herrajes || form.herrajes,
      costoMaterialM2: numberValue(item.costo),
      precioM2: numberValue(item.precio),
      costoHerrajes: numberValue(item.costoHerrajes),
      precioHerrajes: numberValue(item.precioHerrajes),
      merma: numberValue(item.merma),
      manoObra: numberValue(item.manoObra),
      extras: numberValue(item.extras),
    };

    setForm({
      ...next,
      medidas: formatDimensions(next),
    });
    setActiveSection('cotizador');
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
    { allowPrompt = false } = {},
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

    const keepRemote = window.confirm(
      'La cotización fue modificada desde otro dispositivo.\n\nAceptar: usar versión remota.\nCancelar: conservar la mía.'
    );
    const result = keepRemote
      ? await ConflictResolver.resolveKeepRemote(localItem)
      : await ConflictResolver.resolveKeepLocal(localItem);

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
      version: currentIdentity?.version || null,
      remote: hasRemoteIdentity,
    };
    activeQuoteIdentityRef.current = localIdentity;
    setActiveQuoteIdentity(localIdentity);

    if (hasRemoteIdentity) {
      syncProductionOrderFromQuote(
        currentIdentity.id,
        historyForm,
        currentIdentity.version
      );
    }

    const workspaceId = activeWorkspace?.id;
    const userId = authSession?.user?.id;

    if (!workspaceId) {
      quoteSaveInFlightRef.current = false;
    void Promise.resolve(legacySave).finally(() => {        setSyncStatus('Guardada localmente · esperando conexión al workspace');
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
      void Promise.resolve(legacySave).finally(() => {
        setSyncStatus('Guardada localmente · pendiente de sincronizar');
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
        if (!isWorkspaceFolioConflict(firstAttempt.error)) return firstAttempt;

        warnCreateQuoteError(firstAttempt.error);
        setSyncStatus('Folio duplicado · generando nuevo consecutivo');

        const {
          data: remoteQuotes,
          error: remoteQuotesError,
        } = await QuoteRepository.loadQuotes(workspaceId);
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
          await resolveQuoteConflict(item, queuedOperation, { allowPrompt: true });
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

        syncProductionOrderFromQuote(
          remoteItem.id,
          remoteItem.form || historyForm,
          remoteItem.version
        );

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
        quoteSaveInFlightRef.current = false;
        const hasPendingAutoSave = quoteAutoSavePendingRef.current;
        quoteAutoSavePendingRef.current = false;

        flushRemoteQuoteBuffer();

        if (hasPendingAutoSave) {
          const autoConflictRetryPending = quoteAutoSaveConflictRetryRef.current;
          quoteAutoSaveConflictRetryRef.current = false;

          queueMicrotask(() => {
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

    if (!['cotizador', 'cotizador-rellenado'].includes(activeSection)) return undefined;

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
    const version = numberValue(item.version);
    setSelectedHistoryPreview(null);
    const loadedForm = { ...defaults, ...item.form };
    const nextIdentity = {
      id: item.id,
      workspaceId: activeWorkspace?.id || null,
      folio: item.folio,
      createdAt: item.createdAt,
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
    setForm(loadedForm);
    setActiveQuoteIdentity(nextIdentity);
    publishQuoteFieldConflicts();
    setQuoteCollaborationStatus('Sincronizado');
    setActiveSection('cotizador');
  }
  function openQuoteFromProduction(quoteId) {
    const relatedQuote = historyRef.current.find((item) => item.id === quoteId);

    if (!relatedQuote) {
      setSyncStatus('No se encontró la cotización relacionada.');
      return;
    }

    loadHistoryItem(relatedQuote);
  }

  function startNewQuote() {
    const confirmed = window.confirm(
      '¿Comenzar una nueva cotización?\n\nSe limpiarán los datos de la cotización actual. Esta acción no elimina historial, catálogo, precios ni configuración.'
    );

    if (!confirmed) return;

    const nextDefaults =
      typeof structuredClone === 'function'
        ? structuredClone(defaults)
        : JSON.parse(JSON.stringify(defaults));

    setForm(nextDefaults);
    latestQuoteFormRef.current = nextDefaults;
    lastConfirmedQuoteFormRef.current = nextDefaults;
    dirtyQuoteFieldsRef.current.clear();
    quoteFieldConflictsRef.current.clear();
    remoteQuoteBufferRef.current = { fields: new Map(), pendingRow: null };
    focusedQuoteFieldRef.current = null;
    setSelectedHistoryPreview(null);
    activeQuoteIdentityRef.current = null;
    setActiveQuoteIdentity(null);
    publishQuoteFieldConflicts();
    setQuoteCollaborationStatus('Sincronizado');
    setActiveSection('cotizador');
    setCopied('Nueva cotización lista');
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
        setSyncStatus('Conflicto de versión · requiere revisión');
        return;
      }

      if (error || !data) {
        if (isNetworkError(error)) {
          enqueueStatusUpdate();
          setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
        } else {
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
      setForm((current) => (
        activeQuoteIdentity?.id === id
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
      removeQueuedQuoteOperations('update', workspaceId, id);
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
        setSyncStatus('Estado guardado localmente · pendiente de sincronizar');
      } else {
        setSyncStatus('Estado actualizado localmente');
      }
    }
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

  function updateQuickCalc(field, value) {
    setQuickCalc((current) => ({ ...current, [field]: ['nombre', 'categoria', 'tipoCompra', 'materialId', 'baseUso'].includes(field) ? value : numberValue(value) }));
  }

  function quickCalcText() {
    return [
      `Material: ${quickCalc.nombre}`,
      `Área total comprada: ${decimal(quickArea)} m²`,
      `Costo real por m²: ${money(quickCostoM2)}`,
      `Costo real por metro lineal: ${money(quickCostoLineal)}`,
      `Costo con merma: ${money(quickPricing.costoConMerma)}`,
      `Precio recomendado: ${money(quickPricing.precioCliente)}`,
    ].join('\n');
  }

  function applyQuickCalcToQuote() {
    setForm((current) => {
      const measureItems = Quote.measurementItemsFromForm(current, quoteHelpers);
      const first = measureItems[0] || Quote.normalizeMeasureItem({}, 0, current, quoteHelpers);
      const nextMeasure = {
        ...first,
        ancho: positiveNumber(quickCalc.ancho),
        alto: positiveNumber(quickCalc.alto),
        cantidad: Math.max(1, positiveNumber(quickCalc.cantidad) || 1),
      };
      const next = {
        ...current,
        ancho: nextMeasure.ancho,
        alto: nextMeasure.alto,
        cantidad: nextMeasure.cantidad,
        measureItems: [nextMeasure, ...measureItems.slice(1)],
      };
      return { ...next, medidas: formatDimensions(next) };
    });
  }

  function applyQuickCalcToMaterial() {
    setForm((current) => {
      const materialItems = Quote.materialItemsFromForm(current, Quote.quoteAreaTotal(current, quoteHelpers), quoteHelpers);
      const selectedId = quickCalc.materialId;
      const target = materialItems.find((item) => item.id === selectedId);
      const nextItem = {
        ...(target || Quote.normalizeMaterialItem({ id: `mat-${Date.now()}`, nombre: quickCalc.nombre }, materialItems.length, current, quoteHelpers)),
        nombre: clean(quickCalc.nombre, 'Material'),
        categoria: clean(quickCalc.categoria, 'Material'),
        calculo: quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual' : 'area',
        baseCalculo: quickCalc.baseUso === 'manual'
          ? (quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual_qty' : 'manual_area')
          : (quickCalc.tipoCompra === 'lineal' ? 'lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'manual_qty' : 'medidas_area'),
        tipoCompra: quickCalc.tipoCompra,
        unidad: quickCalc.tipoCompra === 'lineal' ? 'metro lineal' : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? 'pieza' : 'm²',
        usarArea: ['hoja', 'area', 'lineal'].includes(quickCalc.tipoCompra),
        cantidad: quickCalc.tipoCompra === 'lineal' ? Math.max(1, positiveNumber(quickCalc.largo) || 1) : ['pieza', 'manual'].includes(quickCalc.tipoCompra) ? quickCantidadNecesaria : quickCantidad,
        ancho: positiveNumber(quickCalc.ancho),
        alto: positiveNumber(quickCalc.alto),
        largo: positiveNumber(quickCalc.largo),
        costoUnitario: Math.round(quickCalc.tipoCompra === 'hoja' ? quickPrecioUnidadCompra : quickCostoUnitario),
        precioUnitario: Math.round(quickPricing.precioCliente),
        merma: percentValue(quickCalc.merma),
        margen: positiveNumber(quickCalc.margen),
        precioManual: false,
      };
      const nextItems = target
        ? materialItems.map((item) => (item.id === selectedId ? nextItem : item))
        : [nextItem, ...materialItems];
      return {
        ...current,
        costoMaterialM2: Math.round(quickCostoM2 || quickCostoUnitario),
        precioM2: Math.round(quickPricing.precioCliente),
        merma: percentValue(quickCalc.merma),
        margenMaterial: positiveNumber(quickCalc.margen),
        materialItems: nextItems,
      };
    });
  }

  function startSummaryDrag(event) {
    if (event.target.closest('button')) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const start = floatingSummary;
    const onMove = (moveEvent) => {
      setFloatingSummary((current) => ({
        ...current,
        x: Math.max(8, start.x + moveEvent.clientX - startX),
        y: Math.max(8, start.y + moveEvent.clientY - startY),
      }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
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

  const input = (field, type = 'text') => (
    <input
      id={field}
      data-quote-field={field}
      data-quote-conflict={quoteFieldConflicts.includes(field) ? 'true' : undefined}
      type={type}
      value={form[field] ?? ''}
      onChange={(event) => update(field, type === 'number' ? numberValue(event.target.value) : event.target.value)}
    />
  );

  const textareaInput = (field) => (
    <textarea
      id={field}
      data-quote-field={field}
      data-quote-conflict={quoteFieldConflicts.includes(field) ? 'true' : undefined}
      value={form[field] ?? ''}
      onChange={(event) => update(field, event.target.value)}
    />
  );

  async function handleSignOut() {
    setSignOutLoading(true);
    refreshWorkspace({ error: '' });

    const { error } = await AuthService.signOut();

    if (error) {
      refreshWorkspace({ error: 'No fue posible cerrar la sesión. Intenta nuevamente.' });
      setSignOutLoading(false);
      return;
    }

    setAuthSession(null);
    refreshWorkspace({ reset: true });
    setSignOutLoading(false);
  }

  return (
    <AuthGate session={authSession} loading={authLoading}>
      {workspaceLoading || !activeWorkspace ? (
        <WorkspaceAccessGate
          status={workspaceAccessStatus}
          error={workspaceError}
          loading={
            workspaceLoading
            || signOutLoading
            || (!workspaceAccessStatus && !workspaceError)
          }
          onSignOut={handleSignOut}
        />
      ) : (
      <main className={largeText ? 'workspace-shell large-text' : 'workspace-shell'}>
      <WorkspaceLayout
        sidebar={(
          <div className="workspace-sidebar-stack">
        <div className="brand-card">
          {appLogo ? <img src={appLogo} alt="Logo ALUXOR" className="brand-logo" /> : <div className="brand-mark">A</div>}
          <div>
            <strong>{workspaceSettings?.company_name || BRAND_NAME}</strong>
            <span>Cotizador profesional</span>
          </div>
        </div>

        <UserSessionCard
          user={authSession?.user}
          workspace={activeWorkspace}
          membership={activeMembership}
          onSignOut={handleSignOut}
          loading={workspaceLoading || signOutLoading}
        />

        {workspaceError && (
          <p className="workspace-session-error" role="alert">{workspaceError}</p>
        )}

        <SummaryPanel
          proyecto={contextualQuoteSummary.nombre}
          descripcion={contextualQuoteSummary.descripcion}
          totalCliente={money(contextualQuoteSummary.quote.total)}
          costoInterno={money(contextualQuoteSummary.quote.internalTotal)}
          utilidad={money(contextualQuoteSummary.quote.profit)}
          anticipo={money(contextualQuoteSummary.quote.deposit)}
          saldo={money(contextualQuoteSummary.quote.rest)}
          estadoProyecto={contextualQuoteSummary.estado}
          riesgos={contextualQuoteSummary.riesgos}
          indicadores={contextualQuoteSummary.indicadores}
          progreso={contextualQuoteSummary.progreso}
          onWhatsApp={openWhatsApp}
          onPdf={() => openPrint('client')}
          onGuardar={saveToHistory}
          onHistorial={() => setActiveSection('historial')}
          canSave={canEditWorkspaceQuotes}
        />

        <nav className="menu" aria-label="Secciones principales">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? 'active' : ''}
              onClick={() => setActiveSection(id)}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
          {canAccessSection(currentWorkspaceRole, 'plano') && (
            <button type="button" className={activeSection === 'plano' ? 'active' : ''} onClick={() => setActiveSection('plano')}>
              <Box size={18} />
              Plano 3D
            </button>
          )}
        </nav>

        <div className="sync-card">
          <RefreshCw size={18} />
          <div>
            <strong>{visibleSyncStatus}</strong>
            <span>{lastSyncAt ? `Última sincronización: ${lastSyncAt}` : visibleSyncStatus.includes('Sin conexión') ? 'Usando copia local' : 'Local + nube'}</span>
          </div>
        </div>

        <button type="button" className="access-button" onClick={() => setLargeText((value) => !value)}>
          <Accessibility size={18} />
          Letra grande
        </button>
        <button type="button" className="ghost" onClick={refreshInstalledApp}>
          <RefreshCw size={18} />
          Actualizar app
        </button>
          </div>
        )}

        content={(
      <section className="content">
        <div className="project-context-layer">
        <header className="hero hero-compact">
          <div className="hero-main">
            <div className="hero-status-row">
              <p className="eyebrow">Proyecto activo · Versión {APP_VERSION}</p>
              <span>{form.estadoCotizacion || 'Pendiente'}</span>
            </div>

            <div className="hero-brand-line hero-title-row">
              {appLogo ? <img src={appLogo} alt="Logo ALUXOR/BosqueReal" className="hero-logo" /> : null}
              <div>
                <h1>{form.producto || 'Proyecto sin nombre'}</h1>
                <p>{form.clienteNombre || 'Cliente pendiente'} · Responsable: Taller ALUXOR</p>
              </div>
            </div>

            <div className="hero-project-meta compact-meta">
              <span>Avance <strong>{decimal(dataHealth.score, 0)}%</strong></span>
              <span>Entrega <strong>{form.entrega || 'Por definir'}</strong></span>
              <span>Próxima acción <strong>{quote.materialRows?.[0]?.nombre ? `Comprar ${quote.materialRows[0].nombre}` : 'Revisar datos'}</strong></span>
            </div>
          </div>

          <div className="hero-actions hero-actions-compact">
            <button type="button" className="ghost" onClick={refreshInstalledApp}><RefreshCw size={16} /> Actualizar</button>
            {canEditWorkspaceQuotes && (
              <button type="button" className="ghost" onClick={startNewQuote}><History size={16} /> Nueva cotización</button>
            )}
            {canEditWorkspaceQuotes && ['cotizador', 'cotizador-rellenado'].includes(activeSection) && activeQuoteIdentity && (
              <button
                type="button"
                className="ghost"
                disabled={!activeProductionOrder && !canGenerateProductionOrder}
                onClick={generateProductionOrderFromCurrentQuote}
              >
                <ClipboardList size={16} />
                {activeProductionOrder ? 'Ver Orden de Producción' : 'Generar Orden de Producción'}
              </button>
            )}
            <button type="button" className="ghost" onClick={() => setActiveSection('textos')}><FileText size={16} /> Textos</button>
            <button type="button" onClick={openWhatsApp}><MessageCircle size={16} /> WhatsApp</button>
            <button type="button" onClick={() => openPrint('client')}><FileText size={16} /> PDF</button>
          </div>
        </header>
        </div>

        <div className="workflow-layer">
          <ProjectFlow
            activeSection={activeSection}
            projectName={form.producto || 'Proyecto sin nombre'}
            projectStatus={form.estadoCotizacion || 'Pendiente'}
            customer={form.clienteNombre || 'Cliente pendiente'}
            progress={dataHealth.score}
            total={quote.total}
            nextAction={quote.materialRows?.[0]?.nombre ? `Comprar ${quote.materialRows[0].nombre}` : 'Revisar datos'}
          />
        </div>
        <section className="work-layer">

        {activeSection === 'inicio' && (
          <DashboardSection
            form={form}
            quote={quote}
            dataHealth={dataHealth}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'anuncio' && (
          <AnnouncementSection
            form={form}
            update={update}
            guideFor={guideFor}
            input={input}
            textareaInput={textareaInput}
            currentTypeOptions={currentTypeOptions}
            tonos={tonos}
            mainOutput={mainOutput}
            copyText={copyText}
          />
        )}

        {['cotizador', 'cotizador-rellenado'].includes(activeSection) && (
          <QuoteSection
            mode={activeSection === 'cotizador-rellenado' ? 'filled' : 'full'}
            quoteProfiles={quoteProfiles}
            applyQuoteProfile={applyQuoteProfile}
            quickCalc={quickCalc}
            updateQuickCalc={updateQuickCalc}
            form={form}
            quote={quote}
            quoteHelpers={quoteHelpers}
            quickAreaPorPieza={quickAreaPorPieza}
            quickCostoM2={quickCostoM2}
            quickCostoLineal={quickCostoLineal}
            quickHojasComprar={quickHojasComprar}
            quickPiezasComprar={quickPiezasComprar}
            quickCompraSinMerma={quickCompraSinMerma}
            quickCompraConMerma={quickCompraConMerma}
            quickPricing={quickPricing}
            quickTotalClienteSinMargen={quickTotalClienteSinMargen}
            quickTotalClienteConMargen={quickTotalClienteConMargen}
            quickProfit={quickProfit}
            quickProfitPercent={quickProfitPercent}
            decimal={decimal}
            money={money}
            copyText={copyText}
            quickCalcText={quickCalcText}
            applyQuickCalcToMaterial={applyQuickCalcToMaterial}
            guideFor={guideFor}
            input={input}
            textareaInput={textareaInput}
            currentTypeOptions={currentTypeOptions}
            update={update}
            updateMeasureItem={updateMeasureItem}
            numberValue={numberValue}
            removeMeasureItem={removeMeasureItem}
            addMeasureItem={addMeasureItem}
            updateMaterialItem={updateMaterialItem}
            removeMaterialItem={removeMaterialItem}
            addMaterialItem={addMaterialItem}
            updateAccessoryItem={updateAccessoryItem}
            removeAccessoryItem={removeAccessoryItem}
            addAccessoryItem={addAccessoryItem}
            dataHealth={dataHealth}
            floatingSummary={floatingSummary}
            startSummaryDrag={startSummaryDrag}
            setFloatingSummary={setFloatingSummary}
            saveToHistory={saveToHistory}
            openPrint={openPrint}
            openWhatsApp={openWhatsApp}
            chainInsights={chainInsights}
            professionalAnalysis={professionalAnalysis}
            collaborationStatus={quoteCollaborationStatus}
            legacyHistoryStatus={legacyHistoryStatus}
            quoteFieldConflicts={quoteFieldConflicts}
            quoteCollaborators={quoteCollaborators}
            quotePresenceStatus={quotePresenceStatus}
            onQuoteFieldFocus={handleQuoteFieldFocus}
            onQuoteFieldBlur={handleQuoteFieldBlur}
          />
        )}
        {pdfEditor && (
          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar documento profesional">
            <section className="panel pdf-editor-modal">
              <div className="section-head">
                <div>
                  <h2>Editar documento profesional</h2>
                  <p>Revisa el documento antes de generar PDF cliente o interno.</p>
                </div>
              </div>
              <div className="actions compact">
                <button type="button" className={pdfEditor.view === 'client' ? '' : 'ghost'} onClick={() => setPdfEditor((current) => ({ ...current, view: 'client' }))}>Vista cliente</button>
                <button type="button" className={pdfEditor.view === 'business' ? '' : 'ghost'} onClick={() => setPdfEditor((current) => ({ ...current, view: 'business' }))}>Vista interna</button>
              </div>
              <div className="form-grid">
                {[
                  ['titulo', 'Título'],
                  ['cliente', 'Cliente'],
                  ['vigencia', 'Vigencia'],
                  ['anticipo', 'Anticipo'],
                  ['saldo', 'Saldo'],
                  ['total', 'Total'],
                ].map(([field, label]) => (
                  <Field key={field} id={`pdf-${field}`} label={label}>
                    <input
                      id={`pdf-${field}`}
                      value={pdfEditor.doc[field] || ''}
                      onChange={(event) => setPdfEditor((current) => ({ ...current, doc: { ...current.doc, [field]: event.target.value } }))}
                    />
                  </Field>
                ))}
                {[
                  ['descripcion', 'Descripción'],
                  ['partidas', 'Partidas'],
                  ['condiciones', 'Condiciones'],
                  ['notas', 'Notas'],
                ].map(([field, label]) => (
                  <Field key={field} id={`pdf-${field}`} label={label}>
                    <textarea
                      id={`pdf-${field}`}
                      value={pdfEditor.doc[field] || ''}
                      onChange={(event) => setPdfEditor((current) => ({ ...current, doc: { ...current.doc, [field]: event.target.value } }))}
                    />
                  </Field>
                ))}
              </div>
              <div className="pdf-preview">
                <h3>{pdfEditor.view === 'business' ? 'Vista interna' : 'Vista cliente'}</h3>
                <p><strong>Total:</strong> {pdfEditor.doc.total}</p>
                <p><strong>Anticipo:</strong> {pdfEditor.doc.anticipo} · <strong>Saldo:</strong> {pdfEditor.doc.saldo}</p>
                {pdfEditor.view === 'business' && (
                  <p><strong>Interno:</strong> costo {money(quote.internalTotal)}, utilidad {money(quote.profit)}, margen {decimal(quote.profitPercent, 1)}%.</p>
                )}
              </div>
              <div className="actions">
                <button type="button" onClick={() => generateProfessionalPdf('client')}><FileText size={18} /> Generar PDF cliente</button>
                <button type="button" className="ghost" onClick={() => generateProfessionalPdf('business')}><ClipboardList size={18} /> Generar PDF interno</button>
                <button type="button" className="ghost" onClick={() => setPdfEditor(null)}>Cancelar</button>
              </div>
            </section>
          </div>
        )}

        {activeSection === 'catalogo' && (
          <CatalogSection
            catalog={catalog}
            addCatalogItem={addCatalogItem}
            updateCatalogItem={updateCatalogItem}
            numberValue={numberValue}
            applyCatalogItem={applyCatalogItem}
            removeCatalogItem={removeCatalogItem}
          />
        )}

        {activeSection === 'produccion' && (
          <ProductionSection
            productionOrders={productionOrders}
            selectedProductionOrderId={selectedProductionOrderId}
            onSelectProductionOrder={setSelectedProductionOrderId}
            onOpenQuote={openQuoteFromProduction}
            onUpdateProductionOrder={handleUpdateProductionOrder}
            productionLoading={productionLoading}
            productionError={productionError}
            productionSyncStatus={productionSyncStatus}
          />
        )}

        {activeSection === 'compras' && (
          <PurchasesSection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'recepcion' && (
          <ReceivingSection
            form={form}
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'inventario' && (
          <InventorySection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'fabricacion' && (
          <FabricationSection
            form={form}
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'corte' && (
          <CutOptimizerSection
            quote={quote}
            decimal={decimal}
          />
        )}

        {activeSection === 'ajustes' && (
          <SettingsSection
            appLogo={appLogo}
            settings={workspaceSettings}
            canManage={canEditWorkspaceSettings}
            saving={workspaceSettingsSaving}
            error={workspaceSettingsError}
            onSaveCompanyName={saveWorkspaceCompanyName}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={removeAppLogo}
          />
        )}

        {activeSection === 'solicitudes-acceso' && canManageWorkspaceAccess && (
          <WorkspaceAccessRequestsSection
            workspaceId={activeWorkspace.id}
            currentMembership={activeMembership}
          />
        )}

        {activeSection === 'historial' && (
          <HistorySection
            syncStatus={visibleSyncStatus}
            lastSyncAt={lastSyncAt}
            legacyRecoveredCount={legacyRecoveredCount}
            exportHistoryBackup={exportHistoryBackup}
            importHistoryBackup={importHistoryBackup}
            syncHistory={syncHistory}
            history={history}
            money={money}
            updateHistoryStatus={updateHistoryStatus}
            loadHistoryItem={loadHistoryItem}
            removeHistoryItem={removeHistoryItem}
            selectedHistoryPreview={selectedHistoryPreview}
            selectHistoryPreview={setSelectedHistoryPreview}
            readOnly={!canEditWorkspaceQuotes}
          />
        )}

        {activeSection === 'textos' && (
          <TextSection
            outputs={outputs}
            quoteOutput={quoteOutput}
            copyText={copyText}
          />
        )}

        {activeSection === 'plano' && (
          <section className="panel-grid two-cols">
            <article className="panel">
              <div className="section-head">
                <div>
                  <h2>Plano SVG y vista 3D</h2>
                  <p>Arma piezas por medida, usa plantillas o sincroniza con la cotización.</p>
                </div>
                <button type="button" className="ghost" onClick={syncPlanWithMeasures}><Ruler size={18} /> Usar medidas</button>
              </div>
              <div className="actions compact">
                {plantillasPlano.map((template) => (
                  <button key={template.id} type="button" className="ghost" onClick={() => applyPlanTemplate(template)}>{template.label}</button>
                ))}
              </div>
              {PlanEngine.planItemsFromForm(form, planHelpers).map((item) => (
                <div key={item.id} className="row-card plan-row">
                  <input value={item.nombre} onChange={(event) => updatePlanItem(item.id, 'nombre', event.target.value)} aria-label="Nombre de pieza" />
                  <select value={item.forma} onChange={(event) => updatePlanItem(item.id, 'forma', event.target.value)} aria-label="Forma">
                    {formasPlano.map((forma) => <option key={forma}>{forma}</option>)}
                  </select>
                  <input type="number" value={item.ancho} onChange={(event) => updatePlanItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho" />
                  <input type="number" value={item.alto} onChange={(event) => updatePlanItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto" />
                  <input type="number" value={item.fondo} onChange={(event) => updatePlanItem(item.id, 'fondo', numberValue(event.target.value))} aria-label="Fondo" />
                  <button type="button" className="ghost" onClick={() => removePlanItem(item.id)}><Eraser size={16} /></button>
                </div>
              ))}
              <button type="button" className="ghost" onClick={addPlanItem}>Agregar pieza</button>
            </article>

            <article className="panel plan-preview">
              <div className="actions compact">
                <button type="button" className={planView === '3d' ? '' : 'ghost'} onClick={() => setPlanView('3d')}>3D real</button>
                <button type="button" className={planView === 'svg3d' ? '' : 'ghost'} onClick={() => setPlanView('svg3d')}>SVG 3D</button>
                <button type="button" className={planView === 'svg' ? '' : 'ghost'} onClick={() => setPlanView('svg')}>Plano 2D</button>
              </div>
              <label htmlFor="planRotation">Rotación</label>
              <input id="planRotation" type="range" min="-180" max="180" value={planRotation} onChange={(event) => setPlanRotation(numberValue(event.target.value))} />
              <label htmlFor="planZoom">Zoom</label>
              <input id="planZoom" type="range" min="75" max="125" value={planZoom} onChange={(event) => setPlanZoom(numberValue(event.target.value))} />
              {planView === '3d' ? (
                <PlanCanvas3D
                  data={form}
                  rotation={planRotation}
                  zoom={planZoom}
                  planHelpers={planHelpers}
                  numberValue={numberValue}
                />
              ) : (
                <div
                  className="svg-preview"
                  dangerouslySetInnerHTML={{ __html: planView === 'svg3d' ? PlanEngine.planSvg3d(form, planHelpers) : PlanEngine.planSvg(form, planHelpers) }}
                />
              )}
            </article>
          </section>
        )}

        {false && (
        <section className="panel type-admin">
          <div className="section-head">
            <div>
              <h2>Tipos de trabajo</h2>
              <p>Catálogo interno de tipos por giro.</p>
            </div>
            <button type="button" className="ghost" onClick={addTypeDetail}>Agregar tipo</button>
          </div>
          <div className="table-list">
            {typeDetails.map((item) => (
              <article key={item.id} className="catalog-row">
                <select value={item.giro} onChange={(event) => updateTypeDetail(item.id, 'giro', event.target.value)}>
                  <option>Carpintería</option>
                  <option>Vidriería</option>
                </select>
                <input value={item.tipo} onChange={(event) => updateTypeDetail(item.id, 'tipo', event.target.value)} aria-label="Tipo" />
                <input value={item.descripcion} onChange={(event) => updateTypeDetail(item.id, 'descripcion', event.target.value)} aria-label="Descripción" />
                <button type="button" className="ghost" onClick={() => removeTypeDetail(item.id)}><Eraser size={16} /></button>
              </article>
            ))}
          </div>
        </section>
        )}

        </section>
        <footer className="footer-bar">
          <span>Calidad de datos: {score}/12</span>
          {copied && <strong>{copied}</strong>}
        </footer>
      </section>
        )}
        inspector={(
          <InspectorPanel
            form={form}
            quote={quote}
            dataHealth={dataHealth}
            materials={materials}
            money={money}
            decimal={decimal}
            openPrint={openPrint}
            openWhatsApp={openWhatsApp}
            setActiveSection={setActiveSection}
          />
        )}
      />
      </main>
      )}
    </AuthGate>
  );
}

export default App;
