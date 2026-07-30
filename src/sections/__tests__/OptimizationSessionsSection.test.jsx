import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  confirmOptimizationSessionUpdate,
  optimizationSessionUpdateAvailability,
} from '../OptimizationSessionsSection.jsx';
import OptimizationSessionsSection from '../OptimizationSessionsSection.jsx';
import {
  getOptimizationSessionsSummary,
} from '../../lib/optimization-session/summary.js';
import {
  optimizationSessionFixture,
} from '../../lib/optimization-session/testFixtures.js';

function renderSessions(overrides = {}) {
  const opened = optimizationSessionFixture({
    id: 'session-opened',
    materialId: 'material-opened',
    metadata: {
      materialName: 'Material abierto',
      usedArea: 10000,
      utilization: 100,
      wasteArea: 0,
      sheetsRequired: 1,
      thickness: 15,
      strategy: 'best-fit',
      optimizationStatus: 'valid',
    },
  });
  const active = optimizationSessionFixture({
    id: 'session-active',
    materialId: 'material-active',
    metadata: { materialName: 'Material activo' },
  });
  const sessions = [opened, active];
  return renderToStaticMarkup(
    <OptimizationSessionsSection
      sessions={sessions}
      summary={getOptimizationSessionsSummary(sessions)}
      activeSessionId={active.id}
      openedSessionId={opened.id}
      openedSession={opened}
      hasUnsavedChanges
      connection={{ label: 'Sincronizado', tone: 'connected' }}
      onOpen={() => ({ opened: true })}
      onUpdate={() => Promise.resolve({ data: opened, error: null })}
      onDiscardChanges={() => {}}
      onSetActive={() => {}}
      decimal={(value) => String(value)}
      {...overrides}
    />,
  );
}

describe('OptimizationSessionsSection', () => {
  it('distingue sesión abierta, sesión activa y cambios sin guardar', () => {
    const markup = renderSessions();

    expect(markup).toContain('Material abierto');
    expect(markup).toContain('Material activo');
    expect(markup.match(/>Abierta</g)).toHaveLength(2);
    expect(markup.match(/optimization-session-badge is-active/g)).toHaveLength(1);
    expect(markup).toContain('Cambios sin guardar');
    expect(markup).toContain('Descartar cambios');
    expect(markup).toContain('La sesión abierta se edita aquí; la activa alimenta la cotización.');
    expect(markup).toContain('Optimización válida');
    expect(markup).toContain('best-fit');
    expect(markup).toContain('15 mm');
    expect(markup).toContain('Actualizar sesión');
    expect(markup).not.toContain('Confirmar actualización');
    expect(markup).not.toContain('Sobrescribir');
  });

  it('renderiza dos sesiones del mismo Quote y material sin deduplicarlas', () => {
    const first = optimizationSessionFixture({
      id: 'session-first',
      executionId: 'execution-first',
      materialId: 'material-shared',
      inputSignature: 'same-input-signature',
      metadata: { materialName: 'Material compartido' },
    });
    const second = optimizationSessionFixture({
      id: 'session-second',
      executionId: 'execution-second',
      materialId: 'material-shared',
      inputSignature: 'same-input-signature',
      metadata: { materialName: 'Material compartido' },
    });
    const sessions = [first, second];
    const markup = renderSessions({
      sessions,
      summary: getOptimizationSessionsSummary(sessions),
      openedSessionId: null,
      openedSession: null,
      hasUnsavedChanges: false,
    });

    expect(markup.match(/Material compartido/g)).toHaveLength(2);
    expect(markup.match(/<li/g)).toHaveLength(2);
  });

  it('deshabilita actualización sin sesión abierta, sin cambios y en solo lectura', () => {
    expect(optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: null,
      hasUnsavedChanges: true,
    }).allowed).toBe(false);
    expect(optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: 'session-1',
      hasUnsavedChanges: false,
    }).allowed).toBe(false);
    expect(optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: 'session-1',
      hasUnsavedChanges: true,
      readOnly: true,
    }).allowed).toBe(false);
    expect(renderSessions({
      hasUnsavedChanges: false,
    })).toContain('title="No hay cambios para guardar"');
  });

  it('bloquea actualización ante un cambio remoto pendiente', () => {
    const availability = optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: 'session-1',
      hasUnsavedChanges: true,
      remoteUpdatePending: { id: 'session-1', version: 2 },
    });

    expect(availability).toEqual({
      allowed: false,
      reason: 'Existe una actualización remota pendiente',
    });
    expect(renderSessions({
      remoteUpdatePending: { id: 'session-opened', version: 2 },
      baselineVersion: 1,
    })).toContain('Tus cambios locales no se sobrescribieron');
  });

  it('bloquea actualización si el resultado visible no corresponde al working input', () => {
    expect(optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: 'session-1',
      hasUnsavedChanges: true,
      currentResultCompatible: false,
      currentResultCompatibilityReason: 'El resultado recalculado no es físicamente válido.',
    })).toEqual({
      allowed: false,
      reason: 'El resultado recalculado no es físicamente válido.',
    });
    const markup = renderSessions({
      currentResultCompatible: false,
      currentResultCompatibilityReason: 'El resultado recalculado no es físicamente válido.',
    });
    expect(markup).toContain('role="status"');
    expect(markup).toContain('El resultado recalculado no es físicamente válido.');
    expect(optimizationSessionUpdateAvailability({
      sessionId: 'session-1',
      openedSessionId: 'session-1',
      hasUnsavedChanges: true,
      currentResultCompatible: true,
    }).allowed).toBe(true);
  });

  it('solo ejecuta la sobrescritura remota después de confirmar', async () => {
    const update = vi.fn().mockResolvedValue({ data: { id: 'session-1' }, error: null });

    expect(await confirmOptimizationSessionUpdate({
      confirmed: false,
      onUpdate: update,
    })).toEqual({ updated: false, result: null });
    expect(update).not.toHaveBeenCalled();

    const confirmed = await confirmOptimizationSessionUpdate({
      confirmed: true,
      onUpdate: update,
    });
    expect(confirmed.updated).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('muestra confirmación únicamente ante versión remota mayor y dirty', () => {
    const conflict = renderSessions({
      baselineVersion: 1,
      remoteUpdatePending: { id: 'session-opened', version: 2 },
    });
    const sameVersion = renderSessions({
      baselineVersion: 2,
      remoteUpdatePending: { id: 'session-opened', version: 2 },
    });

    expect(conflict).toContain('Confirmar actualización');
    expect(conflict).toContain('Sobrescribir Material abierto');
    expect(sameVersion).toContain('Actualizar sesión');
    expect(sameVersion).not.toContain('Confirmar actualización');
    expect(sameVersion).not.toContain('Sobrescribir');
  });

  it('no contiene una referencia activa paralela ni acción para duplicar', () => {
    const markup = renderSessions();

    expect(markup).not.toContain('Duplicar');
    expect(markup).not.toContain('isActive');
  });

  it('cerrar la referencia temporal elimina Abierta pero conserva Activa', () => {
    const markup = renderSessions({
      openedSessionId: null,
      openedSession: null,
      hasUnsavedChanges: false,
    });

    expect(markup).not.toContain('optimization-session-badge is-opened');
    expect(markup).toContain('optimization-session-badge is-active');
    expect(markup).toContain('No hay una sesión abierta');
    expect(markup).toContain('title="Abre esta sesión para actualizarla"');
  });
});
