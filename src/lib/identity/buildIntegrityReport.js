import { normalizeEntityId } from './entityIdentity.js';
import { createIntegrityFinding } from './integrityReport.js';

const DOMAIN_MAP = Object.freeze({
  workspace: 'workspaces',
  quotes: 'quotes',
  production: 'productionOrders',
  purchases: 'purchases',
  purchaseItems: 'purchaseItems',
});

const UNIQUE_BLOCKERS = new Set([
  'missing_id',
  'invalid_uuid',
  'duplicate_id',
  'duplicate_workspace_entity',
  'malformed_record',
  'invalid_workspace_id',
]);
const NOT_NULL_BLOCKERS = new Set([
  'missing_workspace_id', 'missing_required_field', 'malformed_record',
]);
const FOREIGN_KEY_BLOCKERS = new Set([
  'orphan_reference',
  'workspace_mismatch',
  'missing_parent',
  'malformed_record',
  'invalid_workspace_id',
]);
const DATA_QUALITY_BLOCKERS = new Set([
  'invalid_updated_at',
  'invalid_version',
  'missing_required_field',
]);
const LEGACY_REPAIR_CODES = new Set([
  ...UNIQUE_BLOCKERS,
  ...NOT_NULL_BLOCKERS,
  ...FOREIGN_KEY_BLOCKERS,
  ...DATA_QUALITY_BLOCKERS,
]);

function list(value) {
  return Array.isArray(value) ? value : [];
}

function workspaceId(record) {
  return String(record?.workspaceId ?? record?.workspace_id ?? '').trim();
}

function recordKey(record) {
  const id = normalizeEntityId(record?.id).toLocaleLowerCase('en-US');
  return id ? `${workspaceId(record)}\u0000${id}` : '';
}

function compareSources(localAudit, remoteAudit) {
  if (!remoteAudit || remoteAudit.status === 'unavailable') return [];
  const findings = [];

  Object.entries(DOMAIN_MAP).forEach(([reportDomain, sourceDomain]) => {
    if (remoteAudit.tables?.[sourceDomain]?.status !== 'completed') return;
    const localRecords = list(localAudit?.records?.[sourceDomain]);
    const remoteRecords = list(remoteAudit?.records?.[sourceDomain]);
    const localKeys = new Set(localRecords.map(recordKey).filter(Boolean));
    const remoteKeys = new Set(remoteRecords.map(recordKey).filter(Boolean));

    localRecords.forEach((record) => {
      const key = recordKey(record);
      if (!key || remoteKeys.has(key)) return;
      findings.push(createIntegrityFinding({
        severity: 'info',
        code: 'local_only_record',
        entityType: reportDomain,
        entityId: record.id,
        workspaceId: workspaceId(record),
        source: 'comparison',
        message: `${reportDomain} existe localmente y no aparece en la lectura remota.`,
      }));
    });

    remoteRecords.forEach((record) => {
      const key = recordKey(record);
      if (!key || localKeys.has(key)) return;
      findings.push(createIntegrityFinding({
        severity: 'info',
        code: 'remote_only_record',
        entityType: reportDomain,
        entityId: record.id,
        workspaceId: workspaceId(record),
        source: 'comparison',
        message: `${reportDomain} aparece en la lectura remota y no en la colección local.`,
      }));
    });
  });

  return findings;
}

function domainSummary(domain, sourceDomain, localAudit, remoteAudit, findings) {
  const domainEntityTypes = domain === 'production'
    ? new Set(['production', 'productionOrder', 'productionOrders'])
    : domain === 'purchaseItems'
      ? new Set(['purchaseItems', 'purchaseItem'])
      : domain === 'workspace'
        ? new Set(['workspace', 'workspaces'])
        : new Set([domain, domain === 'quotes' ? 'quote' : 'purchase']);
  const domainFindings = findings.filter((finding) => domainEntityTypes.has(finding.entityType));
  return {
    localRecords: list(localAudit?.records?.[sourceDomain]).length,
    remoteRecords: list(remoteAudit?.records?.[sourceDomain]).length,
    remoteStatus: remoteAudit?.tables?.[sourceDomain]?.status || 'unavailable',
    critical: domainFindings.filter((finding) => finding.severity === 'critical').length,
    errors: domainFindings.filter((finding) => finding.severity === 'error').length,
    warnings: domainFindings.filter((finding) => finding.severity === 'warning').length,
    info: domainFindings.filter((finding) => finding.severity === 'info').length,
  };
}

export function buildIntegrityReport({
  workspaceId = null,
  localAudit = null,
  remoteAudit = null,
  generatedAt = new Date().toISOString(),
} = {}) {
  const comparisonFindings = compareSources(localAudit, remoteAudit);
  const findings = [
    ...list(localAudit?.findings),
    ...list(remoteAudit?.findings),
    ...comparisonFindings,
  ].sort((left, right) => (
    left.severity.localeCompare(right.severity)
    || left.code.localeCompare(right.code)
    || left.entityType.localeCompare(right.entityType)
    || String(left.entityId || '').localeCompare(String(right.entityId || ''))
  ));
  const totals = {
    critical: findings.filter((finding) => finding.severity === 'critical').length,
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    info: findings.filter((finding) => finding.severity === 'info').length,
    localRecords: Number(localAudit?.totalRecords || 0),
    remoteRecords: Number(remoteAudit?.totalRecords || 0),
  };
  const remoteUnavailable = !remoteAudit || remoteAudit.status === 'unavailable';
  const status = totals.critical > 0 || totals.errors > 0
    ? 'blocked'
    : remoteUnavailable ? 'unavailable'
      : totals.warnings > 0 || totals.info > 0 || remoteAudit.status === 'partial'
        ? 'warnings'
        : 'clean';
  const codes = new Set(findings.map((finding) => finding.code));
  const availableForConstraints = !remoteUnavailable && remoteAudit.status === 'completed';
  const hasDataQualityBlocker = [...DATA_QUALITY_BLOCKERS].some((code) => codes.has(code));
  const readinessStatus = !availableForConstraints
    || totals.critical > 0
    || totals.errors > 0
    || hasDataQualityBlocker
    ? 'BLOCKED'
    : totals.warnings > 0 || totals.info > 0 ? 'READY WITH WARNINGS' : 'READY';
  const readinessReasons = [
    !availableForConstraints ? 'La auditoría remota no terminó en todas las tablas.' : null,
    totals.critical > 0 ? `Existen ${totals.critical} hallazgos críticos.` : null,
    totals.errors > 0 ? `Existen ${totals.errors} errores de integridad.` : null,
    hasDataQualityBlocker ? 'Existen campos obligatorios, versiones o fechas inválidas.' : null,
    totals.warnings > 0 && readinessStatus !== 'BLOCKED'
      ? `Existen ${totals.warnings} advertencias que requieren revisión.`
      : null,
    totals.info > 0 && readinessStatus !== 'BLOCKED'
      ? `Existen ${totals.info} diferencias informativas entre fuentes.`
      : null,
  ].filter(Boolean);

  const report = {
    generatedAt,
    workspaceId: workspaceId || remoteAudit?.workspaceId || null,
    status,
    totals,
    domains: {},
    findings,
    readiness: {
      status: readinessStatus,
      reasons: readinessReasons,
      canAddNotNull: availableForConstraints
        && ![...NOT_NULL_BLOCKERS].some((code) => codes.has(code)),
      canAddUniqueIdentity: availableForConstraints
        && ![...UNIQUE_BLOCKERS].some((code) => codes.has(code)),
      canAddForeignKeys: availableForConstraints
        && ![...FOREIGN_KEY_BLOCKERS].some((code) => codes.has(code)),
      requiresLegacyRepair: [...LEGACY_REPAIR_CODES].some((code) => codes.has(code)),
    },
  };

  Object.entries(DOMAIN_MAP).forEach(([domain, sourceDomain]) => {
    report.domains[domain] = domainSummary(
      domain, sourceDomain, localAudit, remoteAudit, findings,
    );
  });

  return report;
}

export const IntegrityReportBuilder = { buildIntegrityReport };
