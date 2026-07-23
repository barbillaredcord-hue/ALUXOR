// cSpell:words ALUXOR AnunciaPro anunciapro aluxor Clóset clóset clósets Cotizacion cotizacion Telefono telefono whatsapp promocion jaladera Jaladera jaladeras Jaladeras tornillería Silicón categoria bano economico descripcion triplay Triplay buro buró Buró burós pzas Vidrieria Carpinteria zoclo herrajes melamina merma cotizador metalnes
import { useMemo, useRef, useState } from 'react';
import {
  Accessibility,
  Box,
  ClipboardList,
  Eraser,
  FileText,
  History,
  MessageCircle,
  RefreshCw,
  Ruler,
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
import { canAccessSection, canManagePurchasing } from '../lib/workspace/permissions.js';
import {
  getPurchaseMaterialState,
  getQuoteDisplayStatus,
} from '../lib/workflow/projectStatus.js';
import { isProjectReadOnly } from '../lib/production/productionEngine.js';
import { productionOrderMatchesQuote } from '../lib/quotes/quoteReference.js';
import useAuth from '../hooks/useAuth.js';
import useWorkspace from '../hooks/useWorkspace.js';
import useQuotes from '../hooks/useQuotes.js';
import useProduction from '../hooks/useProduction.js';
import usePurchases from '../hooks/usePurchases.js';
import useQuickCalculator from '../hooks/useQuickCalculator.js';
import usePlanEditor from '../hooks/usePlanEditor.js';
import useCatalog from '../hooks/useCatalog.js';
import useNavigation from '../hooks/useNavigation.js';
import {
  buildEmptyPurchaseSummary,
  resolveProductionOrderSummary,
  resolvePurchaseSummary,
} from './productionOrderSummary.js';
import {
  Materials,
  Pricing,
  Quote,
  StorageEngine,
  PlanEngine,
} from '../lib/br-engine/index.js';

import {
  APP_VERSION,
  BRAND_NAME,
} from './config/constants.js';
import {
  catalogDefaults,
  defaultTypeDetails,
  formasPlano,
  plantillasPlano,
  quoteProfiles,
  tonos,
} from './config/data.js';
import { guideFor } from './config/guides.js';
import {
  clean,
  decimal,
  formatDimensions,
  money,
  normalizeCatalogItem,
  numberValue,
  percentValue,
  planHelpers,
  positiveNumber,
  quoteHelpers,
  refreshInstalledApp,
  typeOptionsFor,
} from './config/helpers.js';
export function startNewQuoteAndClearProductionSelection(
  startNewQuote,
  setSelectedProductionOrderId,
) {
  const started = startNewQuote();
  if (!started) return false;
  setSelectedProductionOrderId(null);
  return true;
}

export function getHistorySectionReadOnly(canEditWorkspaceQuotes) {
  return !canEditWorkspaceQuotes;
}

function App() {
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [floatingSummary, setFloatingSummary] = useState({ x: 24, y: 120, compact: false, minimized: false });
  const authWorkspaceRefreshRef = useRef(null);
  const catalogHydrationRef = useRef({
    setCatalog: () => {},
    setTypeDetails: () => {},
  });
  const productionQuoteSyncRef = useRef(null);
  const productionQuoteNoteSyncRef = useRef(null);
  const quoteDeletionRefreshRef = useRef(null);
  const projectProductionRef = useRef({ active: null, orders: [] });
  const {
    authSession,
    authLoading,
    signOutLoading,
    handleSignOut,
  } = useAuth({
    refreshWorkspace: (options) => authWorkspaceRefreshRef.current?.(options),
  });
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
    setCatalog: (...args) => catalogHydrationRef.current.setCatalog(...args),
    setTypeDetails: (...args) => catalogHydrationRef.current.setTypeDetails(...args),
    StorageEngine,
    getActiveProductionOrder: () => projectProductionRef.current.active,
  });
  authWorkspaceRefreshRef.current = refreshWorkspace;
  const {
    form,
    setForm,
    history,
    activeQuoteIdentity,
    selectedHistoryPreview,
    setSelectedHistoryPreview,
    syncStatus,
    setSyncStatus,
    lastSyncAt,
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
    saveToHistory,
    syncHistory,
    loadHistoryItem,
    openQuoteFromProduction,
    startNewQuote,
    removeHistoryItem,
    exportHistoryBackup,
    importHistoryBackup,
    updateHistoryStatus,
    copyText,
    openWhatsApp,
    openPrint,
    generateProfessionalPdf,
    handleQuoteFieldFocus,
    handleQuoteFieldBlur,
    syncQuoteNoteFromProduction,
  } = useQuotes({
    authSession,
    activeWorkspace,
    workspaceAccessStatus,
    activeSection,
    setActiveSection,
    appLogo,
    workspaceSettings,
    syncProductionOrderFromQuote: (...args) => (
      productionQuoteSyncRef.current?.(...args)
    ),
    onQuoteDeleteCommitted: (...args) => quoteDeletionRefreshRef.current?.(...args),
    getActiveProductionOrder: () => projectProductionRef.current.active,
    isQuoteReadOnly: (quoteRecord) => projectProductionRef.current.orders.some((order) => (
      isProjectReadOnly(order) && productionOrderMatchesQuote(order, quoteRecord)
    )),
  });
  productionQuoteNoteSyncRef.current = syncQuoteNoteFromProduction;
  const setProjectForm = (updater) => {
    if (isProjectReadOnly(projectProductionRef.current.active)) return false;
    setForm(updater);
    return true;
  };
  const {
    catalog,
    setCatalog,
    typeDetails,
    setTypeDetails,
    currentTypeOptions,
    addTypeDetail,
    updateTypeDetail,
    removeTypeDetail,
    updateCatalogItem,
    addCatalogItem,
    removeCatalogItem,
    applyCatalogItem,
  } = useCatalog({
    form,
    setForm: setProjectForm,
    setActiveSection,
    activeWorkspace,
    hydratedWorkspaceId,
    catalogDefaults,
    defaultTypeDetails,
    StorageEngine,
    normalizeCatalogItem,
    numberValue,
    formatDimensions,
    typeOptionsFor,
  });
  catalogHydrationRef.current = {
    setCatalog,
    setTypeDetails,
  };
  const quickCalculator = useQuickCalculator({
    form,
    setForm: setProjectForm,
    quote,
    Quote,
    Materials,
    Pricing,
    helpers: {
      clean,
      decimal,
      formatDimensions,
      money,
      numberValue,
      percentValue,
      positiveNumber,
      quoteHelpers,
    },
  });
  const {
    quickCalc,
    quickAreaPorPieza,
    quickCostoM2,
    quickCostoLineal,
    quickPricing,
    quickHojasComprar,
    quickPiezasComprar,
    quickCompraSinMerma,
    quickCompraConMerma,
    quickTotalClienteSinMargen,
    quickTotalClienteConMargen,
    quickProfit,
    quickProfitPercent,
    updateQuickCalc,
    quickCalcText,
    applyQuickCalcToMaterial,
  } = quickCalculator;
  const planEditor = usePlanEditor({
    setForm: setProjectForm,
    setActiveSection,
    updateDirtyQuoteForm,
    PlanEngine,
    planHelpers,
    numberValue,
  });
  const {
    planView,
    setPlanView,
    planRotation,
    setPlanRotation,
    planZoom,
    setPlanZoom,
    updatePlanItem,
    addPlanItem,
    removePlanItem,
    syncPlanWithMeasures,
    applyPlanTemplate,
  } = planEditor;
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
    syncQuoteNoteFromProduction: (...args) => (
      productionQuoteNoteSyncRef.current?.(...args)
    ),
  });
  projectProductionRef.current = {
    active: activeProductionOrder,
    orders: productionOrders,
  };
  productionQuoteSyncRef.current = syncProductionOrderFromQuote;
  const {
    purchases,
    activePurchase,
    selectedPurchaseId,
    purchasesLoading,
    purchasesError,
    purchasesSyncStatus,
    setSelectedPurchaseId,
    openPurchase,
    createPurchase,
    updatePurchase,
    updatePurchaseItem,
    flushPurchaseSave,
    purchaseStatusForOrder,
    purchasesForOrder,
    refreshPurchases,
  } = usePurchases({
    authSession,
    activeWorkspace,
    workspaceAccessStatus,
    setActiveSection,
    productionOrders,
  });
  const canEditPurchases = canManagePurchasing(currentWorkspaceRole);
  const activeProductionPurchases = useMemo(() => (
    activeProductionOrder
      ? purchases.filter((purchase) => (
        purchase.productionOrderId === activeProductionOrder.id
        || purchase.production_order_id === activeProductionOrder.id
      ))
      : []
  ), [activeProductionOrder, purchases]);
  const activePurchaseMaterialState = useMemo(() => getPurchaseMaterialState(
    activeProductionPurchases,
    activeProductionOrder,
  ), [activeProductionOrder, activeProductionPurchases]);
  const quoteDisplayStatus = useMemo(() => getQuoteDisplayStatus(
    form,
    activeProductionOrder,
    activePurchaseMaterialState,
  ), [activeProductionOrder, activePurchaseMaterialState, form]);
  const quoteStatusLocked = Boolean(activeProductionOrder);
  const projectReadOnly = isProjectReadOnly(activeProductionOrder);
  const contextualProjectSummary = useMemo(() => ({
    ...contextualQuoteSummary,
    estado: quoteDisplayStatus,
  }), [contextualQuoteSummary, quoteDisplayStatus]);

  const productionSummarySelection = useMemo(() => resolveProductionOrderSummary(
    productionOrders,
    selectedProductionOrderId,
    history,
  ), [history, productionOrders, selectedProductionOrderId]);
  const selectedProductionOrder = productionSummarySelection.order;
  const purchaseSummarySelection = useMemo(() => resolvePurchaseSummary(
    purchases,
    selectedPurchaseId,
    productionOrders,
    history,
  ), [history, productionOrders, purchases, selectedPurchaseId]);
  const emptyPurchaseSummary = useMemo(() => buildEmptyPurchaseSummary(), []);
  const summaryPanelSource = useMemo(() => (
    activeSection === 'produccion' && productionSummarySelection.summary
      ? productionSummarySelection.summary
      : activeSection === 'compras'
        ? purchaseSummarySelection.summary || emptyPurchaseSummary
        : contextualProjectSummary
  ), [
    activeSection,
    contextualProjectSummary,
    emptyPurchaseSummary,
    purchaseSummarySelection,
    productionSummarySelection,
  ]);

  quoteDeletionRefreshRef.current = () => {
    void refreshProduction();
    void refreshPurchases();
  };

  function handleSelectProductionOrder(orderId) {
    setSelectedProductionOrderId(orderId);
  }

  function handleStartNewQuote() {
    startNewQuoteAndClearProductionSelection(
      startNewQuote,
      setSelectedProductionOrderId,
    );
  }
  const {
    menuItems,
  } = useNavigation({
    activeSection,
    setActiveSection,
    currentWorkspaceRole,
    canManageWorkspaceAccess,
  });

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

  const input = (field, type = 'text') => (
    <input
      id={field}
      data-quote-field={field}
      data-quote-conflict={quoteFieldConflicts.includes(field) ? 'true' : undefined}
      type={type}
      value={form[field] ?? ''}
      readOnly={projectReadOnly}
      onChange={(event) => update(field, type === 'number' ? numberValue(event.target.value) : event.target.value)}
    />
  );

  const textareaInput = (field) => (
    <textarea
      id={field}
      data-quote-field={field}
      data-quote-conflict={quoteFieldConflicts.includes(field) ? 'true' : undefined}
      value={form[field] ?? ''}
      readOnly={projectReadOnly}
      onChange={(event) => update(field, event.target.value)}
    />
  );

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
          <img
            src={appLogo || '/branding/br-logo-horizontal.png'}
            alt="ALUXOR / BosqueReal · Cotizador profesional"
            className={appLogo ? 'brand-logo' : 'brand-logo brand-logo-official'}
          />
          {appLogo && (
            <div>
              <strong>{workspaceSettings?.company_name || BRAND_NAME}</strong>
              <span>Cotizador profesional</span>
            </div>
          )}
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
          key={activeSection === 'produccion'
            ? selectedProductionOrderId
            : activeSection === 'compras' ? selectedPurchaseId : 'quote-summary'}
          proyecto={summaryPanelSource.nombre}
          descripcion={summaryPanelSource.descripcion}
          totalCliente={money(summaryPanelSource.quote.total)}
          costoInterno={money(summaryPanelSource.quote.internalTotal)}
          utilidad={money(summaryPanelSource.quote.profit)}
          anticipo={money(summaryPanelSource.quote.deposit)}
          saldo={money(summaryPanelSource.quote.rest)}
          estadoProyecto={summaryPanelSource.estado}
          riesgos={summaryPanelSource.riesgos}
          indicadores={summaryPanelSource.indicadores}
          progreso={summaryPanelSource.progreso}
          onWhatsApp={openWhatsApp}
          onPdf={() => openPrint('client')}
          onGuardar={saveToHistory}
          onHistorial={() => setActiveSection('historial')}
          canSave={canEditWorkspaceQuotes && !projectReadOnly}
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
              <span>{projectReadOnly ? 'Proyecto entregado · Solo lectura' : quoteDisplayStatus}</span>
            </div>

            <div className="hero-brand-line hero-title-row">
              <img
                src={appLogo || '/branding/br-logo-horizontal.png'}
                alt="ALUXOR / BosqueReal · Cotizador profesional"
                className={appLogo ? 'hero-logo' : 'hero-logo hero-logo-official'}
              />
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
              <button type="button" className="ghost" onClick={handleStartNewQuote}><History size={16} /> Nueva cotización</button>
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
            projectStatus={quoteDisplayStatus}
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
            onOpenProduction={(purchase) => {
              setSelectedProductionOrderId(purchase.productionOrderId || null);
              setActiveSection('produccion');
            }}
            onOpenReceiving={() => setActiveSection('recepcion')}
            onOpenInventory={() => setActiveSection('inventario')}
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
            readOnly={projectReadOnly}
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
            quoteDisplayStatus={quoteDisplayStatus}
            quoteStatusLocked={quoteStatusLocked}
            readOnly={projectReadOnly}
            onOpenProduction={() => {
              if (activeProductionOrder) setSelectedProductionOrderId(activeProductionOrder.id);
              setActiveSection('produccion');
            }}
            onCancelProject={() => update('estadoCotizacion', 'Cancelada')}
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
                      readOnly={projectReadOnly}
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
                      readOnly={projectReadOnly}
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
            readOnly={projectReadOnly}
          />
        )}

        {activeSection === 'produccion' && (
          <ProductionSection
            productionOrders={productionOrders}
            selectedProductionOrderId={selectedProductionOrderId}
            onSelectProductionOrder={handleSelectProductionOrder}
            onOpenQuote={openQuoteFromProduction}
            onUpdateProductionOrder={handleUpdateProductionOrder}
            onCreatePurchase={createPurchase}
            onOpenPurchase={openPurchase}
            purchaseStatusForOrder={purchaseStatusForOrder}
            purchasesForOrder={purchasesForOrder}
            canManagePurchases={canEditPurchases}
            productionLoading={productionLoading}
            productionError={productionError}
            productionSyncStatus={productionSyncStatus}
          />
        )}

        {activeSection === 'compras' && (
          <PurchasesSection
            purchases={purchases}
            productionOrders={productionOrders}
            quotes={history}
            workspaceId={activeWorkspace?.id}
            activePurchase={activePurchase}
            selectedPurchaseId={selectedPurchaseId}
            setSelectedPurchaseId={setSelectedPurchaseId}
            updatePurchase={updatePurchase}
            updatePurchaseItem={updatePurchaseItem}
            flushPurchaseSave={flushPurchaseSave}
            purchasesLoading={purchasesLoading}
            purchasesError={purchasesError}
            purchasesSyncStatus={purchasesSyncStatus}
            canManage={canEditPurchases}
            money={money}
            decimal={decimal}
          />
        )}

        {activeSection === 'recepcion' && (
          <ReceivingSection
            form={form}
            quote={quote}
            decimal={decimal}
            readOnly={projectReadOnly}
          />
        )}

        {activeSection === 'inventario' && (
          <InventorySection
            form={form}
            quote={quote}
            money={money}
            decimal={decimal}
            readOnly={projectReadOnly}
          />
        )}

        {activeSection === 'fabricacion' && (
          <FabricationSection
            form={form}
            quote={quote}
            decimal={decimal}
            projectStatus={quoteDisplayStatus}
            readOnly={projectReadOnly}
          />
        )}

        {activeSection === 'corte' && (
          <CutOptimizerSection
            quote={quote}
            decimal={decimal}
            readOnly={projectReadOnly}
          />
        )}

        {activeSection === 'ajustes' && (
          <SettingsSection
            appLogo={appLogo}
            settings={workspaceSettings}
            canManage={canEditWorkspaceSettings && !projectReadOnly}
            isOwner={currentWorkspaceRole === 'owner'}
            saving={workspaceSettingsSaving}
            error={workspaceSettingsError}
            onSaveCompanyName={saveWorkspaceCompanyName}
            onLogoUpload={handleLogoUpload}
            onRemoveLogo={removeAppLogo}
            activeProductionOrder={activeProductionOrder}
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
            readOnly={getHistorySectionReadOnly(canEditWorkspaceQuotes)}
            productionOrders={productionOrders}
            purchases={purchases}
            onOpenProduction={(order) => {
              setSelectedProductionOrderId(order.id);
              setActiveSection('produccion');
            }}
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
                {!projectReadOnly && <button type="button" className="ghost" onClick={syncPlanWithMeasures}><Ruler size={18} /> Usar medidas</button>}
              </div>
              <div className="actions compact">
                {plantillasPlano.map((template) => (
                  <button key={template.id} type="button" className="ghost" disabled={projectReadOnly} onClick={() => applyPlanTemplate(template)}>{template.label}</button>
                ))}
              </div>
              {PlanEngine.planItemsFromForm(form, planHelpers).map((item) => (
                <div key={item.id} className="row-card plan-row">
                  <input readOnly={projectReadOnly} value={item.nombre} onChange={(event) => updatePlanItem(item.id, 'nombre', event.target.value)} aria-label="Nombre de pieza" />
                  <select disabled={projectReadOnly} value={item.forma} onChange={(event) => updatePlanItem(item.id, 'forma', event.target.value)} aria-label="Forma">
                    {formasPlano.map((forma) => <option key={forma}>{forma}</option>)}
                  </select>
                  <input readOnly={projectReadOnly} type="number" value={item.ancho} onChange={(event) => updatePlanItem(item.id, 'ancho', numberValue(event.target.value))} aria-label="Ancho" />
                  <input readOnly={projectReadOnly} type="number" value={item.alto} onChange={(event) => updatePlanItem(item.id, 'alto', numberValue(event.target.value))} aria-label="Alto" />
                  <input readOnly={projectReadOnly} type="number" value={item.fondo} onChange={(event) => updatePlanItem(item.id, 'fondo', numberValue(event.target.value))} aria-label="Fondo" />
                  {!projectReadOnly && <button type="button" className="ghost" onClick={() => removePlanItem(item.id)}><Eraser size={16} /></button>}
                </div>
              ))}
              {!projectReadOnly && <button type="button" className="ghost" onClick={addPlanItem}>Agregar pieza</button>}
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
            readOnly={projectReadOnly}
          />
        )}
      />
      </main>
      )}
    </AuthGate>
  );
}

export default App;
