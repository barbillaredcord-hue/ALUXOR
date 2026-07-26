import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadOptimizationSessions,
  removeOptimizationSession,
  saveOptimizationSessions,
  upsertOptimizationSession,
} from './storage.js';
import { hydrateOptimizationSession } from './session.js';
import {
  localStorageMock,
  optimizationSessionFixture,
} from './testFixtures.js';

describe('Optimization Session Storage', () => {
  beforeEach(() => {
    globalThis.window = { localStorage: localStorageMock() };
  });

  it('persiste localmente y aísla por workspace', () => {
    const session = optimizationSessionFixture();
    saveOptimizationSessions('workspace-001', [session]);

    expect(loadOptimizationSessions('workspace-001')).toEqual([session]);
    expect(loadOptimizationSessions('workspace-002')).toEqual([]);
    expect(JSON.parse(
      window.localStorage.getItem('aluxor.optimizationSessions.workspace-001'),
    )).toMatchObject({ version: 1 });
  });

  it('deduplica por id y conserva la versión más nueva', () => {
    const current = optimizationSessionFixture();
    const newer = hydrateOptimizationSession({ ...current, version: 2 }).session;

    saveOptimizationSessions('workspace-001', [newer, current]);

    expect(loadOptimizationSessions('workspace-001')).toEqual([newer]);
  });

  it('migra el arreglo local del contrato transitorio v1', () => {
    const current = optimizationSessionFixture();
    const legacy = { ...current, contractVersion: 1 };
    delete legacy.workspaceId;
    delete legacy.version;
    delete legacy.lastModifiedBy;
    window.localStorage.setItem(
      'aluxor.optimizationSessions.workspace-001',
      JSON.stringify([legacy]),
    );

    const recovered = loadOptimizationSessions('workspace-001');

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      id: current.id,
      contractVersion: 2,
      workspaceId: 'workspace-001',
      version: 1,
    });
  });

  it('se recupera de JSON corrupto sin lanzar errores', () => {
    window.localStorage.setItem(
      'aluxor.optimizationSessions.workspace-001',
      '{invalid',
    );

    expect(loadOptimizationSessions('workspace-001')).toEqual([]);
  });

  it('realiza upsert y eliminación sin mutar la sesión', () => {
    const session = optimizationSessionFixture();
    const snapshot = JSON.stringify(session);
    const saved = upsertOptimizationSession('workspace-001', session);

    expect(saved).toEqual(session);
    expect(JSON.stringify(session)).toBe(snapshot);
    expect(removeOptimizationSession('workspace-001', session.id)).toEqual([]);
  });
});
