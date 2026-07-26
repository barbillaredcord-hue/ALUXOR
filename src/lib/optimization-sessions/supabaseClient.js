const ERROR_CODES = Object.freeze({
  INVALID_CLIENT: 'OPTIMIZATION_SESSION_SUPABASE_CLIENT_INVALID',
  INVALID_INPUT: 'OPTIMIZATION_SESSION_SUPABASE_INPUT_INVALID',
  QUERY_FAILED: 'OPTIMIZATION_SESSION_SUPABASE_QUERY_FAILED',
  VERSION_CONFLICT: 'OPTIMIZATION_SESSION_SUPABASE_VERSION_CONFLICT',
  NOT_FOUND: 'OPTIMIZATION_SESSION_SUPABASE_NOT_FOUND',
  WORKSPACE_MISMATCH: 'OPTIMIZATION_SESSION_SUPABASE_WORKSPACE_MISMATCH',
  INVALID_RESPONSE: 'OPTIMIZATION_SESSION_SUPABASE_RESPONSE_INVALID',
});

const FILTER_ALIASES = Object.freeze({
  workspace_id: 'workspace_id',
  workspaceId: 'workspace_id',
  quote_id: 'quote_id',
  quoteId: 'quote_id',
  material_id: 'material_id',
  materialId: 'material_id',
  execution_id: 'execution_id',
  executionId: 'execution_id',
  status: 'status',
  created_by: 'created_by',
  createdBy: 'created_by',
  last_modified_by: 'last_modified_by',
  lastModifiedBy: 'last_modified_by',
  contract_version: 'contract_version',
  contractVersion: 'contract_version',
  version: 'version',
});

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function isPlainObject(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype,
  );
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function error(code, message, details = null, hint = null) {
  return {
    code,
    message,
    details: clone(details),
    ...(hint ? { hint: String(hint) } : {}),
  };
}

function failure(code, message, details = null, hint = null) {
  return { data: null, error: error(code, message, details, hint) };
}

function queryFailure(source, operation) {
  return failure(
    ERROR_CODES.QUERY_FAILED,
    text(source?.message) || `Falló la operación remota ${operation}.`,
    {
      operation,
      sourceCode: source?.code ?? null,
      sourceDetails: clone(source?.details ?? null),
    },
    source?.hint ?? null,
  );
}

function invalidConfiguration(supabase, workspaceId, tableName) {
  const issues = [];
  if (!supabase || typeof supabase.from !== 'function') issues.push('supabase.from');
  if (!text(workspaceId)) issues.push('workspaceId');
  if (!text(tableName)) issues.push('tableName');
  return issues.length
    ? failure(
      ERROR_CODES.INVALID_CLIENT,
      'La configuración del Supabase Client Adapter es inválida.',
      { issues },
    )
    : null;
}

function validateRow(row, workspaceId) {
  if (!isPlainObject(row) || !text(row.id) || !text(row.workspace_id)) {
    return failure(
      ERROR_CODES.INVALID_INPUT,
      'La fila remota requiere id y workspace_id.',
    );
  }
  if (row.workspace_id !== workspaceId) {
    return failure(
      ERROR_CODES.WORKSPACE_MISMATCH,
      'La fila remota pertenece a otro workspace.',
      {
        expectedWorkspaceId: workspaceId,
        receivedWorkspaceId: row.workspace_id,
      },
    );
  }
  return null;
}

function validateReturnedRow(row, workspaceId, operation) {
  if (!isPlainObject(row)) {
    return failure(
      ERROR_CODES.INVALID_RESPONSE,
      `La operación ${operation} no devolvió una fila válida.`,
      { operation },
    );
  }
  if (row.workspace_id !== workspaceId) {
    return failure(
      ERROR_CODES.WORKSPACE_MISMATCH,
      'Supabase devolvió una fila de otro workspace.',
      {
        operation,
        expectedWorkspaceId: workspaceId,
        receivedWorkspaceId: row.workspace_id ?? null,
      },
    );
  }
  return { data: clone(row), error: null };
}

async function execute(operation, query) {
  try {
    const result = await query();
    if (!isPlainObject(result) || !Object.prototype.hasOwnProperty.call(result, 'error')) {
      return failure(
        ERROR_CODES.INVALID_RESPONSE,
        `Supabase devolvió una respuesta inválida en ${operation}.`,
        { operation },
      );
    }
    if (result.error) {
      return queryFailure(result.error, operation);
    }
    return { data: clone(result.data), error: null };
  } catch (caught) {
    return queryFailure(caught, operation);
  }
}

function oneRow(result, workspaceId, operation, emptyCode) {
  if (result.error) return result;
  if (!Array.isArray(result.data)) {
    return failure(
      ERROR_CODES.INVALID_RESPONSE,
      `La operación ${operation} debe devolver un arreglo de filas.`,
      { operation },
    );
  }
  if (result.data.length === 0) {
    return failure(
      emptyCode,
      emptyCode === ERROR_CODES.VERSION_CONFLICT
        ? 'Optimization Session cambió o dejó de estar disponible.'
        : 'Optimization Session no existe en el workspace.',
      { operation },
    );
  }
  if (result.data.length !== 1) {
    return failure(
      ERROR_CODES.INVALID_RESPONSE,
      `La operación ${operation} devolvió más de una fila.`,
      { operation, rowCount: result.data.length },
    );
  }
  return validateReturnedRow(result.data[0], workspaceId, operation);
}

function normalizeFilters(filters, workspaceId) {
  if (!isPlainObject(filters)) {
    return failure(
      ERROR_CODES.INVALID_INPUT,
      'selectMany() requiere un objeto plano de filtros.',
    );
  }
  const normalized = {};
  for (const [field, value] of Object.entries(filters)) {
    const remoteField = FILTER_ALIASES[field];
    if (!remoteField) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        `El filtro ${field} no está permitido.`,
        { field },
      );
    }
    if (
      value !== null
      && typeof value !== 'string'
      && typeof value !== 'boolean'
      && !(typeof value === 'number' && Number.isFinite(value))
    ) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        `El filtro ${field} debe ser escalar.`,
        { field },
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(normalized, remoteField)
      && normalized[remoteField] !== value
    ) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        `Los aliases del filtro ${remoteField} no coinciden.`,
        { field: remoteField },
      );
    }
    normalized[remoteField] = value;
  }
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'workspace_id')
    && normalized.workspace_id !== workspaceId
  ) {
    return failure(
      ERROR_CODES.WORKSPACE_MISMATCH,
      'Los filtros pertenecen a otro workspace.',
      {
        expectedWorkspaceId: workspaceId,
        receivedWorkspaceId: normalized.workspace_id,
      },
    );
  }
  delete normalized.workspace_id;
  return { data: normalized, error: null };
}

export function createOptimizationSessionSupabaseClient({
  supabase,
  workspaceId,
  tableName = 'optimization_sessions',
} = {}) {
  const canonicalWorkspaceId = text(workspaceId);
  const canonicalTableName = text(tableName);
  const configurationError = invalidConfiguration(
    supabase,
    canonicalWorkspaceId,
    canonicalTableName,
  );

  function configured() {
    return configurationError
      ? { data: null, error: clone(configurationError.error) }
      : null;
  }

  async function insert(row) {
    const unavailable = configured();
    if (unavailable) return unavailable;
    const validation = validateRow(row, canonicalWorkspaceId);
    if (validation) return validation;
    const result = await execute('insert', () => supabase
      .from(canonicalTableName)
      .insert(clone(row))
      .select('*')
      .single());
    if (result.error) return result;
    return validateReturnedRow(result.data, canonicalWorkspaceId, 'insert');
  }

  async function update(row, expectedVersion) {
    const unavailable = configured();
    if (unavailable) return unavailable;
    const validation = validateRow(row, canonicalWorkspaceId);
    if (validation) return validation;
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        'update() requiere expectedVersion entero positivo.',
        { expectedVersion },
      );
    }
    if (row.version !== expectedVersion + 1) {
      return failure(
        ERROR_CODES.VERSION_CONFLICT,
        'La versión nueva debe avanzar exactamente expectedVersion.',
        {
          expectedVersion,
          rowVersion: row.version,
        },
      );
    }
    const result = await execute('update', () => supabase
      .from(canonicalTableName)
      .update(clone(row))
      .eq('id', row.id)
      .eq('workspace_id', canonicalWorkspaceId)
      .eq('version', expectedVersion)
      .select('*'));
    return oneRow(
      result,
      canonicalWorkspaceId,
      'update',
      ERROR_CODES.VERSION_CONFLICT,
    );
  }

  async function selectOne(sessionId) {
    const unavailable = configured();
    if (unavailable) return unavailable;
    const id = text(sessionId);
    if (!id) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        'selectOne() requiere sessionId.',
      );
    }
    const result = await execute('selectOne', () => supabase
      .from(canonicalTableName)
      .select('*')
      .eq('id', id)
      .eq('workspace_id', canonicalWorkspaceId)
      .maybeSingle());
    if (result.error) return result;
    if (result.data === null) {
      return failure(
        ERROR_CODES.NOT_FOUND,
        'Optimization Session no existe en el workspace.',
        { operation: 'selectOne' },
      );
    }
    return validateReturnedRow(result.data, canonicalWorkspaceId, 'selectOne');
  }

  async function selectMany(filters = {}) {
    const unavailable = configured();
    if (unavailable) return unavailable;
    const normalized = normalizeFilters(filters, canonicalWorkspaceId);
    if (normalized.error) return normalized;
    const result = await execute('selectMany', () => {
      let query = supabase
        .from(canonicalTableName)
        .select('*')
        .eq('workspace_id', canonicalWorkspaceId);
      Object.entries(normalized.data).forEach(([field, value]) => {
        query = value === null
          ? query.is(field, null)
          : query.eq(field, value);
      });
      return query
        .order('updated_at', { ascending: false })
        .order('id', { ascending: true });
    });
    if (result.error) return result;
    if (!Array.isArray(result.data)) {
      return failure(
        ERROR_CODES.INVALID_RESPONSE,
        'selectMany() debe devolver un arreglo.',
        { operation: 'selectMany' },
      );
    }
    for (let index = 0; index < result.data.length; index += 1) {
      const validation = validateReturnedRow(
        result.data[index],
        canonicalWorkspaceId,
        'selectMany',
      );
      if (validation.error) {
        return failure(
          validation.error.code,
          validation.error.message,
          {
            ...validation.error.details,
            index,
          },
          validation.error.hint ?? null,
        );
      }
    }
    return { data: clone(result.data), error: null };
  }

  async function remove(sessionId) {
    const unavailable = configured();
    if (unavailable) return unavailable;
    const id = text(sessionId);
    if (!id) {
      return failure(
        ERROR_CODES.INVALID_INPUT,
        'delete() requiere sessionId.',
      );
    }
    const result = await execute('delete', () => supabase
      .from(canonicalTableName)
      .delete()
      .eq('id', id)
      .eq('workspace_id', canonicalWorkspaceId)
      .select('*'));
    return oneRow(
      result,
      canonicalWorkspaceId,
      'delete',
      ERROR_CODES.NOT_FOUND,
    );
  }

  return Object.freeze({
    insert,
    update,
    selectOne,
    selectMany,
    delete: remove,
  });
}
