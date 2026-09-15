import { describe, expect, it } from 'vitest';
import { historyForWorkspace } from './useQuotes.js';

describe('frontera de workspace de cotizaciones', () => {
  it('solo conserva historial del workspace activo', () => {
    const items = [
      { id: 'a', workspaceId: 'workspace-a', producto: 'Proyecto A' },
      { id: 'b', workspace_id: 'workspace-b', producto: 'Proyecto B' },
      { id: 'legacy', producto: 'Sin workspace' },
    ];

    expect(historyForWorkspace(items, 'workspace-b')).toEqual([items[1]]);
    expect(historyForWorkspace(items, 'workspace-a')).toEqual([items[0]]);
  });

  it('no adopta historial cuando no existe workspace activo', () => {
    expect(historyForWorkspace([{ id: 'a', workspaceId: 'workspace-a' }], '')).toEqual([]);
    expect(historyForWorkspace(null, 'workspace-a')).toEqual([]);
  });
});
