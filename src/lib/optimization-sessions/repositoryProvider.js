import {
  OptimizationSessionRepository,
} from '../optimization-session/repository.js';
import { supabase } from '../supabase/client.js';
import {
  createOptimizationSessionApplicationRepository,
} from './applicationRepository.js';
import {
  createRemoteOptimizationRepository,
} from './remoteRepository.js';
import {
  createOptimizationSessionSupabaseClient,
} from './supabaseClient.js';

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
    localRepository: OptimizationSessionRepository,
    createRemoteRepository: remoteRepositoryForWorkspace,
  });
