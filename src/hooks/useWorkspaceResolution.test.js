import { describe, expect, it } from 'vitest';
import { shouldBootstrapWorkspace } from './useWorkspace.js';

const workspace = (id, isShared) => ({ workspace: { id, is_shared: isShared }, error: null });

describe('resolución de workspace', () => {
  it('conserva el workspace compartido y el no compartido', () => {
    expect(shouldBootstrapWorkspace(workspace('shared', true), { data: [{ workspace: { id: 'shared' } }], error: null })).toBe(false);
    expect(shouldBootstrapWorkspace(workspace('qa', false), { data: [{ workspace: { id: 'qa' } }], error: null })).toBe(false);
  });

  it('solo ejecuta bootstrap cuando no hay memberships resolubles', () => {
    expect(shouldBootstrapWorkspace({ workspace: null, error: null }, { data: [], error: null })).toBe(true);
    expect(shouldBootstrapWorkspace({ workspace: null, error: null }, { data: [{ workspace: { id: 'stale' } }], error: null })).toBe(false);
    expect(shouldBootstrapWorkspace({ workspace: null, error: new Error('network') }, { data: [], error: null })).toBe(false);
    expect(shouldBootstrapWorkspace({ workspace: null, error: null }, { data: [], error: new Error('network') })).toBe(false);
  });
});
