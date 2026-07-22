import { useEffect, useMemo, useRef, useState } from 'react';
import { Quote } from '../lib/br-engine/index.js';
import { quoteHelpers } from '../app/config/helpers.js';
import {
  createPurchaseFromProductionOrder,
  normalizePurchase,
  normalizePurchaseItem,
  purchaseStatusFromItems,
  updatePurchase as updatePurchaseModel,
} from '../lib/purchases/purchaseEngine.js';
import { PurchaseRepository } from '../lib/purchases/purchaseRepository.js';
import { PurchaseStorage } from '../lib/purchases/purchaseStorage.js';
import { PurchaseOfflineQueue } from '../lib/purchases/purchaseOfflineQueue.js';

const AUTOSAVE_DELAY_MS = 700;

export function mergePurchaseCollections(remote = [], local = []) {
  const merged = new Map();
  (Array.isArray(remote) ? remote : []).forEach((purchase) => {
    const normalized = normalizePurchase(purchase);
    if (normalized.id) merged.set(normalized.id, normalized);
  });
  (Array.isArray(local) ? local : []).forEach((purchase) => {
    const normalized = normalizePurchase(purchase);
    if (!normalized.id) return;
    if (!normalized.pendingSync && !normalized.items.some((item) => item.pendingSync)) return;
    const remotePurchase = merged.get(normalized.id);
    merged.set(normalized.id, remotePurchase
      ? mergePurchaseWithPendingItems(remotePurchase, normalized)
      : normalized);
  });
  return Array.from(merged.values());
}

const ITEM_EDIT_FIELDS = [
  'group', 'name', 'unit', 'quantity', 'unitCost', 'status',
  'supplier', 'itemDate', 'notes',
];

function itemKey(item) {
  return `${item?.sourceType || 'material'}:${item?.sourceId || item?.id || ''}`;
}

export function purchaseFieldValue(purchase, path) {
  if (!String(path).startsWith('items.')) return purchase?.[path];
  const [, key, field] = String(path).split('.');
  return purchase?.items?.find((item) => itemKey(item) === key)?.[field];
}

function fieldValuesEqual(left, right) {
  if (typeof left === 'number' || typeof right === 'number') {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
      return leftNumber === rightNumber;
    }
  }
  return String(left ?? '') === String(right ?? '');
}

function itemRevision(item) {
  return {
    version: Number(item?.version) || 0,
    updatedAt: Date.parse(item?.updatedAt || '') || 0,
  };
}

export function mergePendingPurchaseItem(remoteItem, localItem) {
  const remoteRevision = itemRevision(remoteItem);
  const localRevision = itemRevision(localItem);
  if (
    remoteRevision.version < localRevision.version
    || (
      remoteRevision.version === localRevision.version
      && remoteRevision.updatedAt < localRevision.updatedAt
    )
  ) return localItem;
  const remote = normalizePurchaseItem(remoteItem);
  const local = normalizePurchaseItem(localItem);
  const pendingFields = Array.isArray(local.pendingFields) ? local.pendingFields : [];
  if (!local.pendingSync || !pendingFields.length) return remote;
  const unresolved = pendingFields.filter((field) => !fieldValuesEqual(
    remote[field],
    local[field],
  ));
  if (!unresolved.length) return remote;
  return normalizePurchaseItem({
    ...remote,
    ...Object.fromEntries(unresolved.map((field) => [field, local[field]])),
    pendingSync: true,
    pendingFields: unresolved,
    pendingExpectedVersion: remote.version,
    updatedAt: local.updatedAt,
  });
}

export function mergePurchaseWithPendingItems(remotePurchase, localPurchase) {
  const remote = normalizePurchase(remotePurchase);
  const local = normalizePurchase(localPurchase);
  const merged = local.pendingSync ? mergePendingPurchase(remote, local) : remote;
  const localById = new Map(local.items.map((item) => [item.id, item]));
  const remoteIds = new Set(remote.items.map((item) => item.id));
  const items = remote.items.map((item) => {
    const localItem = localById.get(item.id);
    return localItem?.pendingSync ? mergePendingPurchaseItem(item, localItem) : item;
  });
  local.items.forEach((item) => {
    if (item.pendingSync && !remoteIds.has(item.id)) items.push(item);
  });
  const hasPendingItemStatus = local.items.some((item) => (
    item.pendingSync && item.pendingFields?.includes('status')
  ));
  return {
    ...merged,
    items,
    status: hasPendingItemStatus ? purchaseStatusFromItems(items) : merged.status,
  };
}

export function mergeCreatedPurchase(remotePurchase, localPurchase) {
  const remote = normalizePurchase(remotePurchase);
  const local = normalizePurchase(localPurchase);
  const base = local.pendingSync ? mergePendingPurchase(remote, local) : remote;
  const localBySource = new Map(local.items.map((item) => [itemKey(item), item]));
  const items = remote.items.map((remoteItem) => {
    const localItem = localBySource.get(itemKey(remoteItem));
    if (!localItem?.pendingSync) return remoteItem;
    const pendingFields = localItem.pendingFields || [];
    return normalizePurchaseItem({
      ...remoteItem,
      ...Object.fromEntries(pendingFields.map((field) => [field, localItem[field]])),
      pendingSync: true,
      pendingFields,
      pendingExpectedVersion: remoteItem.version,
      updatedAt: localItem.updatedAt,
    });
  });
  return { ...base, items, status: purchaseStatusFromItems(items) };
}

export function applyPurchaseRealtimeEvent(purchases, event) {
  const currentPurchases = Array.isArray(purchases) ? purchases : [];
  const eventType = String(event?.eventType || '').toUpperCase();
  if (event?.table === 'purchases') {
    const purchaseId = event?.record?.id || event?.oldRecord?.id;
    if (!purchaseId) return { purchases: currentPurchases, changed: false, needsReload: true };
    if (eventType === 'DELETE') {
      return {
        purchases: currentPurchases.filter((purchase) => purchase.id !== purchaseId),
        changed: currentPurchases.some((purchase) => purchase.id === purchaseId),
        needsReload: false,
      };
    }
    const index = currentPurchases.findIndex((purchase) => purchase.id === purchaseId);
    if (index < 0) {
      return {
        purchases: [...currentPurchases, normalizePurchase(event.record)],
        changed: true,
        needsReload: false,
      };
    }
    const current = currentPurchases[index];
    const incoming = normalizePurchase({ ...event.record, items: current.items });
    if (incoming.version < current.version) {
      return { purchases: currentPurchases, changed: false, needsReload: false };
    }
    const next = current.pendingSync ? mergePendingPurchase(incoming, current) : incoming;
    next.items = current.items;
    if (
      next.version === current.version
      && (Date.parse(next.updatedAt || '') || 0) < (Date.parse(current.updatedAt || '') || 0)
    ) return { purchases: currentPurchases, changed: false, needsReload: false };
    const result = [...currentPurchases];
    result[index] = next;
    return { purchases: result, changed: true, needsReload: false };
  }

  if (event?.table !== 'purchase_items') {
    return { purchases: currentPurchases, changed: false, needsReload: false };
  }
  const itemId = event?.record?.id || event?.oldRecord?.id;
  if (!itemId) return { purchases: currentPurchases, changed: false, needsReload: true };
  const purchaseIndex = currentPurchases.findIndex((purchase) => (
    purchase.items.some((item) => item.id === itemId)
    || purchase.id === event?.record?.purchaseId
  ));
  if (purchaseIndex < 0) {
    return { purchases: currentPurchases, changed: false, needsReload: true };
  }
  const purchase = currentPurchases[purchaseIndex];
  const itemIndex = purchase.items.findIndex((item) => item.id === itemId);
  if (eventType === 'DELETE') {
    if (itemIndex < 0) return { purchases: currentPurchases, changed: false, needsReload: false };
    const items = purchase.items.filter((item) => item.id !== itemId);
    const result = [...currentPurchases];
    result[purchaseIndex] = { ...purchase, items, status: purchaseStatusFromItems(items) };
    return { purchases: result, changed: true, needsReload: false };
  }
  const remoteItem = normalizePurchaseItem(event.record);
  if (itemIndex < 0) {
    const result = [...currentPurchases];
    const items = [...purchase.items, remoteItem];
    result[purchaseIndex] = { ...purchase, items, status: purchaseStatusFromItems(items) };
    return { purchases: result, changed: true, needsReload: false };
  }
  const currentItem = purchase.items[itemIndex];
  const remoteRevision = itemRevision(remoteItem);
  const currentRevision = itemRevision(currentItem);
  if (
    !currentItem.pendingSync
    && (
      remoteRevision.version < currentRevision.version
      || (
        remoteRevision.version === currentRevision.version
        && remoteRevision.updatedAt <= currentRevision.updatedAt
      )
    )
  ) return { purchases: currentPurchases, changed: false, needsReload: false };
  const mergedItem = mergePendingPurchaseItem(remoteItem, currentItem);
  if (mergedItem === currentItem) {
    return { purchases: currentPurchases, changed: false, needsReload: false };
  }
  const items = [...purchase.items];
  items[itemIndex] = mergedItem;
  const result = [...currentPurchases];
  result[purchaseIndex] = { ...purchase, items, status: purchaseStatusFromItems(items) };
  return { purchases: result, changed: true, needsReload: false };
}

export function mergePendingPurchase(remotePurchase, localPurchase) {
  const remote = normalizePurchase(remotePurchase);
  const local = normalizePurchase(localPurchase);
  const pendingFields = Array.isArray(local.pendingFields) ? local.pendingFields : [];
  if (!pendingFields.length) return local;
  const remoteUpdatedAt = Date.parse(remote.updatedAt || '') || 0;
  const localUpdatedAt = Date.parse(local.updatedAt || '') || 0;
  const unresolved = pendingFields.filter((path) => {
    if (fieldValuesEqual(
      purchaseFieldValue(remote, path),
      purchaseFieldValue(local, path),
    )) return false;
    if (path !== 'notes') return true;
    return !remoteUpdatedAt || !localUpdatedAt || localUpdatedAt > remoteUpdatedAt;
  });
  if (!unresolved.length) return remote;

  const merged = normalizePurchase({
    ...remote,
    pendingSync: true,
    pendingFields: unresolved,
    pendingExpectedVersion: remote.version,
    updatedAt: local.updatedAt,
  });
  const localItems = new Map(local.items.map((item) => [itemKey(item), item]));
  const remoteItems = new Map(merged.items.map((item) => [itemKey(item), item]));
  unresolved.forEach((path) => {
    if (!path.startsWith('items.')) {
      merged[path] = local[path];
      return;
    }
    const [, key, field] = path.split('.');
    const remoteItem = remoteItems.get(key);
    const localItem = localItems.get(key);
    if (remoteItem && localItem) remoteItem[field] = localItem[field];
  });
  return merged;
}

export function purchaseDirtyPaths(current, changes) {
  const paths = [];
  Object.keys(changes || {}).forEach((field) => {
    if (field !== 'items' && !fieldValuesEqual(current?.[field], changes[field])) {
      paths.push(field);
    }
  });
  if (!Array.isArray(changes?.items)) return paths;
  const currentItems = new Map((current?.items || []).map((item) => [itemKey(item), item]));
  changes.items.forEach((item) => {
    const key = itemKey(item);
    const previous = currentItems.get(key) || {};
    ITEM_EDIT_FIELDS.forEach((field) => {
      if (!fieldValuesEqual(previous[field], item[field])) {
        paths.push(`items.${key}.${field}`);
      }
    });
  });
  return paths;
}

export function pendingPurchaseChangedSince(current, snapshot) {
  if (!current?.pendingSync) return false;
  if (current.updatedAt !== snapshot?.updatedAt) return true;
  const paths = new Set([
    ...(current.pendingFields || []),
    ...(snapshot?.pendingFields || []),
  ]);
  return Array.from(paths).some((path) => !fieldValuesEqual(
    purchaseFieldValue(current, path),
    purchaseFieldValue(snapshot, path),
  ));
}

export function purchaseStatusForProductionOrder(purchases, productionOrderId) {
  return purchasesForProductionOrder(purchases, productionOrderId)[0]?.status || null;
}

export function purchasesForProductionOrder(purchases, productionOrderId) {
  return (Array.isArray(purchases) ? purchases : []).filter((purchase) => (
    purchase.active !== false && purchase.productionOrderId === productionOrderId
  ));
}

export function resolvePurchaseCreation(purchases, productionOrderId, inFlight = false) {
  const existing = purchasesForProductionOrder(purchases, productionOrderId)[0] || null;
  return {
    existing,
    canCreate: Boolean(productionOrderId) && !existing && !inFlight,
  };
}

export function resolvePurchaseSelection(purchases, currentId, persistedId) {
  const ids = new Set((Array.isArray(purchases) ? purchases : []).map((purchase) => purchase.id));
  return [currentId, persistedId].find((id) => id && ids.has(id)) || null;
}

export function schedulePurchaseAutosave({
  timerRef,
  pendingIdRef,
  purchaseId,
  persist,
  setTimer,
  clearTimer,
  delay = AUTOSAVE_DELAY_MS,
}) {
  pendingIdRef.current = purchaseId;
  if (timerRef.current !== null) clearTimer(timerRef.current);
  timerRef.current = setTimer(() => {
    timerRef.current = null;
    const pendingId = pendingIdRef.current;
    pendingIdRef.current = null;
    if (pendingId) void persist(pendingId);
  }, delay);
}

export function schedulePurchaseAutosaveForId({
  timers,
  purchaseId,
  persist,
  setTimer,
  clearTimer,
  delay = AUTOSAVE_DELAY_MS,
}) {
  const current = timers.get(purchaseId);
  if (current !== undefined) clearTimer(current);
  const timer = setTimer(() => {
    timers.delete(purchaseId);
    void persist(purchaseId);
  }, delay);
  timers.set(purchaseId, timer);
  return timer;
}

export default function usePurchases({
  authSession,
  activeWorkspace,
  workspaceAccessStatus,
  setActiveSection,
}) {
  const [purchases, setPurchases] = useState([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError, setPurchasesError] = useState('');
  const [purchasesSyncStatus, setPurchasesSyncStatus] = useState('Compras locales');
  const purchasesRef = useRef(purchases);
  const contextRef = useRef({ userId: null, workspaceId: null });
  const requestRef = useRef({ id: 0, inFlight: false, pending: false });
  const syncRef = useRef(false);
  const createRef = useRef(false);
  const purchaseAutosaveTimersRef = useRef(new Map());
  const purchaseSaveControlsRef = useRef(new Map());
  const itemAutosaveTimersRef = useRef(new Map());
  const itemSaveControlsRef = useRef(new Map());

  contextRef.current = {
    userId: authSession?.user?.id || null,
    workspaceId: activeWorkspace?.id || null,
  };

  useEffect(() => {
    purchasesRef.current = purchases;
  }, [purchases]);

  const activePurchase = useMemo(
    () => purchases.find((purchase) => purchase.id === selectedPurchaseId) || null,
    [purchases, selectedPurchaseId],
  );

  function setWorkspacePurchases(workspaceId, nextPurchases) {
    const saved = PurchaseStorage.replaceWorkspacePurchases(workspaceId, nextPurchases);
    purchasesRef.current = saved;
    setPurchases(saved);
    setSelectedPurchaseId((current) => {
      const persisted = PurchaseStorage.loadSelectedPurchaseId(workspaceId);
      const nextSelection = resolvePurchaseSelection(saved, current, persisted);
      PurchaseStorage.saveSelectedPurchaseId(workspaceId, nextSelection);
      return nextSelection;
    });
  }


  function applyWorkspacePurchases(workspaceId, nextPurchases) {
    PurchaseStorage.savePurchases(workspaceId, nextPurchases);
    purchasesRef.current = nextPurchases;
    setPurchases(nextPurchases);
    setSelectedPurchaseId((current) => {
      if (!current || nextPurchases.some((purchase) => purchase.id === current)) return current;
      PurchaseStorage.saveSelectedPurchaseId(workspaceId, null);
      return null;
    });
  }

  function selectPurchase(purchaseId) {
    const workspaceId = activeWorkspace?.id;
    const validId = purchaseId && purchasesRef.current.some((purchase) => purchase.id === purchaseId)
      ? purchaseId
      : null;
    PurchaseStorage.saveSelectedPurchaseId(workspaceId, validId);
    setSelectedPurchaseId(validId);
  }

  function upsertActivePurchase(purchase) {
    const workspaceId = purchase?.workspaceId || activeWorkspace?.id;
    const saved = PurchaseStorage.upsertPurchase(workspaceId, purchase);
    if (!saved) return null;
    const current = PurchaseStorage.loadPurchases(workspaceId);
    purchasesRef.current = current;
    setPurchases(current);
    return saved;
  }

  function setPurchaseItems(purchaseId, updater) {
    const workspaceId = contextRef.current.workspaceId;
    let changed = false;
    const nextPurchases = purchasesRef.current.map((purchase) => {
      if (purchase.id !== purchaseId) return purchase;
      const nextItems = updater(purchase.items, purchase);
      if (nextItems === purchase.items) return purchase;
      changed = true;
      return { ...purchase, items: nextItems, status: purchaseStatusFromItems(nextItems) };
    });
    if (!changed) return null;
    PurchaseStorage.savePurchases(workspaceId, nextPurchases);
    purchasesRef.current = nextPurchases;
    setPurchases(nextPurchases);
    return nextPurchases.find((purchase) => purchase.id === purchaseId) || null;
  }

  function clearItemAutosaves() {
    itemAutosaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    itemAutosaveTimersRef.current.clear();
    itemSaveControlsRef.current.clear();
  }

  function clearPurchaseAutosave(purchaseId) {
    const timer = purchaseAutosaveTimersRef.current.get(purchaseId);
    if (timer !== undefined) window.clearTimeout(timer);
    purchaseAutosaveTimersRef.current.delete(purchaseId);
    purchaseSaveControlsRef.current.delete(purchaseId);
  }

  function clearPurchaseAutosaves() {
    purchaseAutosaveTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    purchaseAutosaveTimersRef.current.clear();
    purchaseSaveControlsRef.current.clear();
  }

  function clearPurchaseItemAutosaves(purchaseId) {
    itemAutosaveTimersRef.current.forEach((timer, key) => {
      if (!key.startsWith(`${purchaseId}:`)) return;
      window.clearTimeout(timer);
      itemAutosaveTimersRef.current.delete(key);
      itemSaveControlsRef.current.delete(key);
    });
  }

  async function loadRemotePurchases() {
    const { userId, workspaceId } = contextRef.current;
    if (!userId || !workspaceId) return;
    if (requestRef.current.inFlight) {
      requestRef.current.pending = true;
      return;
    }
    const requestId = requestRef.current.id + 1;
    requestRef.current = { id: requestId, inFlight: true, pending: false };
    setPurchasesLoading(true);
    try {
      const result = await PurchaseRepository.loadPurchases(workspaceId);
      if (
        requestId !== requestRef.current.id
        || contextRef.current.userId !== userId
        || contextRef.current.workspaceId !== workspaceId
      ) return;
      if (result.error) {
        setPurchasesError('No se pudieron cargar las compras en nube. Mostrando copia local.');
        return;
      }
      const local = PurchaseStorage.loadPurchases(workspaceId);
      setWorkspacePurchases(workspaceId, mergePurchaseCollections(result.data, local));
      setPurchasesError('');
    } finally {
      if (requestId !== requestRef.current.id) return;
      const pending = requestRef.current.pending;
      requestRef.current = { id: requestId, inFlight: false, pending: false };
      setPurchasesLoading(false);
      if (pending) void loadRemotePurchases();
    }
  }

  async function savePendingPurchase(purchase) {
    const workspaceId = purchase.workspaceId;
    const localId = purchase.id;
    const isCreate = localId.startsWith('purchase-');
    let result = isCreate
      ? await PurchaseRepository.createPurchaseRemote(workspaceId, purchase)
      : await PurchaseRepository.updatePurchaseRemote(
        workspaceId,
        purchase,
        purchase.pendingExpectedVersion || purchase.version,
      );
    if (result.error?.code === 'PURCHASE_VERSION_CONFLICT' && !isCreate) {
      const remote = await PurchaseRepository.getPurchase(workspaceId, purchase.id);
      if (remote.data && !remote.error) {
        const rebased = mergePurchaseWithPendingItems(remote.data, purchase);
        PurchaseStorage.upsertPurchase(workspaceId, rebased);
        result = rebased.pendingSync
          ? await PurchaseRepository.updatePurchaseRemote(
            workspaceId,
            rebased,
            remote.data.version,
          )
          : { data: remote.data, error: null };
      }
    }
    if (result.error || !result.data) return false;
    const latestLocal = PurchaseStorage.loadPurchases(workspaceId)
      .find((item) => item.id === localId);
    if (isCreate) {
      clearPurchaseAutosave(localId);
      clearPurchaseItemAutosaves(localId);
      const remoteCandidate = latestLocal
        ? mergeCreatedPurchase(result.data, latestLocal)
        : result.data;
      const saved = PurchaseStorage.replacePurchase(workspaceId, localId, remoteCandidate);
      PurchaseOfflineQueue.remove(workspaceId, localId);
      remoteCandidate.items.filter((item) => item.pendingSync).forEach((item) => {
        PurchaseOfflineQueue.enqueue(workspaceId, {
          type: 'updateItem',
          purchaseId: remoteCandidate.id,
          itemId: item.id,
          expectedVersion: item.pendingExpectedVersion || item.version,
        });
      });
      if (remoteCandidate.pendingSync) {
        PurchaseOfflineQueue.enqueue(workspaceId, {
          type: 'update',
          purchaseId: remoteCandidate.id,
          expectedVersion: remoteCandidate.pendingExpectedVersion || remoteCandidate.version,
        });
      }
      if (contextRef.current.workspaceId === workspaceId) {
        const persisted = PurchaseStorage.loadSelectedPurchaseId(workspaceId);
        const nextSelection = persisted === localId ? remoteCandidate.id : persisted;
        PurchaseStorage.saveSelectedPurchaseId(workspaceId, nextSelection);
        setSelectedPurchaseId((current) => (
          current === localId ? remoteCandidate.id : current
        ));
        setWorkspacePurchases(workspaceId, PurchaseStorage.loadPurchases(workspaceId));
      }
      return Boolean(saved);
    }
    const reconciled = latestLocal
      ? mergePurchaseWithPendingItems(result.data, latestLocal)
      : result.data;
    const saved = PurchaseStorage.upsertPurchase(workspaceId, reconciled);
    if (reconciled.pendingSync) {
      PurchaseOfflineQueue.enqueue(workspaceId, {
        type: 'update',
        purchaseId: reconciled.id,
        expectedVersion: result.data.version,
      });
    } else {
      PurchaseOfflineQueue.removeHeader(workspaceId, localId);
    }
    if (contextRef.current.workspaceId === workspaceId) {
      setWorkspacePurchases(workspaceId, PurchaseStorage.loadPurchases(workspaceId));
    }
    return Boolean(saved);
  }

  async function savePendingPurchaseItem(purchaseId, itemSnapshot) {
    const workspaceId = contextRef.current.workspaceId;
    if (!workspaceId || !itemSnapshot?.id) return false;
    let result = await PurchaseRepository.updatePurchaseItemRemote(
      workspaceId,
      itemSnapshot,
      itemSnapshot.pendingExpectedVersion || itemSnapshot.version,
    );
    if (result.error?.code === 'PURCHASE_VERSION_CONFLICT') {
      const remote = await PurchaseRepository.getPurchaseItem(workspaceId, itemSnapshot.id);
      if (remote.data && !remote.error) {
        const rebased = mergePendingPurchaseItem(remote.data, itemSnapshot);
        result = rebased.pendingSync
          ? await PurchaseRepository.updatePurchaseItemRemote(
            workspaceId,
            rebased,
            remote.data.version,
          )
          : { data: remote.data, error: null };
      }
    }
    if (result.error || !result.data) return false;
    const latestPurchase = purchasesRef.current.find((purchase) => purchase.id === purchaseId);
    const latestItem = latestPurchase?.items.find((item) => item.id === itemSnapshot.id);
    const savedItem = latestItem?.pendingSync
      ? mergePendingPurchaseItem(result.data, latestItem)
      : result.data;
    setPurchaseItems(purchaseId, (items) => items.map((item) => (
      item.id === savedItem.id ? savedItem : item
    )));
    if (savedItem.pendingSync) {
      PurchaseOfflineQueue.enqueue(workspaceId, {
        type: 'updateItem',
        purchaseId,
        itemId: savedItem.id,
        expectedVersion: savedItem.pendingExpectedVersion || savedItem.version,
      });
    } else {
      PurchaseOfflineQueue.remove(workspaceId, purchaseId, savedItem.id);
    }
    return true;
  }

  async function persistPurchaseItem(purchaseId, itemId) {
    const key = `${purchaseId}:${itemId}`;
    const control = itemSaveControlsRef.current.get(key) || {
      inFlight: false,
      pending: false,
      sequence: 0,
    };
    itemSaveControlsRef.current.set(key, control);
    if (control.inFlight) {
      control.pending = true;
      return true;
    }
    const purchase = purchasesRef.current.find((entry) => entry.id === purchaseId);
    const item = purchase?.items.find((entry) => entry.id === itemId);
    if (!item?.pendingSync) return true;
    if (!navigator.onLine || purchaseId.startsWith('purchase-')) {
      setPurchasesSyncStatus('Compras guardadas localmente');
      return true;
    }
    const sequence = control.sequence;
    control.inFlight = true;
    control.pending = false;
    try {
      const saved = await savePendingPurchaseItem(purchaseId, item);
      if (!saved) {
        setPurchasesError('Cambios de Compras pendientes de sincronizar.');
        return false;
      }
      setPurchasesError('');
      setPurchasesSyncStatus('Partida guardada en nube');
      return true;
    } finally {
      control.inFlight = false;
      if (control.pending || control.sequence > sequence) {
        control.pending = false;
        queueMicrotask(() => void persistPurchaseItem(purchaseId, itemId));
      }
    }
  }

  function schedulePurchaseItemSave(purchaseId, itemId) {
    const key = `${purchaseId}:${itemId}`;
    const currentTimer = itemAutosaveTimersRef.current.get(key);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    const timer = window.setTimeout(() => {
      itemAutosaveTimersRef.current.delete(key);
      void persistPurchaseItem(purchaseId, itemId);
    }, AUTOSAVE_DELAY_MS);
    itemAutosaveTimersRef.current.set(key, timer);
  }

  function flushPurchaseItemSaves(purchaseId) {
    const pending = [];
    itemAutosaveTimersRef.current.forEach((timer, key) => {
      if (!key.startsWith(`${purchaseId}:`)) return;
      window.clearTimeout(timer);
      itemAutosaveTimersRef.current.delete(key);
      pending.push(persistPurchaseItem(purchaseId, key.slice(purchaseId.length + 1)));
    });
    return Promise.all(pending);
  }

  async function syncPendingPurchases() {
    const { userId, workspaceId } = contextRef.current;
    if (!userId || !workspaceId || syncRef.current || !navigator.onLine) return;
    const queue = PurchaseOfflineQueue.load(workspaceId);
    if (!queue.length) return;
    syncRef.current = true;
    let failed = false;
    try {
      for (const operation of queue) {
        if (contextRef.current.workspaceId !== workspaceId) return;
        const purchase = PurchaseStorage.loadPurchases(workspaceId)
          .find((item) => item.id === operation.purchaseId);
        if (!purchase) {
          failed = true;
          continue;
        }
        if (operation.type === 'updateItem') {
          const item = purchase.items.find((entry) => entry.id === operation.itemId);
          if (!item || !(await savePendingPurchaseItem(purchase.id, item))) failed = true;
        } else if (!(await savePendingPurchase(purchase))) failed = true;
      }
      setPurchasesError(failed ? 'Cambios de Compras pendientes de sincronizar.' : '');
      setPurchasesSyncStatus(failed ? 'Compras pendientes de sincronizar' : 'Compras sincronizadas');
    } finally {
      syncRef.current = false;
    }
  }

  async function persistPurchase(purchaseId) {
    const control = purchaseSaveControlsRef.current.get(purchaseId) || {
      inFlight: false,
      pending: false,
      sequence: 0,
    };
    purchaseSaveControlsRef.current.set(purchaseId, control);
    if (control.inFlight) {
      control.pending = true;
      return true;
    }
    const purchase = purchasesRef.current.find((item) => item.id === purchaseId);
    if (!purchase) return false;
    if (!purchase.pendingSync && !purchaseId.startsWith('purchase-')) return true;
    if (!navigator.onLine) {
      setPurchasesError('Cambios de Compras pendientes de sincronizar.');
      setPurchasesSyncStatus('Compras guardadas localmente');
      return true;
    }
    const sequence = control.sequence;
    control.inFlight = true;
    control.pending = false;
    try {
      const saved = await savePendingPurchase(purchase);
      if (!saved) {
        setPurchasesError('Cambios de Compras pendientes de sincronizar.');
        return false;
      }
      setPurchasesError('');
      setPurchasesSyncStatus('Compra guardada en nube');
      return true;
    } finally {
      control.inFlight = false;
      if (control.pending || control.sequence > sequence) {
        control.pending = false;
        queueMicrotask(() => void persistPurchase(purchaseId));
      }
    }
  }

  function flushPurchaseSave(purchaseId = selectedPurchaseId) {
    if (!purchaseId) return Promise.resolve(true);
    const timer = purchaseAutosaveTimersRef.current.get(purchaseId);
    if (timer !== undefined) window.clearTimeout(timer);
    purchaseAutosaveTimersRef.current.delete(purchaseId);
    return Promise.all([
      persistPurchase(purchaseId),
      flushPurchaseItemSaves(purchaseId),
    ]).then((results) => results.every(Boolean));
  }

  function schedulePurchaseSave(purchaseId) {
    schedulePurchaseAutosaveForId({
      timers: purchaseAutosaveTimersRef.current,
      purchaseId,
      persist: persistPurchase,
      setTimer: window.setTimeout.bind(window),
      clearTimer: window.clearTimeout.bind(window),
    });
  }

  function updatePurchase(purchaseId, changes) {
    const current = purchasesRef.current.find((purchase) => purchase.id === purchaseId);
    if (!current) return false;
    const expectedVersion = current.pendingExpectedVersion || current.version;
    const normalizedChanges = Object.prototype.hasOwnProperty.call(changes || {}, 'items')
      && !Object.prototype.hasOwnProperty.call(changes || {}, 'status')
      ? { ...changes, status: purchaseStatusFromItems(changes.items) }
      : changes;
    const dirtyPaths = purchaseDirtyPaths(current, normalizedChanges);
    if (!dirtyPaths.length) return true;
    const optimistic = {
      ...updatePurchaseModel(current, normalizedChanges),
      version: current.version,
      pendingSync: true,
      pendingFields: [...new Set([...(current.pendingFields || []), ...dirtyPaths])],
      pendingExpectedVersion: expectedVersion,
    };
    if (!upsertActivePurchase(optimistic)) return false;
    PurchaseOfflineQueue.enqueue(current.workspaceId, {
      type: current.id.startsWith('purchase-') ? 'create' : 'update',
      purchaseId: current.id,
      expectedVersion,
    });
    const control = purchaseSaveControlsRef.current.get(current.id) || {
      inFlight: false,
      pending: false,
      sequence: 0,
    };
    control.sequence += 1;
    purchaseSaveControlsRef.current.set(current.id, control);
    schedulePurchaseSave(current.id);
    return true;
  }

  function updatePurchaseItem(purchaseId, itemId, changes) {
    const current = purchasesRef.current.find((purchase) => purchase.id === purchaseId);
    const currentItem = current?.items.find((item) => item.id === itemId);
    if (!current || !currentItem) return false;
    const dirtyFields = Object.keys(changes || {}).filter((field) => (
      !fieldValuesEqual(currentItem[field], changes[field])
    ));
    if (!dirtyFields.length) return true;
    const expectedVersion = currentItem.pendingExpectedVersion || currentItem.version;
    const nextItem = normalizePurchaseItem({
      ...currentItem,
      ...changes,
      totalCost: ('quantity' in changes || 'unitCost' in changes)
        ? Math.max(0, Number(changes.quantity ?? currentItem.quantity) || 0)
          * Math.max(0, Number(changes.unitCost ?? currentItem.unitCost) || 0)
        : currentItem.totalCost,
      version: currentItem.version,
      updatedAt: new Date().toISOString(),
      pendingSync: true,
      pendingFields: [...new Set([
        ...(currentItem.pendingFields || []),
        ...dirtyFields,
      ])],
      pendingExpectedVersion: expectedVersion,
    });
    setPurchaseItems(purchaseId, (items) => items.map((item) => (
      item.id === itemId ? nextItem : item
    )));
    PurchaseOfflineQueue.enqueue(current.workspaceId, {
      type: 'updateItem',
      purchaseId,
      itemId,
      expectedVersion,
    });
    const key = `${purchaseId}:${itemId}`;
    const control = itemSaveControlsRef.current.get(key) || {
      inFlight: false,
      pending: false,
      sequence: 0,
    };
    control.sequence += 1;
    itemSaveControlsRef.current.set(key, control);
    if (!purchaseId.startsWith('purchase-')) schedulePurchaseItemSave(purchaseId, itemId);
    return true;
  }

  function openPurchase(purchaseId) {
    if (!purchaseId || !purchasesRef.current.some((purchase) => purchase.id === purchaseId)) {
      return false;
    }
    selectPurchase(purchaseId);
    setActiveSection('compras');
    return true;
  }

  async function createPurchase(productionOrder) {
    const { userId, workspaceId } = contextRef.current;
    if (!userId || !workspaceId || !productionOrder?.id) return null;
    const creation = resolvePurchaseCreation(
      purchasesRef.current,
      productionOrder.id,
      createRef.current,
    );
    if (creation.existing) {
      openPurchase(creation.existing.id);
      return creation.existing;
    }
    if (!creation.canCreate) return null;
    createRef.current = true;
    setPurchasesError('');
    try {
      const calculatedQuote = Quote.calculateQuote(productionOrder.formSnapshot || {}, quoteHelpers);
      const purchase = createPurchaseFromProductionOrder({
        productionOrder,
        quote: calculatedQuote,
        purchases: purchasesRef.current,
        createdBy: userId,
      });
      const savedLocal = upsertActivePurchase(purchase);
      if (!savedLocal) return null;
      PurchaseOfflineQueue.enqueue(workspaceId, {
        type: 'create',
        purchaseId: savedLocal.id,
      });
      selectPurchase(savedLocal.id);
      setActiveSection('compras');
      if (!navigator.onLine) {
        setPurchasesSyncStatus('Compra local · pendiente de sincronizar');
        return savedLocal;
      }
      const result = await PurchaseRepository.createPurchaseRemote(workspaceId, savedLocal);
      if (result.error || !result.data) {
        setPurchasesError('La compra quedó guardada localmente y se sincronizará después.');
        return savedLocal;
      }
      const latestLocal = PurchaseStorage.loadPurchases(workspaceId)
        .find((purchase) => purchase.id === savedLocal.id);
      const changedDuringCreate = Boolean(
        latestLocal?.pendingSync
        || latestLocal?.items.some((item) => item.pendingSync),
      );
      const remoteCandidate = changedDuringCreate
        ? mergeCreatedPurchase(result.data, latestLocal)
        : result.data;
      clearPurchaseAutosave(savedLocal.id);
      clearPurchaseItemAutosaves(savedLocal.id);
      const remoteSaved = PurchaseStorage.replacePurchase(workspaceId, savedLocal.id, remoteCandidate)
        || remoteCandidate;
      PurchaseOfflineQueue.remove(workspaceId, savedLocal.id);
      if (remoteCandidate.pendingSync) {
        PurchaseOfflineQueue.enqueue(workspaceId, {
          type: 'update',
          purchaseId: remoteSaved.id,
          expectedVersion: remoteSaved.version,
        });
      }
      remoteSaved.items.filter((item) => item.pendingSync).forEach((item) => {
        PurchaseOfflineQueue.enqueue(workspaceId, {
          type: 'updateItem',
          purchaseId: remoteSaved.id,
          itemId: item.id,
          expectedVersion: item.pendingExpectedVersion || item.version,
        });
      });
      if (contextRef.current.workspaceId !== workspaceId) return remoteSaved;
      setWorkspacePurchases(workspaceId, PurchaseStorage.loadPurchases(workspaceId));
      selectPurchase(remoteSaved.id);
      if (remoteSaved.pendingSync) schedulePurchaseSave(remoteSaved.id);
      remoteSaved.items.filter((item) => item.pendingSync).forEach((item) => {
        schedulePurchaseItemSave(remoteSaved.id, item.id);
      });
      setPurchasesSyncStatus(result.existing ? 'Compra existente abierta' : 'Compra creada en nube');
      return remoteSaved;
    } finally {
      createRef.current = false;
    }
  }

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;
    requestRef.current = { id: requestRef.current.id + 1, inFlight: false, pending: false };
    clearPurchaseAutosaves();
    clearItemAutosaves();
    if (!userId || !workspaceId) {
      purchasesRef.current = [];
      setPurchases([]);
      setSelectedPurchaseId(null);
      setPurchasesLoading(false);
      setPurchasesError('');
      if (['suspended', 'revoked'].includes(workspaceAccessStatus)) {
        setPurchasesSyncStatus('Compras bloqueadas');
      }
      return undefined;
    }
    const cached = PurchaseStorage.loadPurchases(workspaceId);
    purchasesRef.current = cached;
    setPurchases(cached);
    const persistedSelection = PurchaseStorage.loadSelectedPurchaseId(workspaceId);
    setSelectedPurchaseId(resolvePurchaseSelection(cached, null, persistedSelection));
    const refresh = async () => {
      if (!navigator.onLine) return;
      await syncPendingPurchases();
      await loadRemotePurchases();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      requestRef.current = { id: requestRef.current.id + 1, inFlight: false, pending: false };
      clearPurchaseAutosaves();
      clearItemAutosaves();
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [authSession?.user?.id, activeWorkspace?.id, workspaceAccessStatus]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!authSession?.user?.id || !workspaceId) return undefined;
    const unsubscribe = PurchaseRepository.subscribePurchases(
      workspaceId,
      (event) => {
        const result = applyPurchaseRealtimeEvent(purchasesRef.current, event);
        if (result.changed) applyWorkspacePurchases(workspaceId, result.purchases);
        if (result.needsReload) void loadRemotePurchases();
      },
      (status) => {
        if (status === 'SUBSCRIBED') setPurchasesSyncStatus('Compras conectadas');
        if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) {
          setPurchasesSyncStatus('Realtime de Compras no disponible');
        }
      },
    );
    return () => {
      unsubscribe();
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  return {
    purchases,
    activePurchase,
    selectedPurchaseId,
    purchasesLoading,
    purchasesError,
    purchasesSyncStatus,
    setSelectedPurchaseId: selectPurchase,
    openPurchase,
    createPurchase,
    updatePurchase,
    updatePurchaseItem,
    flushPurchaseSave,
    refreshPurchases: loadRemotePurchases,
    purchaseStatusForOrder: (orderId) => purchaseStatusForProductionOrder(purchases, orderId),
    purchasesForOrder: (orderId) => purchasesForProductionOrder(purchases, orderId),
  };
}
