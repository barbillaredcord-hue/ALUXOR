function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function constraintFrom(error = {}) {
  const source = `${error.message || ''} ${error.details || ''}`;
  return source.match(/constraint ["']([^"']+)["']/i)?.[1] || null;
}

function failure(message, code = 'INVENTORY_SUPABASE_ERROR', details = null, metadata = {}) {
  return { data: null, error: { code, message, details: clone(details), ...clone(metadata) } };
}

const FILTERS = Object.freeze({
  workspaceId: 'workspace_id', materialId: 'material_id', movementType: 'movement_type',
  referenceType: 'reference_type', referenceId: 'reference_id', projectId: 'project_id',
  quoteId: 'quote_id', productionOrderId: 'production_order_id', purchaseId: 'purchase_id',
  receptionId: 'reception_id', batchId: 'batch_id', locationId: 'location_id',
  transferId: 'transfer_id', sourceType: 'source_type', sourceId: 'source_id',
});

async function execute(operation) {
  try {
    const result = await operation();
    if (result?.error) return failure(
      result.error.message || 'Falló la operación remota.',
      result.error.code || 'INVENTORY_SUPABASE_ERROR',
      result.error.details || null,
      {
        status: result.status || null,
        statusText: result.statusText || null,
        hint: result.error.hint || null,
        constraint: constraintFrom(result.error),
      },
    );
    return { data: clone(result?.data), error: null };
  } catch (error) {
    return failure(error?.message || 'Falló la operación remota.', error?.code);
  }
}

export function createInventorySupabaseClient({
  supabase,
  workspaceId,
  tableName = 'inventory_movements',
} = {}) {
  const valid = Boolean(supabase?.from && supabase?.rpc && workspaceId);
  const guard = () => valid ? null : failure('Configuración Supabase inválida.', 'INVENTORY_SUPABASE_INVALID');

  async function selectMany(filters = {}) {
    const invalid = guard(); if (invalid) return invalid;
    if (filters.workspaceId && filters.workspaceId !== workspaceId) {
      return failure('Workspace incompatible.', 'INVENTORY_SUPABASE_WORKSPACE');
    }
    const invalidFilter = Object.keys(filters).find((key) => !FILTERS[key]);
    if (invalidFilter) return failure(`Filtro no permitido: ${invalidFilter}.`, 'INVENTORY_SUPABASE_INVALID');
    return execute(() => {
      let query = supabase.from(tableName).select('*').eq('workspace_id', workspaceId);
      Object.entries(filters).forEach(([key, value]) => {
        const field = FILTERS[key];
        if (field === 'workspace_id' && value !== workspaceId) return;
        if (value !== undefined && value !== '') query = value === null
          ? query.is(field, null)
          : query.eq(field, value);
      });
      return query.order('occurred_at', { ascending: true }).order('id', { ascending: true });
    });
  }

  async function selectOne(id) {
    const invalid = guard(); if (invalid) return invalid;
    const result = await execute(() => supabase.from(tableName).select('*')
      .eq('workspace_id', workspaceId).eq('id', id).maybeSingle());
    return !result.error && result.data === null
      ? failure('El movimiento no existe.', 'INVENTORY_REMOTE_NOT_FOUND')
      : result;
  }

  async function insert(row) {
    const invalid = guard(); if (invalid) return invalid;
    if (row?.workspace_id !== workspaceId) return failure('Workspace incompatible.', 'INVENTORY_SUPABASE_WORKSPACE');
    const result = await execute(() => supabase.from(tableName).insert(clone(row)).select('*').single());
    if (result.error && import.meta.env?.DEV) console.warn('[inventory.remote]', {
      domain: 'inventory', operation: 'createMovement', table: tableName, movementId: row?.id,
      identityKey: `${row?.workspace_id}:${row?.id}`, sourceType: row?.source_type,
      sourceId: row?.source_id, sourceReference: row?.reference_id,
      version: row?.version, status: result.error.status,
      errorCode: result.error.code, constraint: result.error.constraint,
      message: result.error.message, details: result.error.details, hint: result.error.hint,
      payload: {
        id: row?.id, workspaceId: row?.workspace_id, movementType: row?.movement_type,
        sourceType: row?.source_type, sourceId: row?.source_id, version: row?.version,
      },
    });
    return result;
  }

  async function updateMetadata(id, patch, expectedVersion) {
    const invalid = guard(); if (invalid) return invalid;
    const result = await execute(() => supabase.from(tableName).update(clone(patch))
      .eq('workspace_id', workspaceId).eq('id', id).eq('version', expectedVersion)
      .select('*'));
    if (!result.error && Array.isArray(result.data) && result.data.length === 0) {
      return failure('El movimiento cambió remotamente.', 'INVENTORY_REMOTE_VERSION_CONFLICT');
    }
    if (!result.error && Array.isArray(result.data)) {
      return result.data.length === 1
        ? { data: result.data[0], error: null }
        : failure('Respuesta remota inválida.', 'INVENTORY_SUPABASE_RESPONSE');
    }
    return result;
  }

  async function rpc(name, parameters) {
    const invalid = guard(); if (invalid) return invalid;
    if (parameters?.p_workspace_id !== workspaceId) {
      return failure('Workspace incompatible.', 'INVENTORY_SUPABASE_WORKSPACE');
    }
    return execute(() => supabase.rpc(name, clone(parameters)));
  }

  return Object.freeze({ selectMany, selectOne, insert, updateMetadata, rpc });
}
