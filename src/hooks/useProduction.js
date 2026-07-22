import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PRODUCTION_STATUSES,
  canAdvanceProductionOrder,
  createProductionOrder as createProductionOrderEngine,
  updateProductionOrder as updateProductionOrderEngine,
} from '../lib/production/productionEngine.js';
import { ProductionStorage } from '../lib/production/productionStorage.js';
import { ProductionOrderRepository } from '../lib/production/productionOrderRepository.js';
import { QuoteAdapter } from '../lib/quotes/quoteAdapter.js';
import {
  normalizeSharedProjectNote,
  productionOrderMatchesQuote,
  resolveSharedProjectNote,
} from '../lib/quotes/quoteReference.js';
import { clean, isRemoteQuoteId } from '../app/config/helpers.js';

export function productionChangesWithSharedNote(currentOrder, changes, updatedAt) {
  if (!Object.prototype.hasOwnProperty.call(changes || {}, 'observaciones')) {
    return changes || {};
  }

  const resolution = resolveSharedProjectNote({
    quoteNote: currentOrder?.formSnapshot?.notasInternas,
    productionNote: changes.observaciones,
    quoteUpdatedAt: currentOrder?.quoteUpdatedAt,
    productionUpdatedAt: updatedAt,
    preferredSource: 'production',
  });
  const formSnapshot = {
    ...(currentOrder?.formSnapshot || {}),
    ...(changes?.formSnapshot || {}),
    notasInternas: resolution.value,
  };

  return { ...changes, observaciones: resolution.value, formSnapshot };
}

export function productionOrderNoteFromQuote(form) {
  return normalizeSharedProjectNote(form?.notasInternas);
}

export function quoteDeletionProductionChanges(order, hasRelatedActivity, now, userId) {
  const reason = 'Cotización original eliminada';
  const timestamp = new Date(now).toISOString();
  const timeline = [...(Array.isArray(order?.timeline) ? order.timeline : []), {
    evento: hasRelatedActivity ? 'Orden rechazada' : 'Orden desactivada',
    fecha: timestamp,
    usuario: userId || '',
    comentario: reason,
  }];
  return {
    ...(hasRelatedActivity ? { estado: PRODUCTION_STATUSES.REJECTED } : { deletedAt: timestamp }),
    observaciones: order?.observaciones?.includes(reason)
      ? order.observaciones
      : [order?.observaciones, reason].filter(Boolean).join(' · '),
    timeline,
  };
}

export function productionQuoteDeletionApplied(order) {
  return Boolean(
    order?.deletedAt
    || (
      order?.estado === PRODUCTION_STATUSES.REJECTED
      && order?.observaciones?.includes('Cotización original eliminada')
    )
  );
}

export default function useProduction({
  authSession,
  activeWorkspace,
  workspaceAccessStatus,
  activeQuoteIdentity,
  form,
  setSyncStatus,
  setActiveSection,
  syncQuoteNoteFromProduction,
}) {
  const [productionOrders, setProductionOrders] = useState([]);
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState(null);
  const [productionLoading, setProductionLoading] = useState(false);
  const [productionError, setProductionError] = useState('');
  const [productionSyncStatus, setProductionSyncStatus] = useState('Producción local');
  const productionOrdersRef = useRef(productionOrders);
  const productionRemoteRequestRef = useRef({ id: 0, inFlight: false, pending: false });
  const productionMigrationRef = useRef(null);
  const productionSyncRef = useRef(false);
  const productionCreateInFlightRef = useRef(false);
  const productionContextRef = useRef({ userId: null, workspaceId: null });

  productionContextRef.current = {
    userId: authSession?.user?.id || null,
    workspaceId: activeWorkspace?.id || null,
  };

  const activeProductionOrder = useMemo(
    () => productionOrders.find((order) => (
      order.workspaceId === activeWorkspace?.id
      && order.quoteId === activeQuoteIdentity?.id
    )) || null,
    [productionOrders, activeQuoteIdentity?.id, activeWorkspace?.id]
  );
  const activeQuoteStatus = QuoteAdapter.normalizeQuoteStatus(form.estadoCotizacion);
  const canGenerateProductionOrder = Boolean(
    activeWorkspace?.id
    && authSession?.user?.id
    && activeQuoteIdentity?.remote
    && isRemoteQuoteId(activeQuoteIdentity.id)
    && Number(activeQuoteIdentity.version) >= 1
    && quoteCanGenerateProduction(activeQuoteStatus)
  );

  useEffect(() => {
    productionOrdersRef.current = productionOrders;
  }, [productionOrders]);
  function setActiveProductionOrders(workspaceId, orders) {
    const cache = ProductionStorage.replaceWorkspaceProductionOrders(workspaceId, orders);
    const activeOrders = cache.filter((order) => (
      order.workspaceId === workspaceId && !order.deletedAt
    ));

    productionOrdersRef.current = activeOrders;
    setProductionOrders(activeOrders);
    setSelectedProductionOrderId((current) => (
      current && activeOrders.some((order) => order.id === current) ? current : null
    ));
  }

  function upsertActiveProductionOrder(order) {
    const saved = ProductionStorage.upsertProductionOrder(order);
    if (!saved) return null;

    const activeOrders = ProductionStorage.loadProductionOrders()
      .filter((item) => item.workspaceId === saved.workspaceId && !item.deletedAt);
    productionOrdersRef.current = activeOrders;
    setProductionOrders(activeOrders);
    return saved;
  }

  async function loadRemoteProductionOrders() {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    if (!userId || !workspaceId) return;

    if (productionRemoteRequestRef.current.inFlight) {
      productionRemoteRequestRef.current = {
        ...productionRemoteRequestRef.current,
        pending: true,
      };
      return;
    }

    const requestId = productionRemoteRequestRef.current.id + 1;
    productionRemoteRequestRef.current = { id: requestId, inFlight: true, pending: false };
    setProductionLoading(true);

    try {
      const { data, error } = await ProductionOrderRepository.loadProductionOrders(workspaceId);
      const currentContext = productionContextRef.current;

      if (
        requestId !== productionRemoteRequestRef.current.id
        || currentContext.userId !== userId
        || currentContext.workspaceId !== workspaceId
      ) return;

      if (error) {
        setProductionError('No se pudieron cargar las órdenes en nube. Mostrando copia local.');
        return;
      }

      const pendingLocalOrders = ProductionStorage.findLocalProductionOrders(workspaceId);
      const pendingUpdatedOrders = ProductionStorage.findPendingProductionOrders(workspaceId);
      setActiveProductionOrders(workspaceId, [
        ...(Array.isArray(data) ? data : []),
        ...pendingLocalOrders,
        ...pendingUpdatedOrders,
      ]);
      setProductionError('');
    } catch {
      if (requestId === productionRemoteRequestRef.current.id) {
        setProductionError('No se pudieron cargar las órdenes en nube. Mostrando copia local.');
      }
    } finally {
      if (requestId !== productionRemoteRequestRef.current.id) return;

      const shouldReload = productionRemoteRequestRef.current.pending;
      productionRemoteRequestRef.current = {
        id: requestId,
        inFlight: false,
        pending: false,
      };
      setProductionLoading(false);

      if (shouldReload) void loadRemoteProductionOrders();
    }
  }

  async function syncPendingProductionOrders(workspaceId, userId) {
    if (!workspaceId || !userId || productionSyncRef.current) return;

    const pendingOrders =
      ProductionStorage.findPendingProductionOrders(workspaceId);

    if (pendingOrders.length === 0) return;

    productionSyncRef.current = true;
    let syncFailed = false;

    try {
      for (const pendingOrder of pendingOrders) {
        const currentContext = productionContextRef.current;

        if (
          currentContext.userId !== userId
          || currentContext.workspaceId !== workspaceId
        ) {
          return;
        }

        const result =
          await ProductionOrderRepository.updateProductionOrderRemote(
            workspaceId,
            pendingOrder.id,
            pendingOrder,
            pendingOrder.pendingExpectedVersion || pendingOrder.version
          );

        if (
          result.error?.code
          === 'PRODUCTION_ORDER_VERSION_CONFLICT'
        ) {
          const remote =
            await ProductionOrderRepository.getProductionOrder(
              workspaceId,
              pendingOrder.id
            );

          if (remote.data && !remote.error) {
            upsertActiveProductionOrder(remote.data);

            setProductionError(
              'La orden fue modificada en otro dispositivo. Se cargó la versión remota.'
            );

            setProductionSyncStatus(
              'Conflicto de producción · versión remota cargada'
            );
          } else if (pendingOrder.deletedAt && !remote.data) {
            ProductionStorage.removeProductionOrder(pendingOrder.id);
            setActiveProductionOrders(
              workspaceId,
              ProductionStorage.loadProductionOrders().filter((order) => (
                order.workspaceId === workspaceId
              )),
            );
          } else {
            syncFailed = true;
          }

          continue;
        }

        if (result.error || !result.data) {
          syncFailed = true;
          continue;
        }

        if (
          productionContextRef.current.workspaceId
          !== workspaceId
        ) {
          return;
        }

        const latestLocalOrder =
          ProductionStorage.loadProductionOrders().find(
            (order) => (
              order.workspaceId === workspaceId
              && order.id === pendingOrder.id
            )
          );

        if (
          latestLocalOrder?.pendingSync
          && latestLocalOrder.updatedAt
            !== pendingOrder.updatedAt
        ) {
          upsertActiveProductionOrder({
            ...latestLocalOrder,
            version: result.data.version,
            pendingExpectedVersion: result.data.version,
          });

          syncFailed = true;
          continue;
        }

        upsertActiveProductionOrder(result.data);
      }

      if (syncFailed) {
        setProductionError(
          'Cambios locales pendientes de sincronizar.'
        );
      } else {
        setProductionError('');
        setProductionSyncStatus(
          'Cambios de producción sincronizados'
        );
      }
    } finally {
      productionSyncRef.current = false;
    }
  }

  async function migrateLocalProductionOrders(workspaceId, userId) {
    if (!workspaceId || !userId || productionMigrationRef.current === workspaceId) return;

    if (!navigator.onLine) {
      setProductionError('No se pudieron cargar las órdenes en nube. Mostrando copia local.');
      setProductionSyncStatus('No se pudieron cargar las órdenes en nube. Mostrando copia local.');
      return;
    }

    productionMigrationRef.current = workspaceId;
    let migrationFailed = false;

    try {
      const migrationKey = `aluxor.productionOrders.cloudMigration.${workspaceId}`;
      const localOrders = ProductionStorage.findLocalProductionOrders(workspaceId);
      let migrationCompleted = false;

      try {
        migrationCompleted = window.localStorage.getItem(migrationKey) === 'true';
      } catch {
        migrationCompleted = false;
      }

      if (migrationCompleted && localOrders.length === 0) {
        await loadRemoteProductionOrders();
        return;
      }

      for (const localOrder of localOrders) {
        const currentContext = productionContextRef.current;
        if (currentContext.userId !== userId || currentContext.workspaceId !== workspaceId) return;

        const existing = await ProductionOrderRepository.getProductionOrderByQuoteId(
          workspaceId,
          localOrder.quoteId
        );

        if (existing.error) {
          migrationFailed = true;
          continue;
        }

        const result = existing.data
          ? { data: existing.data, error: null }
          : await ProductionOrderRepository.createProductionOrderRemote(
            workspaceId,
            localOrder
          );

        if (result.error || !result.data) {
          migrationFailed = true;
          continue;
        }

        ProductionStorage.replaceProductionOrder(localOrder.id, result.data);
        setSelectedProductionOrderId((current) => (
          current === localOrder.id ? result.data.id : current
        ));
      }

      const remaining = ProductionStorage.findLocalProductionOrders(workspaceId);
      if (!migrationFailed && remaining.length === 0) {
        try {
          window.localStorage.setItem(migrationKey, 'true');
        } catch {
          // La marca es una optimización; la migración continúa siendo idempotente.
        }
      }

      await loadRemoteProductionOrders();
      if (migrationFailed) {
        setProductionError('Algunas órdenes locales siguen pendientes de migración.');
      }
    } finally {
      if (productionMigrationRef.current === workspaceId) {
        productionMigrationRef.current = null;
      }
    }
  }

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;

    productionRemoteRequestRef.current = {
      id: productionRemoteRequestRef.current.id + 1,
      inFlight: false,
      pending: false,
    };

    if (!userId || !workspaceId) {
      if (['suspended', 'revoked'].includes(workspaceAccessStatus)) {
        ProductionStorage.saveProductionOrders([]);
      }
      productionOrdersRef.current = [];
      setProductionOrders([]);
      setSelectedProductionOrderId(null);
      setProductionLoading(false);
      setProductionError('');
      setProductionSyncStatus('Producción local');
      return undefined;
    }

    const cachedOrders = ProductionStorage.loadProductionOrders()
      .filter((order) => order.workspaceId === workspaceId && !order.deletedAt);
    productionOrdersRef.current = cachedOrders;
    setProductionOrders(cachedOrders);
    setSelectedProductionOrderId((current) => (
      current && cachedOrders.some((order) => order.id === current) ? current : null
    ));

    const refreshProductionOrders = async () => {
      if (!navigator.onLine) {
        setProductionLoading(false);
        setProductionError('No se pudieron cargar las órdenes en nube. Mostrando copia local.');
        return;
      }

      await syncPendingProductionOrders(workspaceId, userId);
      await migrateLocalProductionOrders(workspaceId, userId);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshProductionOrders();
    };

    void refreshProductionOrders();
    window.addEventListener('focus', refreshProductionOrders);
    window.addEventListener('online', refreshProductionOrders);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      productionRemoteRequestRef.current = {
        id: productionRemoteRequestRef.current.id + 1,
        inFlight: false,
        pending: false,
      };
      window.removeEventListener('focus', refreshProductionOrders);
      window.removeEventListener('online', refreshProductionOrders);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [authSession?.user?.id, activeWorkspace?.id, workspaceAccessStatus]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;
    if (!userId || !workspaceId) return undefined;

    let debounceId = null;
    let subscriptionActive = true;
    const unsubscribe = ProductionOrderRepository.subscribeProductionOrders(
      workspaceId,
      () => {
        if (debounceId !== null) window.clearTimeout(debounceId);
        debounceId = window.setTimeout(() => {
          debounceId = null;
          void loadRemoteProductionOrders();
        }, 300);
      },
      (status, error) => {
        if (!subscriptionActive) return;

        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
          console.warn('Realtime de producción no disponible:', status, error);
          setProductionSyncStatus('Realtime de producción no disponible');
          return;
        }

        if (status === 'CLOSED') {
          setProductionSyncStatus('Realtime de producción cerrado');
          return;
        }

        if (status === 'SUBSCRIBED') {
          setProductionSyncStatus((current) => (
            current.startsWith('Realtime de producción')
              ? 'Producción conectada'
              : current
          ));
        }
      }
    );

    return () => {
      subscriptionActive = false;
      if (debounceId !== null) window.clearTimeout(debounceId);
      unsubscribe();
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);
function syncProductionOrderFromQuote(
  quoteId,
  nextForm,
  quoteVersion,
  quoteUpdatedAt,
  quoteRecord = null,
) {
  if (!quoteId || !nextForm) return;

  const currentOrder = productionOrdersRef.current.find((order) => (
    order.workspaceId === activeWorkspace?.id
    && productionOrderMatchesQuote(order, quoteRecord || { id: quoteId })
  ));

  if (!currentOrder) return;
  if (!canAdvanceProductionOrder(currentOrder)) return;

  const noteResolution = resolveSharedProjectNote({
    quoteNote: nextForm.notasInternas,
    productionNote: currentOrder.observaciones,
    quoteUpdatedAt,
    productionUpdatedAt: currentOrder.updatedAt,
    preferredSource: 'quote',
  });

  if (noteResolution.quoteNeedsUpdate) {
    void syncQuoteNoteFromProduction?.(currentOrder);
  }

  const nextSnapshot = {
    ...nextForm,
    notasInternas: noteResolution.value,
  };

  const nextChanges = {
    cliente: clean(nextForm.clienteNombre),
    producto: clean(nextForm.producto),
    fechaCompromiso: nextForm.entrega || '',
    observaciones: noteResolution.value,
    formSnapshot: nextSnapshot,
    quoteUpdatedAt: quoteUpdatedAt || currentOrder.quoteUpdatedAt,
    quoteVersion:
      Number.isInteger(Number(quoteVersion))
      && Number(quoteVersion) >= 1
        ? Number(quoteVersion)
        : currentOrder.quoteVersion,
  };

  const hasChanges =
    currentOrder.cliente !== nextChanges.cliente
    || currentOrder.producto !== nextChanges.producto
    || currentOrder.fechaCompromiso !== nextChanges.fechaCompromiso
    || currentOrder.observaciones !== nextChanges.observaciones
    || currentOrder.quoteVersion !== nextChanges.quoteVersion
    || JSON.stringify(currentOrder.formSnapshot || {})
      !== JSON.stringify(nextChanges.formSnapshot || {});

  if (!hasChanges) return;

  void handleUpdateProductionOrder(
    currentOrder.id,
    nextChanges
  );
}

  async function handleUpdateProductionOrder(orderId, changes, options = {}) {
    const workspaceId = activeWorkspace?.id;
    const userId = authSession?.user?.id;
    const currentOrder = productionOrdersRef.current.find((order) => order.id === orderId);

    if (!workspaceId || !userId || !currentOrder || currentOrder.workspaceId !== workspaceId) {
      setProductionError('No fue posible preparar la actualización de la orden.');
      return false;
    }
    if (currentOrder.deletedAt) return false;
    if (
      currentOrder.estado === PRODUCTION_STATUSES.REJECTED
      && changes?.estado
      && changes.estado !== PRODUCTION_STATUSES.REJECTED
    ) return false;

    const now = new Date().toISOString();
    const normalizedChanges = productionChangesWithSharedNote(currentOrder, changes, now);
    const observationChanged = Object.prototype.hasOwnProperty.call(
      normalizedChanges,
      'observaciones',
    ) && normalizedChanges.observaciones !== clean(currentOrder.observaciones);
    const nextStatus = normalizedChanges?.estado || currentOrder.estado;
    const timeline = Array.isArray(currentOrder.timeline) ? [...currentOrder.timeline] : [];

    if (nextStatus !== currentOrder.estado) {
      timeline.push({
        evento: `Estado cambiado a ${nextStatus}`,
        fecha: now,
        usuario: userId,
        comentario: `${currentOrder.estado} → ${nextStatus}`,
      });
    }

    const expectedVersion = currentOrder.pendingExpectedVersion || currentOrder.version;
    const optimisticOrder = {
      ...updateProductionOrderEngine(
        currentOrder,
        { ...normalizedChanges, timeline },
        now
      ),
      version: currentOrder.version,
      pendingSync: true,
      pendingExpectedVersion: expectedVersion,
    };

    if (!upsertActiveProductionOrder(optimisticOrder)) {
      setProductionError('No fue posible guardar el cambio local.');
      return false;
    }

    if (observationChanged && !options.suppressQuoteSync) {
      void syncQuoteNoteFromProduction?.(optimisticOrder);
    }

    if (!navigator.onLine) {
      setProductionError('Cambios locales pendientes de sincronizar.');
      setSyncStatus('Producción guardada localmente · pendiente de sincronizar');
      return true;
    }

    const result = await ProductionOrderRepository.updateProductionOrderRemote(
      workspaceId,
      orderId,
      optimisticOrder,
      expectedVersion
    );

    if (result.error?.code === 'PRODUCTION_ORDER_VERSION_CONFLICT') {
      const remote = await ProductionOrderRepository.getProductionOrder(workspaceId, orderId);
      if (remote.data && !remote.error) {
        upsertActiveProductionOrder(remote.data);
        if (!options.suppressQuoteSync) void syncQuoteNoteFromProduction?.(remote.data);
        setProductionError('La orden fue modificada en otro dispositivo. Se cargó la versión remota.');
        setSyncStatus('Conflicto de producción · versión remota cargada');
      } else if (optimisticOrder.deletedAt && !remote.data) {
        ProductionStorage.removeProductionOrder(orderId);
        setActiveProductionOrders(
          workspaceId,
          ProductionStorage.loadProductionOrders().filter((order) => (
            order.workspaceId === workspaceId
          )),
        );
        return true;
      } else {
        setProductionError('No se pudo cargar la versión remota de la orden.');
      }
      return false;
    }

    if (result.error || !result.data) {
      setProductionError('Cambios locales pendientes de sincronizar.');
      setSyncStatus('Producción guardada localmente · pendiente de sincronizar');
      return false;
    }

    upsertActiveProductionOrder(result.data);
    setProductionError('');
    setSyncStatus('Orden de producción actualizada en nube');
    return true;
  }

  async function generateProductionOrderFromCurrentQuote() {
    const workspaceId = activeWorkspace?.id;
    const userId = authSession?.user?.id;
    const quoteId = activeQuoteIdentity?.id;

    if (!workspaceId) {
      setSyncStatus('No hay un workspace activo');
      return;
    }
    if (!userId) {
      setSyncStatus('Se requiere una sesión activa');
      return;
    }
    if (!activeQuoteIdentity) {
      setSyncStatus('Guarda la cotización antes de generar la orden');
      return;
    }
    if (!activeQuoteIdentity.remote || !isRemoteQuoteId(quoteId)) {
      setSyncStatus('La cotización debe estar guardada en nube');
      return;
    }
    if (activeQuoteIdentity.workspaceId && activeQuoteIdentity.workspaceId !== workspaceId) {
      setSyncStatus('La cotización pertenece a otro workspace');
      return;
    }
    if (!Number.isInteger(Number(activeQuoteIdentity.version)) || Number(activeQuoteIdentity.version) < 1) {
      setSyncStatus('La cotización remota no tiene una versión válida');
      return;
    }
    if (!quoteCanGenerateProduction(form.estadoCotizacion)) {
      setSyncStatus('La cotización debe estar Aceptada');
      return;
    }
    if (!navigator.onLine) {
      setSyncStatus('Conéctate para generar la Orden de Producción');
      return;
    }

    const existingOrder = productionOrdersRef.current.find(
      (order) => order.workspaceId === workspaceId && order.quoteId === quoteId
    );
    if (existingOrder) {
      setSyncStatus('Esta cotización ya tiene una orden de producción');
      setSelectedProductionOrderId(existingOrder.id);
      setActiveSection('produccion');
      return;
    }

    if (productionCreateInFlightRef.current) {
      setSyncStatus('La Orden de Producción se está generando');
      return;
    }

    productionCreateInFlightRef.current = true;
    setProductionError('');

    try {
      const remoteExisting = await ProductionOrderRepository.getProductionOrderByQuoteId(
        workspaceId,
        quoteId
      );

      if (remoteExisting.error) {
        console.warn('No se pudo comprobar la Orden de Producción existente:', {
          code: remoteExisting.error?.code,
          message: remoteExisting.error?.message,
          details: remoteExisting.error?.details,
          hint: remoteExisting.error?.hint,
        });
      } else if (remoteExisting.data) {
        const savedExisting = upsertActiveProductionOrder(remoteExisting.data);
        setSelectedProductionOrderId(savedExisting?.id || remoteExisting.data.id);
        setActiveSection('produccion');
        setProductionSyncStatus('Esta cotización ya tiene una orden de producción');
        setSyncStatus('Esta cotización ya tiene una orden de producción');
        return;
      }

      const order = createProductionOrderEngine({
        quoteId,
        workspaceId,
        cliente: form.clienteNombre,
        producto: form.producto,
        estado: 'Pendiente',
        prioridad: 'Normal',
        responsable: '',
        fechaCreacion: new Date(),
        fechaCompromiso: form.entrega || '',
        observaciones: productionOrderNoteFromQuote(form),
        formSnapshot: { ...form, notasInternas: productionOrderNoteFromQuote(form) },
        quoteVersion: Number(activeQuoteIdentity.version),
        createdBy: userId,
      }, productionOrdersRef.current);

      const localOrder = ProductionStorage.addProductionOrder(order);
      if (!localOrder) {
        setProductionError('No se pudo crear la copia local de la orden.');
        setSyncStatus('No se pudo crear la Orden de Producción');
        return;
      }

      upsertActiveProductionOrder(localOrder);
      setSelectedProductionOrderId(localOrder.id);
      setActiveSection('produccion');
      setProductionSyncStatus('Orden local creada · guardando en nube');

      const result = await ProductionOrderRepository.createProductionOrderRemote(
        workspaceId,
        localOrder
      );

      if (result.error || !result.data) {
        console.warn('createProductionOrderRemote falló:', {
          code: result.error?.code,
          message: result.error?.message,
          details: result.error?.details,
          hint: result.error?.hint,
        });
        setProductionError('No se pudo crear la orden en nube. La copia local se conservó.');
        setProductionSyncStatus('Orden local · pendiente de sincronizar');
        setSyncStatus('No se pudo crear la orden en nube');
        return;
      }

      const remoteOrder = ProductionStorage.replaceProductionOrder(localOrder.id, result.data)
        || result.data;
      setActiveProductionOrders(
        workspaceId,
        ProductionStorage.loadProductionOrders().filter(
          (item) => item.workspaceId === workspaceId
        )
      );
      setProductionError('');
      setSelectedProductionOrderId(remoteOrder.id);
      setActiveSection('produccion');

      if (result.existing) {
        setProductionSyncStatus('Esta cotización ya tiene una orden de producción');
        setSyncStatus('Esta cotización ya tiene una orden de producción');
      } else {
        setProductionSyncStatus('Orden de producción creada en nube');
        setSyncStatus('Orden de producción creada en nube');
      }
    } catch (error) {
      console.warn('Generar Orden de Producción falló:', {
        code: error?.code,
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
      });
      setProductionError('No se pudo generar la orden. La información local se conservó.');
      setProductionSyncStatus('Orden local · pendiente de sincronizar');
      setSyncStatus('No se pudo generar la Orden de Producción');
    } finally {
      productionCreateInFlightRef.current = false;
    }
  }

  return {
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
    refreshProduction: loadRemoteProductionOrders,
    syncProductionOrderFromQuote,
  };
}
export function quoteCanGenerateProduction(status) {
  return QuoteAdapter.normalizeQuoteStatus(status) === 'Aceptada';
}
