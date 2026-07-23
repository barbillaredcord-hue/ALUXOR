import { supabase } from '../supabase/client.js';
import { auditLocalIntegrity } from './auditLocalIntegrity.js';
import { auditRemoteIntegrity } from './auditRemoteIntegrity.js';
import { buildIntegrityReport } from './buildIntegrityReport.js';
import { normalizeEntityId } from './entityIdentity.js';
import { createIntegrityFinding } from './integrityReport.js';

const LOCAL_KEYS = Object.freeze({
  quotes: 'anunciapro.history',
  productionOrders: 'aluxor.productionOrders',
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function storageAvailable(storage) {
  return Boolean(storage) && typeof storage.getItem === 'function';
}

function readJson(storage, key, fallback, findings) {
  if (!storageAvailable(storage)) return fallback;
  const raw = storage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    findings.push(createIntegrityFinding({
      severity: 'critical',
      code: 'malformed_local_storage',
      entityType: 'localStorage',
      source: 'local',
      message: `No se pudo interpretar ${key} sin modificarlo.`,
      metadata: { key, errorMessage: error?.message || 'JSON inválido' },
    }));
    return fallback;
  }
}

function localCollectionsFromStorage(storage, workspaceId, workspace, findings) {
  const rawPurchases = readJson(
    storage,
    `aluxor.purchases.${workspaceId}`,
    { purchases: [] },
    findings,
  );
  const purchases = Array.isArray(rawPurchases)
    ? rawPurchases
    : list(rawPurchases?.purchases);
  return {
    workspaces: workspace ? [workspace] : [],
    quotes: list(readJson(storage, LOCAL_KEYS.quotes, [], findings)),
    productionOrders: list(readJson(storage, LOCAL_KEYS.productionOrders, [], findings)),
    purchases,
    purchaseItems: purchases.flatMap((purchase) => list(purchase?.items)),
  };
}

async function resolveWorkspaceId(client, requestedWorkspaceId) {
  const explicit = String(requestedWorkspaceId || '').trim();
  if (explicit) return { workspaceId: explicit, findings: [] };

  const authResult = await client?.auth?.getUser?.();
  const user = authResult?.data?.user || null;
  if (authResult?.error || !user) {
    return {
      workspaceId: null,
      findings: [createIntegrityFinding({
        severity: 'critical',
        code: 'remote_auth_required',
        entityType: 'audit',
        source: 'audit',
        message: 'No se pudo resolver el workspace sin una sesión autenticada.',
      })],
    };
  }

  const result = await client
    .from('workspace_members')
    .select('workspace_id, created_at')
    .eq('user_id', user.id)
    .eq('membership_status', 'active')
    .order('created_at', { ascending: true })
    .limit(1);
  const workspaceId = String(result?.data?.[0]?.workspace_id || '').trim();
  if (result?.error || !workspaceId) {
    return {
      workspaceId: null,
      findings: [createIntegrityFinding({
        severity: 'critical',
        code: 'workspace_unavailable',
        entityType: 'audit',
        source: 'audit',
        message: 'No se pudo resolver un workspace activo mediante SELECT.',
        metadata: {
          errorCode: result?.error?.code || null,
          errorMessage: result?.error?.message || null,
        },
      })],
    };
  }
  return { workspaceId, findings: [] };
}

function addFindings(audit, findings) {
  if (!findings.length) return audit;
  const nextFindings = [...audit.findings, ...findings].sort((left, right) => (
    left.code.localeCompare(right.code)
    || left.entityType.localeCompare(right.entityType)
  ));
  const summary = nextFindings.reduce((totals, finding) => {
    totals[finding.severity] = (totals[finding.severity] || 0) + 1;
    totals[finding.code] = (totals[finding.code] || 0) + 1;
    return totals;
  }, { critical: 0, error: 0, warning: 0, info: 0 });
  return {
    ...audit,
    findings: nextFindings,
    summary,
    valid: summary.critical === 0 && summary.error === 0,
  };
}

function recommendationsFor(report) {
  const codes = new Set(report.findings.map((finding) => finding.code));
  return [
    report.readiness.status === 'BLOCKED'
      ? 'No iniciar 25.2D hasta resolver y volver a auditar los bloqueos.'
      : null,
    [...codes].some((code) => [
      'missing_id', 'invalid_uuid', 'duplicate_id', 'missing_workspace_id',
      'invalid_workspace_id', 'workspace_mismatch',
    ].includes(code))
      ? 'Revisar manualmente cada identidad afectada; no fusionar por folio.'
      : null,
    codes.has('orphan_reference') || codes.has('missing_parent')
      ? 'Validar relaciones padre-hijo por workspace y UUID antes de proponer Foreign Keys.'
      : null,
    codes.has('invalid_version') || codes.has('invalid_updated_at')
      || codes.has('missing_required_field')
      ? 'Clasificar la deuda de versionado, fechas y campos obligatorios antes del endurecimiento.'
      : null,
    codes.has('duplicate_commercial_reference')
      ? 'Revisar folios repetidos como referencias comerciales, sin fusionar identidades.'
      : null,
    [...codes].some((code) => code.startsWith('remote_'))
      ? 'Restablecer una lectura autenticada completa y repetir la auditoría sin elevar privilegios.'
      : null,
    report.readiness.status === 'READY WITH WARNINGS'
      ? 'Revisar advertencias e información comparativa antes de aprobar 25.2D.'
      : null,
    report.readiness.status === 'READY'
      ? 'Conservar la evidencia y preparar respaldo y rollback antes de 25.2D.'
      : null,
  ].filter(Boolean);
}

function publicFinding(finding) {
  return { ...finding, severity: finding.severity.toLocaleUpperCase('en-US') };
}

export async function runIntegrityAudit({
  workspaceId: requestedWorkspaceId = null,
  workspace = null,
  localCollections,
  storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null,
  client = supabase,
  generatedAt = new Date().toISOString(),
} = {}) {
  const context = await resolveWorkspaceId(client, requestedWorkspaceId);
  const workspaceId = context.workspaceId;

  if (!workspaceId || !normalizeEntityId(workspaceId)) {
    const findings = [
      ...context.findings,
      ...(workspaceId ? [createIntegrityFinding({
        severity: 'critical',
        code: 'invalid_workspace_id',
        entityType: 'audit',
        workspaceId,
        source: 'audit',
        message: 'La auditoría requiere un workspace UUID válido.',
      })] : []),
    ];
    return {
      generatedAt,
      workspaceId: workspaceId || null,
      status: 'BLOCKED',
      summary: {
        totals: { critical: findings.length, errors: 0, warnings: 0, info: 0, localRecords: 0, remoteRecords: 0 },
        domains: {},
      },
      findings: findings.map(publicFinding),
      recommendations: ['Proporcionar una sesión autenticada y un workspace UUID accesible.'],
      readiness: {
        status: 'BLOCKED',
        reasons: ['No existe un contexto de workspace auditable.'],
        canAddNotNull: false,
        canAddUniqueIdentity: false,
        canAddForeignKeys: false,
        requiresLegacyRepair: false,
      },
      scope: {
        durableDomains: ['workspaces', 'quotes', 'productionOrders', 'purchases', 'purchaseItems'],
        notDurableDomains: ['reception', 'inventory', 'fabrication'],
        excludedConsumers: ['businessState'],
      },
    };
  }

  const storageFindings = [];
  const collections = localCollections || localCollectionsFromStorage(
    storage, workspaceId, workspace, storageFindings,
  );
  const localAudit = addFindings(
    auditLocalIntegrity(collections, { strict: true }),
    storageFindings,
  );
  const remoteAudit = await auditRemoteIntegrity({ workspaceId, client });
  const report = buildIntegrityReport({
    workspaceId,
    localAudit,
    remoteAudit,
    generatedAt,
  });

  return {
    generatedAt: report.generatedAt,
    workspaceId: report.workspaceId,
    status: report.readiness.status,
    summary: {
      totals: report.totals,
      domains: {
        ...report.domains,
        reception: { status: 'not_durable', auditableRecords: 0 },
        inventory: { status: 'not_durable', auditableRecords: 0 },
        fabrication: { status: 'not_durable', auditableRecords: 0 },
      },
    },
    findings: report.findings.map(publicFinding),
    recommendations: recommendationsFor(report),
    readiness: report.readiness,
    scope: {
      durableDomains: ['workspaces', 'quotes', 'productionOrders', 'purchases', 'purchaseItems'],
      notDurableDomains: ['reception', 'inventory', 'fabrication'],
      excludedConsumers: ['businessState'],
      localSource: localCollections ? 'provided_collections' : 'local_storage_read_only',
      remoteSource: 'authenticated_supabase_select',
    },
  };
}

export default runIntegrityAudit;
