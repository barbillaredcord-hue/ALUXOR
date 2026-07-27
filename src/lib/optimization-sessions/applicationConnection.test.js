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

  it('el proveedor compone Repository, Adapter remoto y cliente compartido', () => {
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
  });

  it('la conexión no incorpora cola, merge, Sync Engine ni Realtime', () => {
    const connectionSource = [
      hookSource,
      providerSource,
      repositorySource,
    ].join('\n');

    expect(connectionSource).not.toMatch(/offlineQueue|OfflineQueue/);
    expect(connectionSource).not.toMatch(/\bmerge\b/i);
    expect(connectionSource).not.toMatch(/\brealtime\b/i);
    expect(connectionSource).not.toMatch(/\bSync Engine\b/i);
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
    ].forEach((field) => {
      expect(hookSource).toMatch(new RegExp(`\\b${field}\\b`));
    });
  });
});
