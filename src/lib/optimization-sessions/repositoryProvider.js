import { supabase } from '../supabase/client.js';
import {
  createOptimizationSessionApplicationRepository,
} from './applicationRepository.js';
import {
  createBrowserConnectivityProvider,
} from './connectivityProvider.js';
import {
  OptimizationSessionLocalSyncRepository,
} from './localSyncRepository.js';
import {
  OptimizationSessionPendingOperationsRepository,
} from './pendingOperationsRepository.js';
import {
  createRemoteOptimizationRepository,
} from './remoteRepository.js';
import {
  createOptimizationSessionSupabaseClient,
} from './supabaseClient.js';
import {
  createOptimizationSessionSyncEngine,
} from './syncEngine.js';

const remoteRepositories = new Map();

function remoteRepositoryForWorkspace(workspaceId) {
  if (!remoteRepositories.has(workspaceId)) {
    const client = createOptimizationSessionSupabaseClient({
      supabase,
      workspaceId,
    });
    remoteRepositories.set(
      workspaceId,
      createRemoteOptimizationRepository(client),
    );
  }
  return remoteRepositories.get(workspaceId);
}

export const OptimizationSessionApplicationRepository =
  createOptimizationSessionApplicationRepository({
    syncEngine: createOptimizationSessionSyncEngine({
      localRepository: OptimizationSessionLocalSyncRepository,
      pendingOperationsRepository:
        OptimizationSessionPendingOperationsRepository,
      createRemoteRepository: remoteRepositoryForWorkspace,
      isOnline: createBrowserConnectivityProvider().isOnline,
    }),
  });
