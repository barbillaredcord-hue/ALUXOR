import {
  createOptimizationSessionRepository,
} from '../optimization-session/repository.js';
import {
  OptimizationSessionStorage,
} from '../optimization-session/storage.js';

const NOOP_OFFLINE_QUEUE = Object.freeze({
  enqueue() {
    return null;
  },
});

export function createOptimizationSessionLocalSyncRepository({
  repository = createOptimizationSessionRepository({
    storage: OptimizationSessionStorage,
    offlineQueue: NOOP_OFFLINE_QUEUE,
  }),
  storage = OptimizationSessionStorage,
} = {}) {
  function cacheSession(workspaceId, session) {
    return { data: storage.upsert(workspaceId, session), error: null };
  }

  function removeCachedSession(workspaceId, sessionId) {
    storage.remove(workspaceId, sessionId);
    return { data: true, error: null };
  }

  function replaceQuoteCache(
    workspaceId,
    quoteId,
    remoteSessions,
    preservedEntityIds = [],
  ) {
    const preservedIds = new Set(preservedEntityIds);
    const current = storage.load(workspaceId);
    const retained = current.filter((session) => session.quoteId !== quoteId);
    const pending = current.filter((session) => (
      session.quoteId === quoteId && preservedIds.has(session.id)
    ));
    const byId = new Map(retained.map((session) => [session.id, session]));
    remoteSessions.forEach((session) => byId.set(session.id, session));
    pending.forEach((session) => byId.set(session.id, session));
    return {
      data: storage.replaceWorkspace(workspaceId, [...byId.values()]),
      error: null,
    };
  }

  return Object.freeze({
    ...repository,
    cacheSession,
    removeCachedSession,
    replaceQuoteCache,
  });
}

export const OptimizationSessionLocalSyncRepository =
  createOptimizationSessionLocalSyncRepository();
