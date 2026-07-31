import { createBrowserConnectivityProvider } from '../optimization-sessions/connectivityProvider.js';
import { supabase } from '../supabase/client.js';
import {
  createReceptionApplicationRepository,
} from './receptionApplicationRepository.js';
import {
  ReceptionPendingOperationsRepository,
} from './receptionPendingOperationsRepository.js';
import {
  createReceptionRealtimeSubscription,
} from './receptionRealtime.js';
import {
  ReceptionLocalRepository,
} from './receptionRepository.js';
import {
  createRemoteReceptionRepository,
} from './receptionRemoteRepository.js';
import {
  createReceptionSupabaseClient,
} from './receptionSupabaseClient.js';
import { createReceptionSyncEngine } from './receptionSyncEngine.js';

const remoteRepositories = new Map();
const realtime = createReceptionRealtimeSubscription({ supabase });

function remoteRepositoryForWorkspace(workspaceId) {
  if (!remoteRepositories.has(workspaceId)) {
    remoteRepositories.set(
      workspaceId,
      createRemoteReceptionRepository(createReceptionSupabaseClient({
        supabase,
        workspaceId,
      })),
    );
  }
  return remoteRepositories.get(workspaceId);
}

export const ReceptionApplicationRepository =
  createReceptionApplicationRepository({
    syncEngine: createReceptionSyncEngine({
      localRepository: ReceptionLocalRepository,
      pendingOperationsRepository: ReceptionPendingOperationsRepository,
      createRemoteRepository: remoteRepositoryForWorkspace,
      isOnline: createBrowserConnectivityProvider().isOnline,
      subscribeToRemoteEvents: realtime.subscribe,
    }),
  });
