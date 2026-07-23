import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase/client.js', () => ({ supabase: {} }));

import { auditRemoteIntegrity, classifyRemoteAuditError } from './auditRemoteIntegrity.js';

function clientWith(results) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' } },
        error: null,
      })),
    },
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
        eq: vi.fn(async () => results[table] || { data: [], error: null }),
      })),
    })),
  };
}

describe('auditRemoteIntegrity', () => {
  it('continúa ante un error parcial y clasifica permiso denegado', async () => {
    const client = clientWith({
      quotes: { data: [], error: null },
      production_orders: { data: [], error: null },
      purchases: { data: null, error: { code: '42501', message: 'permission denied' } },
      purchase_items: { data: [], error: null },
    });
    const report = await auditRemoteIntegrity({ workspaceId: 'ws-a', client });
    expect(report.status).toBe('partial');
    expect(report.tables.purchases.status).toBe('permission_denied');
    expect(report.tables.quotes.status).toBe('completed');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'remote_permission_denied', source: 'remote',
    }));
    expect(client.from).toHaveBeenCalledTimes(5);
  });

  it('distingue tabla no disponible de consulta fallida', () => {
    expect(classifyRemoteAuditError({ code: '42P01' })).toBe('table_unavailable');
    expect(classifyRemoteAuditError({ code: 'XX000' })).toBe('query_failed');
  });

  it('marca auditoría completada cuando las cuatro lecturas terminan', async () => {
    const report = await auditRemoteIntegrity({
      workspaceId: 'ws-a',
      client: clientWith({}),
    });
    expect(report.status).toBe('completed');
    expect(Object.values(report.tables).every((table) => table.status === 'completed')).toBe(true);
  });

  it('marca unavailable cuando ninguna tabla está disponible', async () => {
    const unavailable = { data: null, error: { code: 'PGRST205', message: 'schema cache' } };
    const report = await auditRemoteIntegrity({
      workspaceId: 'ws-a',
      client: clientWith({
        workspaces: unavailable,
        quotes: unavailable,
        production_orders: unavailable,
        purchases: unavailable,
        purchase_items: unavailable,
      }),
    });
    expect(report.status).toBe('unavailable');
    expect(Object.values(report.tables).every((table) => table.status === 'table_unavailable')).toBe(true);
  });

  it('no declara huérfano si la tabla padre no pudo auditarse', async () => {
    const report = await auditRemoteIntegrity({
      workspaceId: 'ws-a',
      client: clientWith({
        quotes: { data: null, error: { code: '42501', message: 'permission denied' } },
        production_orders: {
          data: [{
            id: '33333333-3333-4333-8333-333333333333',
            workspace_id: 'ws-a',
            quote_id: '11111111-1111-4111-8111-111111111111',
          }],
          error: null,
        },
      }),
    });
    expect(report.findings.some((finding) => finding.code === 'orphan_reference')).toBe(false);
    expect(report.status).toBe('partial');
  });

  it('no consulta tablas si no existe una sesión autenticada', async () => {
    const client = clientWith({});
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const report = await auditRemoteIntegrity({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      client,
    });
    expect(report.status).toBe('unavailable');
    expect(report.findings).toContainEqual(expect.objectContaining({
      code: 'remote_auth_required', severity: 'critical',
    }));
    expect(client.from).not.toHaveBeenCalled();
  });
});
