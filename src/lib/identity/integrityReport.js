import { normalizeEntityId } from './entityIdentity.js';

const DOMAIN_CONFIG = Object.freeze({
  workspaces: {
    entityType: 'workspace',
    commercialFields: ['name'],
    requiresWorkspaceId: false,
    requiresVersion: false,
    requiredFields: [['name']],
    parents: [],
  },
  quotes: {
    entityType: 'quote',
    commercialFields: ['folio'],
    requiredFields: [['form', 'form_data']],
    parents: [],
  },
  productionOrders: {
    entityType: 'productionOrder',
    commercialFields: ['folio', 'orderNumber', 'order_number'],
    requiredFields: [['folio', 'orderNumber', 'order_number']],
    parents: [
      { fields: ['quoteId', 'quote_id'], domain: 'quotes', label: 'quote', required: true },
    ],
  },
  purchases: {
    entityType: 'purchase',
    commercialFields: ['folio', 'purchaseNumber', 'purchase_number'],
    requiredFields: [['folio', 'purchaseNumber', 'purchase_number']],
    parents: [
      {
        fields: ['productionOrderId', 'production_order_id'],
        domain: 'productionOrders',
        label: 'productionOrder',
        required: true,
      },
      { fields: ['quoteId', 'quote_id'], domain: 'quotes', label: 'quote', required: true },
    ],
  },
  purchaseItems: {
    entityType: 'purchaseItem',
    commercialFields: ['sourceId', 'source_id'],
    commercialScopeFields: ['purchaseId', 'purchase_id', 'sourceType', 'source_type'],
    requiredFields: [
      ['sourceType', 'source_type'],
      ['sourceId', 'source_id'],
      ['name'],
    ],
    parents: [
      { fields: ['purchaseId', 'purchase_id'], domain: 'purchases', label: 'purchase', required: true },
    ],
  },
});

function list(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function read(record, fields) {
  if (!isRecord(record)) return undefined;
  const field = fields.find((candidate) => Object.prototype.hasOwnProperty.call(record, candidate));
  return field ? record[field] : undefined;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function idKey(value) {
  return normalizeEntityId(value).toLocaleLowerCase('en-US');
}

function workspaceOf(record) {
  return text(read(record, ['workspaceId', 'workspace_id']));
}

function validTimestamp(value) {
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value !== 'string' || !value.trim()) return false;
  return !Number.isNaN(Date.parse(value));
}

function validVersion(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1;
}

function strictSeverity(strict, fallback = 'error') {
  return strict ? 'critical' : fallback;
}

function idOf(record) {
  const value = read(record, ['id']);
  return value === null || value === undefined ? '' : String(value).trim();
}

function commercialReferenceOf(record, fields) {
  return text(read(record, fields));
}

export function createIntegrityFinding({
  severity = 'error',
  code,
  entityType,
  entityId = null,
  workspaceId = null,
  parentId = null,
  commercialReference = null,
  source = 'unknown',
  message,
  metadata = {},
}) {
  return {
    severity,
    code,
    entityType,
    entityId: entityId || null,
    workspaceId: workspaceId || null,
    parentId: parentId || null,
    commercialReference: commercialReference || null,
    source,
    message,
    metadata: isRecord(metadata) ? { ...metadata } : {},
  };
}

function normalizeCollections(input = {}) {
  return {
    workspaces: list(input.workspaces ?? (input.workspace ? [input.workspace] : [])),
    quotes: list(input.quotes),
    productionOrders: list(input.productionOrders ?? input.production_orders),
    purchases: list(input.purchases),
    purchaseItems: list(input.purchaseItems ?? input.purchase_items),
  };
}

function findingSort(left, right) {
  return left.code.localeCompare(right.code)
    || left.entityType.localeCompare(right.entityType)
    || String(left.workspaceId || '').localeCompare(String(right.workspaceId || ''))
    || String(left.entityId || '').localeCompare(String(right.entityId || ''))
    || String(left.parentId || '').localeCompare(String(right.parentId || ''));
}

export function inspectIntegrityCollections(input = {}, {
  source = 'unknown',
  strict = false,
} = {}) {
  const collections = normalizeCollections(input);
  const findings = [];
  const indexes = {};

  Object.entries(DOMAIN_CONFIG).forEach(([domain, config]) => {
    const records = collections[domain];
    const byId = new Map();
    const byWorkspaceEntity = new Map();
    const byCommercialReference = new Map();

    records.forEach((record, index) => {
      if (!isRecord(record)) {
        findings.push(createIntegrityFinding({
          severity: strictSeverity(strict),
          code: 'malformed_record',
          entityType: config.entityType,
          source,
          message: `${config.entityType} no es un objeto auditable.`,
          metadata: { index },
        }));
        return;
      }

      const rawId = idOf(record);
      const stableId = idKey(rawId);
      const workspaceId = workspaceOf(record);
      const commercialReference = commercialReferenceOf(record, config.commercialFields);

      if (!rawId) {
        findings.push(createIntegrityFinding({
          severity: strictSeverity(strict),
          code: 'missing_id',
          entityType: config.entityType,
          workspaceId,
          commercialReference,
          source,
          message: `${config.entityType} no tiene id.`,
          metadata: { index },
        }));
      } else if (!stableId) {
        findings.push(createIntegrityFinding({
          severity: strictSeverity(strict),
          code: 'invalid_uuid',
          entityType: config.entityType,
          entityId: rawId,
          workspaceId,
          commercialReference,
          source,
          message: `${config.entityType} tiene un id que no es UUID válido.`,
          metadata: { index },
        }));
      }

      if (config.requiresWorkspaceId !== false && !workspaceId) {
        findings.push(createIntegrityFinding({
          severity: strictSeverity(strict),
          code: 'missing_workspace_id',
          entityType: config.entityType,
          entityId: rawId,
          commercialReference,
          source,
          message: `${config.entityType} no tiene workspace_id.`,
          metadata: { index },
        }));
      } else if (
        strict
        && config.requiresWorkspaceId !== false
        && !normalizeEntityId(workspaceId)
      ) {
        findings.push(createIntegrityFinding({
          severity: 'critical',
          code: 'invalid_workspace_id',
          entityType: config.entityType,
          entityId: rawId,
          workspaceId,
          commercialReference,
          source,
          message: `${config.entityType} tiene workspace_id inválido.`,
          metadata: { index },
        }));
      }

      if (strict) {
        const updatedAt = read(record, ['updatedAt', 'updated_at']);
        if (updatedAt === undefined || updatedAt === null || updatedAt === '') {
          findings.push(createIntegrityFinding({
            code: 'missing_required_field',
            entityType: config.entityType,
            entityId: rawId,
            workspaceId,
            commercialReference,
            source,
            message: `${config.entityType} no tiene updatedAt.`,
            metadata: { index, field: 'updatedAt' },
          }));
        } else if (!validTimestamp(updatedAt)) {
          findings.push(createIntegrityFinding({
            code: 'invalid_updated_at',
            entityType: config.entityType,
            entityId: rawId,
            workspaceId,
            commercialReference,
            source,
            message: `${config.entityType} tiene updatedAt inválido.`,
            metadata: { index, value: updatedAt },
          }));
        }

        if (config.requiresVersion !== false) {
          const version = read(record, ['version']);
          if (version === undefined || version === null || version === '') {
            findings.push(createIntegrityFinding({
              code: 'missing_required_field',
              entityType: config.entityType,
              entityId: rawId,
              workspaceId,
              commercialReference,
              source,
              message: `${config.entityType} no tiene version.`,
              metadata: { index, field: 'version' },
            }));
          } else if (!validVersion(version)) {
            findings.push(createIntegrityFinding({
              code: 'invalid_version',
              entityType: config.entityType,
              entityId: rawId,
              workspaceId,
              commercialReference,
              source,
              message: `${config.entityType} tiene version inválida.`,
              metadata: { index, value: version },
            }));
          }
        }

        (config.requiredFields || []).forEach((aliases) => {
          const value = read(record, aliases);
          const present = typeof value === 'string' ? Boolean(value.trim()) : value !== null && value !== undefined;
          if (present) return;
          findings.push(createIntegrityFinding({
            code: 'missing_required_field',
            entityType: config.entityType,
            entityId: rawId,
            workspaceId,
            commercialReference,
            source,
            message: `${config.entityType} no tiene el campo obligatorio ${aliases[0]}.`,
            metadata: { index, field: aliases[0] },
          }));
        });
      }

      if (stableId) {
        const idGroup = byId.get(stableId) || [];
        idGroup.push({ record, index, workspaceId, rawId });
        byId.set(stableId, idGroup);

        const workspaceKey = `${workspaceId}\u0000${stableId}`;
        const workspaceGroup = byWorkspaceEntity.get(workspaceKey) || [];
        workspaceGroup.push({ record, index, workspaceId, rawId });
        byWorkspaceEntity.set(workspaceKey, workspaceGroup);
      }

      if (commercialReference) {
        const commercialScope = (config.commercialScopeFields || [])
          .map((field) => text(read(record, [field])))
          .join('\u0000');
        const referenceKey = `${workspaceId}\u0000${commercialScope}\u0000${commercialReference}`;
        const referenceGroup = byCommercialReference.get(referenceKey) || [];
        referenceGroup.push({ record, index, workspaceId, rawId });
        byCommercialReference.set(referenceKey, referenceGroup);
      }
    });

    byId.forEach((group, stableId) => {
      if (group.length < 2) return;
      findings.push(createIntegrityFinding({
        severity: strictSeverity(strict),
        code: 'duplicate_id',
        entityType: config.entityType,
        entityId: group[0].rawId,
        workspaceId: group[0].workspaceId,
        source,
        message: `${config.entityType} repite el mismo UUID.`,
        metadata: {
          count: group.length,
          indexes: group.map((entry) => entry.index),
          workspaceIds: [...new Set(group.map((entry) => entry.workspaceId))].sort(),
          normalizedId: stableId,
        },
      }));
    });

    byWorkspaceEntity.forEach((group) => {
      if (group.length < 2) return;
      findings.push(createIntegrityFinding({
        severity: strictSeverity(strict),
        code: 'duplicate_workspace_entity',
        entityType: config.entityType,
        entityId: group[0].rawId,
        workspaceId: group[0].workspaceId,
        source,
        message: `${config.entityType} está duplicado dentro del mismo workspace.`,
        metadata: { count: group.length, indexes: group.map((entry) => entry.index) },
      }));
    });

    byCommercialReference.forEach((group) => {
      const distinctIds = new Set(group.map((entry) => idKey(entry.rawId) || entry.rawId));
      if (distinctIds.size < 2) return;
      const reference = commercialReferenceOf(group[0].record, config.commercialFields);
      findings.push(createIntegrityFinding({
        severity: 'warning',
        code: 'duplicate_commercial_reference',
        entityType: config.entityType,
        entityId: group[0].rawId,
        workspaceId: group[0].workspaceId,
        commercialReference: reference,
        source,
        message: `${config.entityType} comparte una referencia comercial con otro UUID.`,
        metadata: {
          count: group.length,
          entityIds: group.map((entry) => entry.rawId).sort(),
        },
      }));
    });

    indexes[domain] = byId;
  });

  Object.entries(DOMAIN_CONFIG).forEach(([domain, config]) => {
    collections[domain].forEach((record, index) => {
      if (!isRecord(record)) return;
      const entityId = idOf(record);
      const workspaceId = workspaceOf(record);
      const commercialReference = commercialReferenceOf(record, config.commercialFields);

      config.parents.forEach((parentConfig) => {
        const parentId = text(read(record, parentConfig.fields));
        if (!parentId) {
          if (parentConfig.required) {
            findings.push(createIntegrityFinding({
              severity: strictSeverity(strict),
              code: 'missing_parent',
              entityType: config.entityType,
              entityId,
              workspaceId,
              commercialReference,
              source,
              message: `${config.entityType} no tiene referencia a ${parentConfig.label}.`,
              metadata: { index, parentType: DOMAIN_CONFIG[parentConfig.domain].entityType },
            }));
          }
          return;
        }

        const parentGroup = indexes[parentConfig.domain].get(idKey(parentId)) || [];
        if (!parentGroup.length) {
          findings.push(createIntegrityFinding({
            severity: strictSeverity(strict),
            code: 'orphan_reference',
            entityType: config.entityType,
            entityId,
            workspaceId,
            parentId,
            commercialReference,
            source,
            message: `${config.entityType} referencia un ${parentConfig.label} inexistente.`,
            metadata: { index, parentType: DOMAIN_CONFIG[parentConfig.domain].entityType },
          }));
          return;
        }

        const sameWorkspace = parentGroup.find((entry) => entry.workspaceId === workspaceId);
        if (!sameWorkspace) {
          findings.push(createIntegrityFinding({
            severity: strictSeverity(strict),
            code: 'workspace_mismatch',
            entityType: config.entityType,
            entityId,
            workspaceId,
            parentId,
            commercialReference,
            source,
            message: `${config.entityType} y ${parentConfig.label} pertenecen a workspaces distintos.`,
            metadata: {
              index,
              parentType: DOMAIN_CONFIG[parentConfig.domain].entityType,
              parentWorkspaceIds: [...new Set(parentGroup.map((entry) => entry.workspaceId))].sort(),
            },
          }));
        }
      });
    });
  });

  if (strict && collections.workspaces.length > 0) {
    const workspaceIds = new Set(
      collections.workspaces.map((workspace) => idKey(idOf(workspace))).filter(Boolean),
    );
    Object.entries(DOMAIN_CONFIG).forEach(([domain, config]) => {
      if (config.requiresWorkspaceId === false) return;
      collections[domain].forEach((record, index) => {
        if (!isRecord(record)) return;
        const workspaceId = workspaceOf(record);
        if (!normalizeEntityId(workspaceId) || workspaceIds.has(idKey(workspaceId))) return;
        findings.push(createIntegrityFinding({
          severity: 'critical',
          code: 'orphan_reference',
          entityType: config.entityType,
          entityId: idOf(record),
          workspaceId,
          parentId: workspaceId,
          commercialReference: commercialReferenceOf(record, config.commercialFields),
          source,
          message: `${config.entityType} referencia un workspace inexistente.`,
          metadata: { index, parentType: 'workspace' },
        }));
      });
    });
  }

  findings.sort(findingSort);
  const summary = findings.reduce((totals, finding) => {
    totals[finding.severity] += 1;
    totals[finding.code] = (totals[finding.code] || 0) + 1;
    return totals;
  }, { critical: 0, error: 0, warning: 0, info: 0 });

  return {
    valid: summary.critical === 0 && summary.error === 0,
    collections,
    findings,
    summary,
  };
}

const LEGACY_CODES = Object.freeze({
  missing_id: 'MISSING_ENTITY_ID',
  invalid_uuid: 'MISSING_ENTITY_ID',
  duplicate_id: 'DUPLICATE_ENTITY_ID',
  workspace_mismatch: 'WORKSPACE_MISMATCH',
});

function legacyCode(finding) {
  if (finding.code === 'duplicate_commercial_reference') {
    if (finding.entityType === 'quote') return 'DUPLICATE_QUOTE_FOLIO';
    if (finding.entityType === 'productionOrder') return 'DUPLICATE_PRODUCTION_REFERENCE';
    if (finding.entityType === 'purchase') return 'DUPLICATE_PURCHASE_REFERENCE';
  }
  if (finding.code === 'orphan_reference') {
    if (finding.entityType === 'productionOrder') return 'PRODUCTION_WITHOUT_QUOTE';
    if (finding.entityType === 'purchase') return 'PURCHASE_WITHOUT_PRODUCTION_ORDER';
  }
  return LEGACY_CODES[finding.code] || finding.code.toLocaleUpperCase('en-US');
}

export function createIntegrityReport(input = {}) {
  const inspected = inspectIntegrityCollections(input, { source: 'legacy' });
  const issues = inspected.findings.map((finding) => ({
    code: legacyCode(finding),
    severity: finding.severity,
    entityType: finding.entityType,
    entityIds: finding.metadata.entityIds || [finding.entityId || ''],
    reference: finding.commercialReference || finding.parentId || null,
    message: finding.message,
  }));

  return {
    valid: inspected.valid,
    issues,
    findings: inspected.findings,
    summary: {
      duplicateIds: inspected.summary.duplicate_id || 0,
      duplicateReferences: inspected.summary.duplicate_commercial_reference || 0,
      missingIds: (inspected.summary.missing_id || 0) + (inspected.summary.invalid_uuid || 0),
      brokenRelations: (inspected.summary.orphan_reference || 0)
        + (inspected.summary.workspace_mismatch || 0)
        + (inspected.summary.missing_parent || 0),
      ...inspected.summary,
    },
  };
}

export const IntegrityReport = {
  createIntegrityFinding,
  inspectIntegrityCollections,
  createIntegrityReport,
};
