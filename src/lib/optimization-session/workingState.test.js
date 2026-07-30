import { describe, expect, it } from 'vitest';
import {
  reviseOptimizationSession,
} from './session.js';
import {
  optimizationSessionFixture,
} from './testFixtures.js';
import {
  clearOptimizationSessionWorkingState,
  closeOptimizationSessionWorkingState,
  confirmOptimizationSessionWorkingSave,
  createOptimizationSessionWorkingState,
  discardOptimizationSessionWorkingChanges,
  hasOptimizationSessionRemoteConflict,
  openOptimizationSessionWorkingState,
  optimizationSessionEditableSignature,
  prepareOptimizationSessionConflictOverwrite,
  prepareOptimizationSessionWorkingUpdate,
  reconcileOptimizationSessionWorkingState,
  updateOptimizationSessionWorkingDraft,
  updateOptimizationSessionWorkingInput,
} from './workingState.js';
import {
  optimizationSessionWorkingInputFromSession,
  sessionWithOptimizationWorkingInput,
} from './workingInput.js';

function revision(session, overrides = {}) {
  return reviseOptimizationSession(session, {
    changedAt: '2026-07-26T13:00:00.000Z',
    changedBy: 'user-002',
    ...overrides,
  }).session;
}

describe('Optimization Session working state', () => {
  it('abre una sesión limpia sin convertirla en activa', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    );
    expect(opened.opened).toBe(true);
    expect(opened.state).toMatchObject({
      openedSessionId: session.id,
      baseline: { version: session.version },
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
      status: 'clean',
    });
    expect(opened.state.baselineInput).toEqual(opened.state.workingInput);
    expect(opened.state).not.toHaveProperty('activeSessionId');
  });

  it('detecta cambios deterministas e ignora versionado, timestamps y durationMs', () => {
    const session = optimizationSessionFixture();
    const state = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    ).state;
    const changed = revision(session, {
      configuration: { source: 'quote-material', kerf: 0.4 },
    });
    const dirty = updateOptimizationSessionWorkingDraft(state, changed);

    expect(dirty.hasUnsavedChanges).toBe(true);
    expect(dirty.status).toBe('dirty');
    expect(optimizationSessionEditableSignature(session))
      .toBe(optimizationSessionEditableSignature(revision(session)));
    expect(optimizationSessionEditableSignature(session)).toBe(
      optimizationSessionEditableSignature(revision(session, {
        configuration: { ...session.configuration, durationMs: 8 },
        metadata: { ...session.metadata, durationMs: 21 },
      })),
    );
  });

  it('exige confirmación antes de descartar y abrir otra sesión', () => {
    const first = optimizationSessionFixture();
    const second = optimizationSessionFixture({
      id: 'optimization-session:second',
      executionId: 'execution-second',
      createdAt: '2026-07-26T13:00:00.000Z',
    });
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      first,
    ).state;
    const dirty = updateOptimizationSessionWorkingDraft(opened, revision(first, {
      metadata: { origin: 'changed' },
    }));
    const blocked = openOptimizationSessionWorkingState(dirty, second);
    const discarded = openOptimizationSessionWorkingState(
      dirty,
      second,
      { discardChanges: true },
    );

    expect(blocked.requiresConfirmation).toBe(true);
    expect(blocked.state.openedSessionId).toBe(first.id);
    expect(discarded.opened).toBe(true);
    expect(discarded.state.openedSessionId).toBe(second.id);
    expect(discarded.state.hasUnsavedChanges).toBe(false);
  });

  it('adopta Realtime limpio y preserva el borrador local ante conflicto', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    ).state;
    const remote = { ...revision(session), version: 2 };
    const refreshed = reconcileOptimizationSessionWorkingState(opened, [remote]);
    expect(refreshed.baseline.version).toBe(2);

    const dirty = updateOptimizationSessionWorkingDraft(opened, revision(session, {
      metadata: { origin: 'local' },
    }));
    const conflict = reconcileOptimizationSessionWorkingState(dirty, [remote]);
    expect(conflict.status).toBe('remote-update-pending');
    expect(conflict.draft.metadata.origin).toBe('local');
    expect(conflict.remoteUpdatePending.version).toBe(2);
  });

  it('Realtime entrega piezas y estrategia de workingInput a otra ventana', () => {
    const versionOne = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture(),
      {
        materialId: 'material-001',
        selectedPieceIds: ['piece-1'],
        selectedCandidateId: 'shelf-old',
        strategy: 'shelf',
      },
    );
    const windowB = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      versionOne,
    ).state;
    const versionTwo = sessionWithOptimizationWorkingInput({
      ...versionOne,
      version: 2,
    }, {
      ...windowB.workingInput,
      selectedPieceIds: ['piece-1', 'piece-2'],
      selectedCandidateId: 'best-fit-new',
      strategy: 'best-fit',
    });
    const reconciled = reconcileOptimizationSessionWorkingState(
      windowB,
      [versionTwo],
    );

    expect(reconciled).toMatchObject({
      baseline: { version: 2 },
      draft: { version: 2 },
      workingInput: {
        selectedPieceIds: ['piece-1', 'piece-2'],
        selectedCandidateId: 'best-fit-new',
        strategy: 'best-fit',
      },
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
    });
  });

  it('actualiza v1 → Realtime v2 → edición local usando expectedVersion 2 → v3', () => {
    const versionOne = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      versionOne,
    ).state;
    const versionTwo = {
      ...revision(versionOne, {
        metadata: { origin: 'remote-user-b' },
      }),
      version: 2,
    };
    const accepted = reconcileOptimizationSessionWorkingState(
      opened,
      [versionTwo],
    );
    const edited = updateOptimizationSessionWorkingInput(accepted, {
      ...accepted.workingInput,
      kerf: 0.5,
    }, {
      changedAt: '2026-07-26T14:00:00.000Z',
      changedBy: 'user-a',
    });
    const prepared = prepareOptimizationSessionWorkingUpdate(edited);
    const versionThree = {
      ...prepared.session,
      version: 3,
    };
    const saved = confirmOptimizationSessionWorkingSave(
      prepared.state,
      versionThree,
    );

    expect(accepted).toMatchObject({
      baseline: { version: 2 },
      draft: { version: 2 },
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
    });
    expect(edited).toMatchObject({
      baseline: { version: 2 },
      draft: { version: 2 },
      hasUnsavedChanges: true,
    });
    expect(prepared).toMatchObject({
      session: { version: 2 },
      expectedVersion: 2,
    });
    expect(saved).toMatchObject({
      baseline: { version: 3 },
      draft: { version: 3 },
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
    });
  });

  it('mantiene abierta y limpia una sesión durante cuatro actualizaciones consecutivas', () => {
    const original = optimizationSessionFixture();
    let state = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      original,
      {
        workingInput: {
          materialId: original.materialId,
          selectedPieceIds: ['piece-1', 'piece-2'],
          kerf: 0.3,
          thickness: 16,
          strategy: 'largest-first',
        },
      },
    ).state;
    const changes = [
      { kerf: 0.5 },
      { thickness: 18 },
      { strategy: 'input-order' },
      { selectedPieceIds: ['piece-1'] },
    ];

    changes.forEach((change, index) => {
      const expectedVersion = index + 1;
      state = updateOptimizationSessionWorkingInput(state, {
        ...state.workingInput,
        ...change,
      }, {
        changedAt: `2026-07-26T1${index + 4}:00:00.000Z`,
        changedBy: 'user-a',
      });
      expect(state).toMatchObject({
        openedSessionId: original.id,
        baseline: { version: expectedVersion },
        draft: { version: expectedVersion },
        hasUnsavedChanges: true,
        remoteUpdatePending: null,
        status: 'dirty',
      });

      const prepared = prepareOptimizationSessionWorkingUpdate(state);
      expect(prepared).toMatchObject({
        expectedVersion,
        session: { id: original.id, version: expectedVersion },
      });
      const saved = {
        ...prepared.session,
        version: expectedVersion + 1,
      };
      state = confirmOptimizationSessionWorkingSave(prepared.state, saved);
      expect(state).toMatchObject({
        openedSessionId: original.id,
        baseline: { version: expectedVersion + 1 },
        draft: { version: expectedVersion + 1 },
        hasUnsavedChanges: false,
        remoteUpdatePending: null,
        status: 'clean',
      });
      expect(state.workingInput).toEqual(state.baselineInput);
    });

    expect(state.draft.version).toBe(5);
  });

  it('alterna Realtime A → B → A → B hasta v5 sin perder baseline', () => {
    const versionOne = optimizationSessionFixture();
    let windowA = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      versionOne,
    ).state;
    let windowB = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      versionOne,
    ).state;

    function editAndSave(state, nextVersion, kerf) {
      const dirty = updateOptimizationSessionWorkingInput(state, {
        ...state.workingInput,
        kerf,
      }, {
        changedAt: `2026-07-26T1${nextVersion + 2}:00:00.000Z`,
        changedBy: nextVersion % 2 === 0 ? 'user-a' : 'user-b',
      });
      const prepared = prepareOptimizationSessionWorkingUpdate(dirty);
      expect(prepared.expectedVersion).toBe(nextVersion - 1);
      return confirmOptimizationSessionWorkingSave(prepared.state, {
        ...prepared.session,
        version: nextVersion,
      });
    }

    windowA = editAndSave(windowA, 2, 0.4);
    windowB = reconcileOptimizationSessionWorkingState(windowB, [windowA.draft]);
    windowB = editAndSave(windowB, 3, 0.5);
    windowA = reconcileOptimizationSessionWorkingState(windowA, [windowB.draft]);
    windowA = editAndSave(windowA, 4, 0.6);
    windowB = reconcileOptimizationSessionWorkingState(windowB, [windowA.draft]);
    windowB = editAndSave(windowB, 5, 0.7);
    windowA = reconcileOptimizationSessionWorkingState(windowA, [windowB.draft]);

    [windowA, windowB].forEach((state) => {
      expect(state).toMatchObject({
        openedSessionId: versionOne.id,
        baseline: { version: 5 },
        draft: { version: 5 },
        hasUnsavedChanges: false,
        remoteUpdatePending: null,
        status: 'clean',
      });
    });
  });

  it('una recarga anterior al guardado confirmado no revierte v2', () => {
    const versionOne = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      versionOne,
    ).state;
    const dirty = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      kerf: 0.5,
    }, {
      changedAt: '2026-07-26T14:00:00.000Z',
      changedBy: 'user-a',
    });
    const prepared = prepareOptimizationSessionWorkingUpdate(dirty);
    const confirmed = confirmOptimizationSessionWorkingSave(prepared.state, {
      ...prepared.session,
      version: 2,
    });
    const afterStaleReload = reconcileOptimizationSessionWorkingState(
      confirmed,
      [versionOne],
    );

    expect(afterStaleReload).toBe(confirmed);
    expect(afterStaleReload).toMatchObject({
      baseline: { version: 2 },
      draft: { version: 2 },
      hasUnsavedChanges: false,
    });
  });

  it('solo declara conflicto con versión remota mayor y cambios locales', () => {
    expect(hasOptimizationSessionRemoteConflict({
      baselineVersion: 2,
      remoteVersion: 2,
      hasUnsavedChanges: true,
    })).toBe(false);
    expect(hasOptimizationSessionRemoteConflict({
      baselineVersion: 2,
      remoteVersion: 3,
      hasUnsavedChanges: false,
    })).toBe(false);
    expect(hasOptimizationSessionRemoteConflict({
      baselineVersion: 2,
      remoteVersion: 3,
      hasUnsavedChanges: true,
    })).toBe(true);
  });

  it('ignora una revisión Realtime con la misma versión aunque cambie timestamp', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    ).state;
    const dirty = updateOptimizationSessionWorkingDraft(opened, revision(session, {
      metadata: { origin: 'local' },
    }));
    const sameVersion = revision(session, {
      changedAt: '2026-07-26T15:00:00.000Z',
      metadata: { origin: 'remote-same-version' },
    });

    const reconciled = reconcileOptimizationSessionWorkingState(
      dirty,
      [sameVersion],
    );

    expect(reconciled).toBe(dirty);
    expect(reconciled.remoteUpdatePending).toBeNull();
    expect(reconciled.status).toBe('dirty');
  });

  it('prepara sobrescritura solo contra la versión remota pendiente y limpia al guardar', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    ).state;
    const dirty = updateOptimizationSessionWorkingDraft(opened, revision(session, {
      metadata: { origin: 'local' },
    }));
    const remote = { ...revision(session), version: 2 };
    const conflict = reconcileOptimizationSessionWorkingState(dirty, [remote]);
    const overwriteDraft = revision(remote, {
      changedAt: '2026-07-26T16:00:00.000Z',
      metadata: { origin: 'local' },
    });
    const prepared = prepareOptimizationSessionConflictOverwrite(
      conflict,
      overwriteDraft,
    );
    const saved = { ...overwriteDraft, version: 3 };
    const clean = confirmOptimizationSessionWorkingSave(conflict, saved);

    expect(prepared).toMatchObject({
      session: { id: session.id, version: 2 },
      expectedVersion: 2,
    });
    expect(clean).toMatchObject({
      baseline: { version: 3 },
      hasUnsavedChanges: false,
      remoteUpdatePending: null,
      status: 'clean',
    });
  });

  it('limpia edición al eliminar y después de guardar', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
    ).state;
    expect(reconcileOptimizationSessionWorkingState(opened, []).openedSessionId)
      .toBeNull();
    expect(confirmOptimizationSessionWorkingSave(opened, session).hasUnsavedChanges)
      .toBe(false);
    expect(clearOptimizationSessionWorkingState().openedSessionId).toBeNull();
  });

  it('cerrar la sesión abierta limpia toda referencia temporal y Realtime no la reabre', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
      {
        workingInput: {
          materialId: session.materialId,
          selectedPieceIds: ['piece-1'],
          kerf: 0.3,
        },
      },
    ).state;
    const dirty = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      selectedPieceIds: ['piece-1', 'piece-2'],
    }, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
    });
    const conflicted = {
      ...dirty,
      remoteUpdatePending: { ...session, version: 2 },
      status: 'remote-update-pending',
    };
    const closed = closeOptimizationSessionWorkingState(conflicted, session.id);
    const afterRealtime = reconcileOptimizationSessionWorkingState(
      closed,
      [{ ...session, status: 'closed', version: 2 }],
    );

    expect(closed).toEqual(createOptimizationSessionWorkingState());
    expect(afterRealtime.openedSessionId).toBeNull();
    expect(afterRealtime.workingInput).toBeNull();
    expect(afterRealtime.baseline).toBeNull();
    expect(afterRealtime.hasUnsavedChanges).toBe(false);
    expect(afterRealtime.remoteUpdatePending).toBeNull();
  });

  it('cerrar y volver a abrir restaura selección y Best Fit desde la sesión', () => {
    const persisted = sessionWithOptimizationWorkingInput(
      optimizationSessionFixture(),
      {
        materialId: 'material-001',
        selectedPieceIds: ['piece-1', 'piece-2'],
        selectedCandidateId: 'best-fit-persisted',
        strategy: 'best-fit',
        pieceOrder: 'largest-first',
      },
    );
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      persisted,
    ).state;
    const closed = closeOptimizationSessionWorkingState(opened, persisted.id);
    const reopened = openOptimizationSessionWorkingState(
      closed,
      persisted,
    ).state;

    expect(reopened.workingInput).toMatchObject({
      selectedPieceIds: ['piece-1', 'piece-2'],
      selectedCandidateId: 'best-fit-persisted',
      strategy: 'best-fit',
      pieceOrder: 'largest-first',
    });
    expect(reopened.hasUnsavedChanges).toBe(false);
  });

  it('comparte 13 piezas y permite reducir a 11 con kerf 0.5 sin tocar actividad', () => {
    const session = optimizationSessionFixture();
    const selectedPieceIds = Array.from(
      { length: 13 },
      (_, index) => `piece-${index + 1}`,
    );
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
      {
        workingInput: {
          materialId: session.materialId,
          selectedPieceIds,
          formatWidth: 122,
          formatHeight: 244,
          kerf: 0.3,
          allowRotation: true,
        },
      },
    ).state;
    const changed = updateOptimizationSessionWorkingInput(opened, {
      ...optimizationSessionWorkingInputFromSession(opened.draft),
      selectedPieceIds: selectedPieceIds.slice(0, 11),
      kerf: 0.5,
    }, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
    });

    expect(optimizationSessionWorkingInputFromSession(opened.draft)).toMatchObject({
      selectedPieceIds: [...selectedPieceIds].sort((left, right) => (
        left.localeCompare(right)
      )),
      kerf: 0.3,
    });
    expect(optimizationSessionWorkingInputFromSession(changed.draft)).toMatchObject({
      selectedPieceIds: selectedPieceIds.slice(0, 11).sort((left, right) => (
        left.localeCompare(right)
      )),
      kerf: 0.5,
    });
    expect(changed.hasUnsavedChanges).toBe(true);
    expect(changed).not.toHaveProperty('activeSessionId');
    const restored = updateOptimizationSessionWorkingInput(changed, {
      ...optimizationSessionWorkingInputFromSession(changed.draft),
      selectedPieceIds,
      kerf: 0.3,
    }, {
      changedAt: '2026-07-26T14:00:00.000Z',
      changedBy: 'user-002',
    });
    expect(restored.hasUnsavedChanges).toBe(false);
    const discarded = discardOptimizationSessionWorkingChanges(changed);
    expect(optimizationSessionWorkingInputFromSession(discarded.draft)).toMatchObject({
      selectedPieceIds: [...selectedPieceIds].sort((left, right) => (
        left.localeCompare(right)
      )),
      kerf: 0.3,
    });
    expect(discarded.hasUnsavedChanges).toBe(false);
  });

  it('añadir o quitar una referencia cambia la firma dirty', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
      {
        workingInput: {
          materialId: session.materialId,
          selectedPieceIds: ['piece-1', 'piece-2'],
          kerf: 0.3,
        },
      },
    ).state;
    const added = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      selectedPieceIds: ['piece-2', 'piece-3', 'piece-1'],
    }, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
    });
    const removed = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      selectedPieceIds: ['piece-1'],
    }, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
    });

    expect(added.workingInput.selectedPieceIds)
      .toEqual(['piece-1', 'piece-2', 'piece-3']);
    expect(added.hasUnsavedChanges).toBe(true);
    expect(removed.hasUnsavedChanges).toBe(true);
  });

  it('conserva el espesor, marca dirty al cambiarlo y limpia dirty al restaurarlo', () => {
    const session = optimizationSessionFixture();
    const opened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      session,
      {
        workingInput: {
          materialId: session.materialId,
          selectedPieceIds: ['piece-1'],
          thickness: 16,
        },
      },
    ).state;
    const changed = updateOptimizationSessionWorkingInput(opened, {
      ...opened.workingInput,
      thickness: 15,
    }, {
      changedAt: '2026-07-26T13:00:00.000Z',
      changedBy: 'user-002',
    });
    const restored = updateOptimizationSessionWorkingInput(changed, {
      ...changed.workingInput,
      thickness: 16,
    }, {
      changedAt: '2026-07-26T14:00:00.000Z',
      changedBy: 'user-002',
    });
    const saved = confirmOptimizationSessionWorkingSave(
      changed,
      changed.draft,
    );
    const reopened = openOptimizationSessionWorkingState(
      createOptimizationSessionWorkingState(),
      saved.draft,
    ).state;
    const discarded = discardOptimizationSessionWorkingChanges(changed);

    expect(opened.workingInput.thickness).toBe(16);
    expect(changed.workingInput.thickness).toBe(15);
    expect(changed.hasUnsavedChanges).toBe(true);
    expect(restored.hasUnsavedChanges).toBe(false);
    expect(saved.hasUnsavedChanges).toBe(false);
    expect(reopened.workingInput.thickness).toBe(15);
    expect(discarded.workingInput.thickness).toBe(16);
  });
});
