import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

const hookSource = source('../../hooks/useOptimizationSessions.js');
const sectionSource = source('../../sections/OptimizationSessionsSection.jsx');
const cutOptimizerSource = source('../../sections/CutOptimizerSection.jsx');
const materialCalculatorSource = source(
  '../../components/material-calculator/MaterialCalculator.jsx',
);
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
    expect(cutOptimizerSource).not.toMatch(/supabase/i);
  });

  it('App monta el Hook con workspace y Quote activos', () => {
    expect(appSource).toContain(
      "import useOptimizationSessions from '../hooks/useOptimizationSessions.js';",
    );
    expect(appSource).toMatch(
      /const optimizationSessions = useOptimizationSessions\(\{\s*workspaceId: activeWorkspace\?\.id \|\| null,\s*quoteId: activeQuoteIdentity\?\.id \|\| null,\s*\}\);/,
    );
    expect(appSource).toContain(
      'optimizationSessions={optimizationSessions}',
    );
    expect(appSource.match(/optimizationSessions=\{optimizationSessions\}/g))
      .toHaveLength(1);
    expect(appSource).toContain('onActivateSessionReference=');
    expect(appSource).toContain(
      'onActivateSessionReference={updateMaterialOptimizationSession}',
    );
    expect(appSource).toContain(
      'optimizationSessionInput={optimizationSessions.openedSessionInput}',
    );
    expect(appSource).toContain('onApplySelectionToSession=');
    expect(appSource).toContain(
      'optimizationSessions.setOpenedSessionInput(input,',
    );
    expect(appSource).toContain(
      'onApplySelectionToLegacy={updateLegacyOptimizationInput}',
    );
    expect(appSource).toContain(
      'calculatorTransfer={legacyCalculatorTransfer}',
    );
    expect(appSource).not.toMatch(
      /onActivateSessionReference=\{[\s\S]{0,300}updateMaterialItem\(/,
    );
  });

  it('el Smart Cut Optimizer conecta únicamente la API pública del Hook', () => {
    [
      'createSession: optimizationSessions.createSession',
      'optimizationSessions.updateOpenedSession',
      'deleteSession: optimizationSessions.deleteSession,',
      'optimizationSessions.setActiveSession(',
      'optimizationSessions.closeSession(',
      'optimizationSessions.reopenSession(',
      'optimizationSessions.reload',
      'optimizationSessions.sessions',
      'optimizationSessions.latestSession',
      'optimizationSessions.summary',
      'optimizationSessions.realtimeStatus',
      'optimizationSessions.openedSessionId',
      'optimizationSessions.hasUnsavedChanges',
    ].forEach((contract) => expect(cutOptimizerSource).toContain(contract));
    const saveHandler = cutOptimizerSource.match(
      /async function saveCurrentSession\(\) \{[\s\S]*?\n  \}/,
    )?.[0];
    expect(saveHandler).toContain('persistAndOpenOptimizationSession({');
    expect(saveHandler).toContain(
      'createSession: optimizationSessions.createSession',
    );
    expect(saveHandler).not.toContain('optimizeCuts(');
  });

  it('la integración visual no copia colecciones ni usa alert()', () => {
    expect(sectionSource).not.toMatch(
      /useState\(sessions|useState\(summary|useState\(latestSession/,
    );
    expect(sectionSource).not.toMatch(/\balert\s*\(/);
    expect(cutOptimizerSource).not.toMatch(/\balert\s*\(/);
    expect(sectionSource).not.toMatch(/\bisActive\b/);
    expect(cutOptimizerSource).toContain(
      'deleteOptimizationSessionAndClearActiveReference',
    );
  });

  it('Aplicar selección comparte working state sin usar Quote como puente', () => {
    const handler = materialCalculatorSource.match(
      /function applySelectionToWorkingSession\(\) \{[\s\S]*?\n  \}/,
    )?.[0];
    expect(handler).toContain('onApplySelectionToSession(');
    expect(handler).toContain('onApplySelectionToLegacy?.(');
    expect(handler).not.toContain('onApply?.(');
    expect(appSource).toContain(
      'optimizationSessionInput={optimizationSessions.openedSessionInput}',
    );
    expect(cutOptimizerSource).toContain(
      'const openedSessionInput = optimizationSessions?.openedSessionInput',
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
      'openedSessionId',
      'openedSession',
      'hasUnsavedChanges',
      'remoteUpdatePending',
      'openedSessionInput',
      'openSession',
      'setOpenedSessionDraft',
      'setOpenedSessionInput',
      'discardOpenedSessionChanges',
      'updateOpenedSession',
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

  it('cerrar una sesión limpia solo el working state temporal', () => {
    expect(hookSource).toContain(
      'closeOptimizationSessionWorkingState(',
    );
    expect(hookSource).toMatch(
      /closeSession: \(sessionId, options\) => run\([\s\S]*?repository\.closeSession[\s\S]*?closeOptimizationSessionWorkingState/,
    );
    const closeContract = hookSource.match(
      /closeSession: \(sessionId, options\) => run\([\s\S]*?\n    \),/,
    )?.[0];
    expect(closeContract).not.toContain('activeSessionId');
    expect(closeContract).not.toContain('setActiveSession');
  });
});
