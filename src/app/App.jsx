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
import useQuotes from '../hooks/useQuotes.js';
import useProduction from '../hooks/useProduction.js';
import useQuickCalculator from '../hooks/useQuickCalculator.js';
import usePlanEditor from '../hooks/usePlanEditor.js';
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

function App() {
  const [authSession, setAuthSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [catalog, setCatalog] = useState(catalogDefaults);
  const [largeText, setLargeText] = useState(false);
  const [activeSection, setActiveSection] = useState('inicio');
  const [typeDetails, setTypeDetails] = useState(defaultTypeDetails);
  const [floatingSummary, setFloatingSummary] = useState({ x: 24, y: 120, compact: false, minimized: false });
  const productionQuoteSyncRef = useRef(null);
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
    setCatalog,
    setTypeDetails,
    StorageEngine,
  });
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
  });
  const quickCalculator = useQuickCalculator({
    form,
    setForm,
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
    setForm,
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
  });
  productionQuoteSyncRef.current = syncProductionOrderFromQuote;

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

  const currentTypeOptions = typeOptionsFor(form.giro, typeDetails);
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
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveTypeDetails(typeDetails);
  }, [activeWorkspace?.id, hydratedWorkspaceId, typeDetails]);

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
