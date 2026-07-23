import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase/client.js', () => ({ supabase: {} }));

import { runIntegrityAudit } from './runIntegrityAudit.js';

const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const QUOTE_ID = '11111111-1111-4111-8111-111111111111';
const UPDATED_AT = '2026-07-22T12:00:00.000Z';

function cleanCollections(overrides = {}) {
  return {
    workspaces: [{ id: WORKSPACE_ID, name: 'ALUXOR / BosqueReal', updatedAt: UPDATED_AT }],
    quotes: [{
      id: QUOTE_ID,
      workspaceId: WORKSPACE_ID,
      folio: 'ALX-1',
      form: {},
      version: 1,
      updatedAt: UPDATED_AT,
    }],
    productionOrders: [],
    purchases: [],
    purchaseItems: [],
    ...overrides,
  };
}

function remoteRows() {
  return {
    workspaces: [{ id: WORKSPACE_ID, name: 'ALUXOR / BosqueReal', updated_at: UPDATED_AT }],
    quotes: [{
      id: QUOTE_ID,
      workspace_id: WORKSPACE_ID,
      folio: 'ALX-1',
      form_data: {},
      version: 1,
      updated_at: UPDATED_AT,
    }],
    production_orders: [],
    purchases: [],
    purchase_items: [],
  };
}

function readOnlyClient(rows = remoteRows()) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' } },
        error: null,
      })),
    },
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: rows[table] || [], error: null })),
      })),
    })),
  };
}

describe('runIntegrityAudit', () => {
  it('es la entrada única que consolida una auditoría limpia de solo lectura', async () => {
    const client = readOnlyClient();
    const report = await runIntegrityAudit({
      workspaceId: WORKSPACE_ID,
      localCollections: cleanCollections(),
      client,
      generatedAt: UPDATED_AT,
    });
    expect(report).toMatchObject({
      status: 'READY',
      workspaceId: WORKSPACE_ID,
      readiness: { status: 'READY', requiresLegacyRepair: false },
      scope: {
        localSource: 'provided_collections',
        remoteSource: 'authenticated_supabase_select',
      },
    });
    expect(report.findings).toEqual([]);
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
    expect(client.from).toHaveBeenCalledTimes(5);
    expect(Object.keys(client)).toEqual(['auth', 'from']);
  });

  it('bloquea 25.2D ante deuda real de versionado local', async () => {
    const local = cleanCollections();
    local.quotes[0].version = 0;
    const report = await runIntegrityAudit({
      workspaceId: WORKSPACE_ID,
      localCollections: local,
      client: readOnlyClient(),
      generatedAt: UPDATED_AT,
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'invalid_version', severity: 'ERROR', source: 'local',
    }));
    expect(report.recommendations[0]).toContain('No iniciar 25.2D');
  });

  it('bloquea sin consultar datos cuando falta autenticación', async () => {
    const client = readOnlyClient();
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const report = await runIntegrityAudit({
      workspaceId: WORKSPACE_ID,
      localCollections: cleanCollections(),
      client,
      generatedAt: UPDATED_AT,
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'remote_auth_required', severity: 'CRITICAL',
    }));
    expect(client.from).not.toHaveBeenCalled();
  });

  it('lee localStorage sin escribir y reporta JSON legacy malformado', async () => {
    const storage = {
      getItem: vi.fn((key) => (key === 'anunciapro.history' ? '{' : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const report = await runIntegrityAudit({
      workspaceId: WORKSPACE_ID,
      storage,
      client: readOnlyClient({
        workspaces: [{ id: WORKSPACE_ID, name: 'ALUXOR', updated_at: UPDATED_AT }],
      }),
      generatedAt: UPDATED_AT,
    });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'malformed_local_storage', severity: 'CRITICAL',
    }));
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });
});
