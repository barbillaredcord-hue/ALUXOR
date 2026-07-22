import { supabase } from '../supabase/client.js';
import { auditLocalIntegrity } from './auditLocalIntegrity.js';
import { createIntegrityFinding } from './integrityReport.js';

const TABLES = Object.freeze({
  quotes: {
    table: 'quotes',
    columns: 'id, workspace_id, folio',
  },
  productionOrders: {
    table: 'production_orders',
    columns: 'id, workspace_id, quote_id, folio',
  },
  purchases: {
    table: 'purchases',
    columns: 'id, workspace_id, production_order_id, quote_id, folio',
  },
  purchaseItems: {
    table: 'purchase_items',
    columns: 'id, workspace_id, purchase_id, source_type, source_id',
  },
});

const DOMAIN_BY_ENTITY_TYPE = Object.freeze({
  quote: 'quotes',
  productionOrder: 'productionOrders',
  purchase: 'purchases',
  purchaseItem: 'purchaseItems',
});

function errorText(error) {
  return `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLocaleLowerCase('en-US');
}

export function classifyRemoteAuditError(error) {
  const code = String(error?.code || '').toLocaleUpperCase('en-US');
  const description = errorText(error);
  if (code === '42501' || description.includes('permission denied')) return 'permission_denied';
  if (
    code === '42P01'
    || code === 'PGRST205'
    || description.includes('does not exist')
    || description.includes('schema cache')
  ) return 'table_unavailable';
  return 'query_failed';
}

function auditErrorFinding(domain, table, category, error) {
  return createIntegrityFinding({
    severity: 'warning',
    code: `remote_${category}`,
    entityType: domain,
    source: 'remote',
    message: `No se pudo auditar ${table}: ${category}.`,
    metadata: {
      table,
      errorCode: error?.code || null,
      errorMessage: error?.message || 'Error de consulta',
    },
  });
}

function resolveArguments(input, options) {
  if (typeof input === 'string') {
    return { workspaceId: input.trim(), client: options?.client || supabase };
  }
  return {
    workspaceId: String(input?.workspaceId || '').trim(),
    client: input?.client || options?.client || supabase,
  };
}

export async function auditRemoteIntegrity(input = {}, options = {}) {
  const { workspaceId, client } = resolveArguments(input, options);
  if (!workspaceId) {
    return {
      source: 'remote',
      workspaceId: null,
      status: 'unavailable',
      records: { quotes: [], productionOrders: [], purchases: [], purchaseItems: [] },
      recordCounts: { quotes: 0, productionOrders: 0, purchases: 0, purchaseItems: 0 },
      totalRecords: 0,
      tables: {},
      findings: [createIntegrityFinding({
        code: 'missing_workspace_id',
        entityType: 'remoteAudit',
        source: 'remote',
        message: 'La auditoría remota requiere workspaceId.',
      })],
      valid: false,
    };
  }

  const records = { quotes: [], productionOrders: [], purchases: [], purchaseItems: [] };
  const tables = Object.fromEntries(Object.entries(TABLES).map(([domain, config]) => [
    domain,
    { table: config.table, status: 'pending', recordCount: 0, error: null },
  ]));
  const availabilityFindings = [];

  await Promise.all(Object.entries(TABLES).map(async ([domain, config]) => {
    try {
      const { data, error } = await client
        .from(config.table)
        .select(config.columns)
        .eq('workspace_id', workspaceId);

      if (error) {
        const category = classifyRemoteAuditError(error);
        tables[domain] = {
          table: config.table,
          status: category,
          recordCount: 0,
          error: { code: error.code || null, message: error.message || 'Error de consulta' },
        };
        availabilityFindings.push(auditErrorFinding(domain, config.table, category, error));
        return;
      }

      records[domain] = Array.isArray(data) ? data : [];
      tables[domain] = {
        table: config.table,
        status: 'completed',
        recordCount: records[domain].length,
        error: null,
      };
    } catch (error) {
      const category = classifyRemoteAuditError(error);
      tables[domain] = {
        table: config.table,
        status: category,
        recordCount: 0,
        error: { code: error?.code || null, message: error?.message || 'Error de consulta' },
      };
      availabilityFindings.push(auditErrorFinding(domain, config.table, category, error));
    }
  }));

  const completedCount = Object.values(tables).filter((table) => table.status === 'completed').length;
  const status = completedCount === Object.keys(TABLES).length
    ? 'completed'
    : completedCount === 0 ? 'unavailable' : 'partial';
  const integrity = auditLocalIntegrity(records);
  const conclusiveIntegrityFindings = integrity.findings.filter((finding) => {
    if (!['orphan_reference', 'workspace_mismatch'].includes(finding.code)) return true;
    const parentDomain = DOMAIN_BY_ENTITY_TYPE[finding.metadata?.parentType];
    return !parentDomain || tables[parentDomain]?.status === 'completed';
  });
  const findings = [
    ...conclusiveIntegrityFindings.map((finding) => ({ ...finding, source: 'remote' })),
    ...availabilityFindings,
  ].sort((left, right) => (
    left.code.localeCompare(right.code)
    || left.entityType.localeCompare(right.entityType)
  ));

  return {
    source: 'remote',
    workspaceId,
    status,
    records,
    recordCounts: integrity.recordCounts,
    totalRecords: integrity.totalRecords,
    tables,
    findings,
    valid: status === 'completed' && findings.every((finding) => finding.severity !== 'error'),
  };
}

export const RemoteIntegrityAuditor = {
  auditRemoteIntegrity,
  classifyRemoteAuditError,
};
