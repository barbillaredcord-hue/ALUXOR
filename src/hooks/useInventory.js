import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getInventoryKardex,
  getInventorySnapshot,
  getInventorySummary,
} from '../lib/inventory/inventorySelectors.js';
import { InventoryApplicationRepository } from '../lib/inventory/inventoryRepositoryProvider.js';
import { reconcileReceptionInventory } from '../lib/inventory/inventoryReceptionIntegration.js';

export default function useInventory({
  workspaceId,
  repository = InventoryApplicationRepository,
  allowNegative = false,
  receptions = [],
  purchases = [],
  corrections = [],
  userId = null,
  receptionsReady = false,
} = {}) {
  const [storedMovements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storedPendingOperations, setPendingOperations] = useState([]);
  const [connectionState, setConnectionState] = useState('unknown');
  const [realtimeState, setRealtimeState] = useState('idle');
  const [hydratedWorkspaceId, setHydratedWorkspaceId] = useState(null);
  const [receptionIntegration, setReceptionIntegration] = useState({
    status: 'idle', created: 0, reversed: 0, issues: [], error: null,
  });
  const reconcilingRef = useRef(false);
  const workspaceRef = useRef(workspaceId);
  const refreshSequence = useRef(0);
  workspaceRef.current = workspaceId;
  const movements = useMemo(() => storedMovements.filter((item) => (
    workspaceId && item.workspaceId === workspaceId
  )), [storedMovements, workspaceId]);
  const pendingOperations = useMemo(() => storedPendingOperations.filter((item) => (
    workspaceId && item.workspaceId === workspaceId
  )), [storedPendingOperations, workspaceId]);
  const conflicts = useMemo(() => pendingOperations.filter((item) => item.status === 'conflict'), [pendingOperations]);

  const refresh = useCallback(async () => {
    if (workspaceRef.current !== workspaceId) return { data: [], error: null };
    const sequence = ++refreshSequence.current;
    if (!workspaceId || !repository) {
      setMovements([]);
      setHydratedWorkspaceId(null);
      setLoading(false);
      return { data: [], error: null };
    }
    setLoading(true);
    let result;
    try {
      result = await repository.listMovements(workspaceId);
    } catch (cause) {
      result = { data: null, error: { code: 'INVENTORY_LOAD_FAILED', message: cause?.message || 'No se pudo cargar Inventario.' } };
    }
    if (workspaceRef.current !== workspaceId || sequence !== refreshSequence.current) return result;
    setLoading(false);
    setError(result.error || null);
    if (!result.error) {
      setMovements(result.data || []);
      setHydratedWorkspaceId(workspaceId);
    }
    return result;
  }, [repository, workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!workspaceId || typeof repository?.subscribeToChanges !== 'function') return undefined;
    return repository.subscribeToChanges(workspaceId, () => { void refresh(); }, (status) => {
      if (workspaceRef.current !== workspaceId) return;
      setRealtimeState(String(status || 'unknown').toLowerCase());
    });
  }, [refresh, repository, workspaceId]);

  useEffect(() => {
    const updateConnection = () => setConnectionState(
      globalThis.navigator?.onLine === false ? 'offline' : 'online',
    );
    updateConnection();
    globalThis.addEventListener?.('online', updateConnection);
    globalThis.addEventListener?.('offline', updateConnection);
    return () => {
      globalThis.removeEventListener?.('online', updateConnection);
      globalThis.removeEventListener?.('offline', updateConnection);
    };
  }, []);

  const refreshPending = useCallback(() => {
    const result = repository?.getPendingOperations?.(workspaceId) || { data: [] };
    if (workspaceRef.current !== workspaceId) return result;
    const operations = result.data || [];
    setPendingOperations(operations);
    return result;
  }, [repository, workspaceId]);

  useEffect(() => { refreshPending(); }, [refreshPending]);

  const createMovement = useCallback(async (movement) => {
    const result = await repository.create(workspaceId, movement, { allowNegative });
    if (!result.error) await refresh();
    else setError(result.error);
    refreshPending();
    return result;
  }, [allowNegative, refresh, refreshPending, repository, workspaceId]);

  const updateMovementMetadata = useCallback(async (movementId, patch, expectedVersion) => {
    const result = await repository.updateAllowedMetadata(workspaceId, movementId, patch, expectedVersion);
    if (!result.error) await refresh();
    else setError(result.error);
    refreshPending();
    return result;
  }, [refresh, refreshPending, repository, workspaceId]);

  const updateMovement = useCallback((movement, expectedVersion) => (
    updateMovementMetadata(movement.id, movement, expectedVersion)
  ), [updateMovementMetadata]);

  const removeMovement = useCallback(async (movementId, expectedVersion) => {
    const result = await repository.remove(workspaceId, movementId, expectedVersion);
    if (!result.error) await refresh();
    else setError(result.error);
    return result;
  }, [refresh, repository, workspaceId]);

  const summary = useMemo(
    () => getInventorySummary(movements, { allowNegative }),
    [allowNegative, movements],
  );
  const snapshot = useMemo(
    () => getInventorySnapshot(movements, { workspaceId, allowNegative }),
    [allowNegative, movements, workspaceId],
  );
  const kardex = useMemo(
    () => getInventoryKardex(movements, { workspaceId }),
    [movements, workspaceId],
  );

  const reverseMovement = useCallback(async (input) => {
    const result = await repository.reverseMovement(workspaceId, input);
    if (!result.error) await refresh(); else setError(result.error);
    refreshPending();
    return result;
  }, [refresh, refreshPending, repository, workspaceId]);

  const createTransfer = useCallback(async (input) => {
    const result = await repository.createTransfer(workspaceId, input);
    if (!result.error) await refresh(); else setError(result.error);
    refreshPending();
    return result;
  }, [refresh, refreshPending, repository, workspaceId]);

  const syncPendingOperations = useCallback(async () => {
    const result = await repository.syncPendingOperations(workspaceId);
    await refresh();
    refreshPending();
    return result;
  }, [refresh, refreshPending, repository, workspaceId]);

  const reconcileReceptions = useCallback(async ({
    receptions: overrideReceptions = receptions,
    purchases: overridePurchases = purchases,
    corrections: overrideCorrections = corrections,
  } = {}) => {
    if (
      !workspaceId
      || !receptionsReady
      || hydratedWorkspaceId !== workspaceId
      || reconcilingRef.current
    ) {
      return { data: { status: 'skipped', created: [], reversed: [], issues: [] }, error: null };
    }
    reconcilingRef.current = true;
    setReceptionIntegration((current) => ({ ...current, status: 'reconciling', error: null }));
    try {
      const result = await reconcileReceptionInventory({
        workspaceId,
        receptions: overrideReceptions,
        purchases: overridePurchases,
        corrections: overrideCorrections,
        movements,
        userId,
        createMovement: (movement) => repository.create(
          workspaceId,
          movement,
          { allowNegative },
        ),
        reverseMovement: (input) => repository.reverseMovement(workspaceId, input),
      });
      const created = result.data?.created?.length || 0;
      const reversed = result.data?.reversed?.length || 0;
      if (created || reversed) await refresh();
      refreshPending();
      setReceptionIntegration({
        status: result.data?.status || (result.error ? 'attention' : 'reconciled'),
        created,
        reversed,
        issues: result.data?.issues || [],
        error: result.error || null,
      });
      if (result.error) setError(result.error);
      return result;
    } finally {
      reconcilingRef.current = false;
    }
  }, [
    allowNegative,
    hydratedWorkspaceId,
    movements,
    purchases,
    corrections,
    receptions,
    receptionsReady,
    refresh,
    refreshPending,
    repository,
    userId,
    workspaceId,
  ]);

  return {
    movements,
    summary,
    snapshot,
    kardex,
    loading,
    error,
    refresh,
    createMovement,
    updateMovement,
    updateMovementMetadata,
    removeMovement,
    reverseMovement,
    createTransfer,
    syncPendingOperations,
    pendingOperations,
    conflicts,
    connectionState,
    realtimeState,
    receptionIntegration,
    reconcileReceptions,
  };
}
