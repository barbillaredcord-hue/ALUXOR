import { supabase } from '../supabase/client.js';
import { createInventoryApplicationRepository } from './inventoryApplicationRepository.js';
import { createInventoryConnectivityProvider } from './inventoryConnectivityProvider.js';
import { InventoryPendingOperationsRepository } from './inventoryPendingOperationsRepository.js';
import { createInventoryRealtimeSubscription } from './inventoryRealtime.js';
import { createInventoryRemoteRepository } from './inventoryRemoteRepository.js';
import { InventoryLocalRepository } from './inventoryRepository.js';
import { createInventorySupabaseClient } from './inventorySupabaseClient.js';
import { createInventorySyncEngine } from './inventorySyncEngine.js';

const remotes = new Map();
const realtime = createInventoryRealtimeSubscription({ supabase });

function remoteForWorkspace(workspaceId) {
  if (!remotes.has(workspaceId)) {
    remotes.set(workspaceId, createInventoryRemoteRepository(
      createInventorySupabaseClient({ supabase, workspaceId }),
    ));
  }
  return remotes.get(workspaceId);
}

export const InventoryApplicationRepository = createInventoryApplicationRepository({
  syncEngine: createInventorySyncEngine({
    localRepository: InventoryLocalRepository,
    pendingOperationsRepository: InventoryPendingOperationsRepository,
    createRemoteRepository: remoteForWorkspace,
    isOnline: createInventoryConnectivityProvider().isOnline,
    subscribeToRemoteEvents: realtime.subscribe,
  }),
});
