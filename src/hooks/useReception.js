import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createUuid } from '../lib/identity/createUuid.js';
import {
  ReceptionApplicationRepository,
} from '../lib/receptions/receptionRepositoryProvider.js';
import {
  createReception as createReceptionEntity,
} from '../lib/receptions/receptionEngine.js';
import { canMutateReception } from '../lib/receptions/receptionGuards.js';
import {
  getReceptionNotifications,
  getReceptionOperationalEvents,
  getPurchaseReceptionView,
  selectReceptionInbox,
} from '../lib/receptions/receptionSelectors.js';
import { getReceptionSummary } from '../lib/receptions/receptionSummary.js';

function message(error, fallback) {
  return error?.message || fallback;
}

export function buildReceptionInput({
  workspaceId,
  purchase,
  receivedBy,
  values = {},
  observations = '',
  evidence = [],
  now = new Date().toISOString(),
  createId = createUuid,
} = {}) {
  const receptionId = createId();
  return {
    id: receptionId,
    workspaceId,
    purchaseId: purchase?.id,
    productionOrderId: purchase?.productionOrderId,
    quoteId: purchase?.quoteId,
    receivedAt: now,
    receivedBy,
    observations,
    evidence,
    createdAt: now,
    createdBy: receivedBy,
    items: (Array.isArray(purchase?.items) ? purchase.items : [])
      .map((purchaseItem) => {
        const row = values[purchaseItem.id] || {};
        const accepted = Number(row.acceptedQuantity || 0);
        const damaged = Number(row.damagedQuantity || 0);
        const rejected = Number(row.rejectedQuantity || 0);
        const missing = Number(row.missingQuantity || 0);
        const outcomeTotal = accepted + damaged + rejected + missing;
        const received = row.receivedQuantity === ''
          || row.receivedQuantity === null
          || row.receivedQuantity === undefined
          ? outcomeTotal
          : Number(row.receivedQuantity);
        if (received === 0 && outcomeTotal === 0) return null;
        return {
          id: createId(),
          workspaceId,
          receptionId,
          purchaseId: purchase.id,
          purchaseItemId: purchaseItem.id,
          receivedQuantity: received,
          acceptedQuantity: accepted,
          damagedQuantity: damaged,
          rejectedQuantity: rejected,
          missingQuantity: missing,
          observations: row.observations || '',
          evidence: Array.isArray(row.evidence) ? row.evidence : [],
          createdAt: now,
          updatedAt: now,
          createdBy: receivedBy,
          lastModifiedBy: receivedBy,
        };
      })
      .filter(Boolean),
  };
}

export default function useReception({
  authSession,
  activeWorkspace,
  workspaceAccessStatus,
  purchases = [],
  productionOrders = [],
  quotes = [],
  selectedPurchaseId = null,
  repository = ReceptionApplicationRepository,
} = {}) {
  const [receptions, setReceptions] = useState([]);
  const [receptionLoading, setReceptionLoading] = useState(false);
  const [receptionError, setReceptionError] = useState('');
  const [receptionSyncStatus, setReceptionSyncStatus] = useState('Recepción local');
  const [receptionConflicts, setReceptionConflicts] = useState([]);
  const contextRef = useRef({ workspaceId: null, userId: null });
  const workspaceId = activeWorkspace?.id || null;
  const userId = authSession?.user?.id || null;
  contextRef.current = { workspaceId, userId };

  const refreshReceptions = useCallback(async () => {
    if (!workspaceId || !userId) {
      setReceptions([]);
      return { data: [], error: null };
    }
    setReceptionLoading(true);
    const result = await repository.listByWorkspace(workspaceId);
    if (
      contextRef.current.workspaceId !== workspaceId
      || contextRef.current.userId !== userId
    ) return result;
    setReceptionLoading(false);
    if (result.error) {
      setReceptionError(message(
        result.error,
        'No fue posible cargar Recepción.',
      ));
      return result;
    }
    setReceptions(result.data || []);
    setReceptionError('');
    setReceptionSyncStatus(
      result.syncStatus === 'synced'
        ? 'Recepción sincronizada'
        : 'Recepción disponible localmente',
    );
    return result;
  }, [repository, userId, workspaceId]);

  useEffect(() => {
    if (['suspended', 'revoked'].includes(workspaceAccessStatus)) {
      setReceptions([]);
      return undefined;
    }
    void refreshReceptions();
    return undefined;
  }, [refreshReceptions, workspaceAccessStatus]);

  useEffect(() => {
    if (!workspaceId || !userId) return undefined;
    return repository.subscribeToChanges(
      workspaceId,
      (result) => {
        if (result?.error) {
          setReceptionError(message(result.error, 'Error de Realtime.'));
          return;
        }
        if (result?.data?.status === 'conflict') {
          setReceptionConflicts((current) => [
            ...current.filter((item) => (
              item.receptionId !== result.data.receptionId
            )),
            result.data,
          ]);
          return;
        }
        if (result?.data?.changed || result?.data?.needsReload) {
          void refreshReceptions();
        }
      },
      (status) => {
        setReceptionSyncStatus(
          status === 'SUBSCRIBED'
            ? 'Recepción Realtime'
            : 'Recepción reconectando',
        );
      },
    );
  }, [refreshReceptions, repository, userId, workspaceId]);

  const activePurchase = useMemo(() => (
    purchases.find((purchase) => purchase.id === selectedPurchaseId)
    || null
  ), [purchases, selectedPurchaseId]);

  const activePurchaseView = useMemo(() => (
    activePurchase
      ? getPurchaseReceptionView(activePurchase, receptions)
      : null
  ), [activePurchase, receptions]);

  const receptionInbox = useMemo(() => selectReceptionInbox({
    workspaceId,
    receptions,
    purchases,
    productionOrders,
    quotes,
  }), [productionOrders, purchases, quotes, receptions, workspaceId]);

  const receptionEvents = useMemo(() => getReceptionOperationalEvents({
    receptions,
    inbox: receptionInbox,
  }), [receptionInbox, receptions]);

  const receptionNotifications = useMemo(() => (
    getReceptionNotifications(receptionInbox)
  ), [receptionInbox]);

  const receptionSummary = useMemo(() => getReceptionSummary({
    workspaceId,
    receptions,
    purchases,
    productionOrders,
    quotes,
  }), [productionOrders, purchases, quotes, receptions, workspaceId]);

  const pendingOperations = useMemo(() => (
    workspaceId
      ? repository.getPendingOperations(workspaceId).data || []
      : []
  ), [receptions, repository, workspaceId]);

  async function saveReception({
    purchase = activePurchase,
    values,
    observations,
    evidence,
  } = {}) {
    if (!workspaceId || !userId || !purchase) {
      return {
        data: null,
        error: { message: 'Selecciona una compra válida.' },
      };
    }
    const productionOrder = productionOrders.find((order) => (
      order.id === purchase.productionOrderId
    )) || null;
    const candidate = createReceptionEntity(buildReceptionInput({
      workspaceId,
      purchase,
      receivedBy: userId,
      values,
      observations,
      evidence,
    }), {
      purchase,
      productionOrder,
      existingReceptions: receptions,
    });
    if (candidate.error) {
      setReceptionError(candidate.error.message);
      return candidate;
    }
    const result = await repository.createReception(workspaceId, candidate.data);
    if (result.error) {
      setReceptionError(message(result.error, 'No se guardó la recepción.'));
      return result;
    }
    setReceptions((current) => [
      result.data,
      ...current.filter((item) => item.id !== result.data.id),
    ]);
    setReceptionError('');
    setReceptionSyncStatus(
      result.syncStatus === 'pending'
        ? 'Recepción pendiente de sincronizar'
        : 'Recepción guardada',
    );
    return result;
  }

  async function removeReception(receptionId, expectedVersion = null) {
    if (!workspaceId) return { data: null, error: { message: 'Falta workspace.' } };
    const current = receptions.find((item) => item.id === receptionId);
    const productionOrder = productionOrders.find((order) => (
      order.id === current?.productionOrderId
    )) || null;
    if (!canMutateReception(productionOrder)) {
      return {
        data: null,
        error: {
          code: 'RECEPTION_READ_ONLY',
          message: 'El proyecto entregado es de solo lectura.',
        },
      };
    }
    const result = await repository.deleteReception(
      workspaceId,
      receptionId,
      expectedVersion,
    );
    if (!result.error) {
      setReceptions((current) => current.filter((item) => (
        item.id !== receptionId
      )));
    }
    return result;
  }

  async function syncPendingReceptions() {
    if (!workspaceId) return { data: null, error: { message: 'Falta workspace.' } };
    const result = await repository.syncPendingOperations(workspaceId);
    if (!result.error) await refreshReceptions();
    return result;
  }

  return {
    receptions,
    receptionLoading,
    receptionError,
    receptionSyncStatus,
    receptionConflicts,
    receptionSummary,
    receptionInbox,
    receptionEvents,
    receptionNotifications,
    pendingOperations,
    activePurchase,
    activePurchaseView,
    saveReception,
    removeReception,
    refreshReceptions,
    syncPendingReceptions,
  };
}
