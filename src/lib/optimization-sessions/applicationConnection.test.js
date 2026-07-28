import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const hookSource = source('../../hooks/useOptimizationSessions.js');
const sectionSource = source('../../sections/OptimizationSessionsSection.jsx');
const appSource = source('../../app/App.jsx');
const providerSource = source('./repositoryProvider.js');
const repositorySource = source('./applicationRepository.js');
const syncEngineSource = source('./syncEngine.js');

describe('conexión React de Optimization Sessions', () => {
  it('el Hook depende del Application Repository y no conoce Supabase', () => {
    expect(hookSource).toContain('OptimizationSessionApplicationRepository');
    expect(hookSource).toContain(
      'repository.getSessionsByQuote(workspaceId, quoteId)',
    );
    expect(hookSource).toContain('repository.createSession(workspaceId, input)');
    expect(hookSource).toContain(
      'repository.updateSession(workspaceId, session, expectedVersion)',
    );
    expect(hookSource).not.toMatch(/supabase/i);
  });

  it('la UI no importa ni utiliza Supabase directamente', () => {
    expect(sectionSource).not.toMatch(/supabase/i);
    expect(sectionSource).not.toContain('remoteAdapter');
    expect(sectionSource).not.toContain('remoteRepository');
  });

  it('App monta el Hook con workspace y Quote activos', () => {
    expect(appSource).toContain(
      "import useOptimizationSessions from '../hooks/useOptimizationSessions.js';",
    );
    expect(appSource).toMatch(
      /useOptimizationSessions\(\{\s*workspaceId: activeWorkspace\?\.id \|\| null,\s*quoteId: activeQuoteIdentity\?\.id \|\| null,\s*\}\);/,
    );
  });

  it('repositoryProvider compone toda la infraestructura', () => {
    expect(providerSource).toContain(
      "import { supabase } from '../supabase/client.js';",
    );
    expect(providerSource).toContain(
      'createOptimizationSessionSupabaseClient({',
    );
    expect(providerSource).toContain(
      'createRemoteOptimizationRepository(client)',
    );
    expect(providerSource).toContain(
      'createOptimizationSessionApplicationRepository({',
    );
    expect(providerSource).toContain('createOptimizationSessionSyncEngine({');
    expect(providerSource).toContain(
      'OptimizationSessionPendingOperationsRepository',
    );
    expect(providerSource).toContain('createBrowserConnectivityProvider()');
    expect(providerSource).toContain(
      'createOptimizationSessionRealtimeSubscription({',
    );
    expect(providerSource).toContain(
      'subscribeToRemoteEvents: realtimeSubscription.subscribe',
    );
  });

  it('Application Repository delega en Sync Engine', () => {
    expect(repositorySource).toContain('syncEngine[method](...args)');
    expect(repositorySource).not.toContain('createRemoteRepository');
    expect(repositorySource).not.toContain('localRepository');
  });

  it('incorpora Realtime sin polling ni sincronización automática', () => {
    const connectionSource = [
      hookSource,
      providerSource,
      repositorySource,
      syncEngineSource,
    ].join('\n');

    expect(hookSource).toContain('repository.subscribeToChanges(');
    expect(hookSource).not.toMatch(/supabase/i);
    expect(repositorySource).not.toMatch(/supabase/i);
    expect(connectionSource).not.toContain('setInterval');
    expect(connectionSource).not.toContain('addEventListener');
    expect(connectionSource).not.toMatch(/serviceWorker|BackgroundSync/i);
    expect(hookSource).not.toContain('syncPendingOperations');
  });

  it('el Hook conserva sus operaciones públicas', () => {
    [
      'sessions',
      'summary',
      'latestSession',
      'error',
      'reload',
      'createSession',
      'updateSession',
      'deleteSession',
      'setActiveSession',
      'closeSession',
      'reopenSession',
      'compareSessions',
      'realtimeStatus',
    ].forEach((field) => {
      expect(hookSource).toMatch(new RegExp(`\\b${field}\\b`));
    });
  });

  it('el Hook limpia Realtime y conserva una suscripción al cambiar workspace', () => {
    expect(hookSource).toMatch(
      /const unsubscribe = repository\.subscribeToChanges\([\s\S]*?workspaceId/,
    );
    expect(hookSource).toContain(
      "if (typeof unsubscribe === 'function') unsubscribe();",
    );
    expect(hookSource).toContain('}, [repository, workspaceId]);');
  });
});
