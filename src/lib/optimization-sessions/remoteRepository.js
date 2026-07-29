import {
  optimizationSessionFromRemoteRow,
  optimizationSessionToRemoteRow,
} from './remoteAdapter.js';

const ERROR_CODES = Object.freeze({
  INVALID_CLIENT: 'OPTIMIZATION_SESSION_REMOTE_CLIENT_INVALID',
  INVALID_INPUT: 'OPTIMIZATION_SESSION_REMOTE_INPUT_INVALID',
  INVALID_RESPONSE: 'OPTIMIZATION_SESSION_REMOTE_RESPONSE_INVALID',
  VERSION_CONFLICT: 'OPTIMIZATION_SESSION_REMOTE_VERSION_CONFLICT',
});

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function repositoryError(code, message, details = {}) {
  return {
    data: null,
    error: {
      code,
      message,
      ...(Object.keys(details).length ? { details: clone(details) } : {}),
    },
  };
}

function text(value) {
  return String(value ?? '').trim();
}

function validFilters(filters) {
  if (
    !filters
    || typeof filters !== 'object'
    || Array.isArray(filters)
    || Object.getPrototypeOf(filters) !== Object.prototype
  ) return false;
  return Object.values(filters).every((value) => (
    value === null
    || typeof value === 'string'
    || typeof value === 'number' && Number.isFinite(value)
    || typeof value === 'boolean'
  ));
}

function validClientResult(result) {
  return Boolean(
    result
    && typeof result === 'object'
    && !Array.isArray(result)
    && Object.prototype.hasOwnProperty.call(result, 'data')
    && Object.prototype.hasOwnProperty.call(result, 'error'),
  );
}

function clientError(error) {
  return { data: null, error };
}

export function createRemoteOptimizationRepository(client) {
  async function runClient(method, ...args) {
    if (!client || typeof client[method] !== 'function') {
      return repositoryError(
        ERROR_CODES.INVALID_CLIENT,
        `El cliente remoto no implementa ${method}().`,
        { method },
      );
    }
    try {
      const result = await client[method](...args);
      if (!validClientResult(result)) {
        return repositoryError(
          ERROR_CODES.INVALID_RESPONSE,
          `El cliente remoto devolvió una respuesta inválida en ${method}().`,
          { method },
        );
      }
      return result.error ? clientError(result.error) : result;
    } catch (error) {
      return clientError(error);
    }
  }

  function domainResult(remoteResult) {
    if (remoteResult.error) return clientError(remoteResult.error);
    const adapted = optimizationSessionFromRemoteRow(remoteResult.data);
    return adapted.error ? clientError(adapted.error) : { data: adapted.data, error: null };
  }

  async function create(session) {
    const adapted = optimizationSessionToRemoteRow(session);
    if (adapted.error) return clientError(adapted.error);
    const result = await runClient('insert', clone(adapted.data));
    return domainResult(result);
  }

  async function update(session, expectedVersion) {
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      return repositoryError(
        ERROR_CODES.INVALID_INPUT,
        'update() requiere expectedVersion entero positivo.',
        { expectedVersion },
      );
    }
    const adapted = optimizationSessionToRemoteRow(session);
    if (adapted.error) return clientError(adapted.error);
    if (adapted.data.version !== expectedVersion + 1) {
      return repositoryError(
        ERROR_CODES.VERSION_CONFLICT,
        'La versión nueva debe avanzar exactamente expectedVersion.',
        {
          expectedVersion,
          sessionVersion: adapted.data.version,
        },
      );
    }
    const result = await runClient(
      'update',
      clone(adapted.data),
      expectedVersion,
    );
    return domainResult(result);
  }

  async function get(sessionId) {
    const id = text(sessionId);
    if (!id) {
      return repositoryError(
        ERROR_CODES.INVALID_INPUT,
        'get() requiere sessionId.',
      );
    }
    return domainResult(await runClient('selectOne', id));
  }

  async function list(filters = {}) {
    if (!validFilters(filters)) {
      return repositoryError(
        ERROR_CODES.INVALID_INPUT,
        'list() requiere un objeto plano con filtros escalares.',
      );
    }
    const result = await runClient('selectMany', clone(filters));
    if (result.error) return clientError(result.error);
    if (!Array.isArray(result.data)) {
      return repositoryError(
        ERROR_CODES.INVALID_RESPONSE,
        'selectMany() debe devolver un arreglo.',
        { method: 'selectMany' },
      );
    }
    const sessions = [];
    for (let index = 0; index < result.data.length; index += 1) {
      const adapted = optimizationSessionFromRemoteRow(result.data[index]);
      if (adapted.error) {
        return repositoryError(
          ERROR_CODES.INVALID_RESPONSE,
          'selectMany() devolvió una fila inválida.',
          {
            index,
            rowId: result.data[index]?.id ?? null,
            field: adapted.error?.details?.field
              ?? adapted.error?.details?.missing?.[0]
              ?? adapted.error?.details?.unexpected?.[0]
              ?? null,
            adapterError: adapted.error,
            operation: 'selectMany',
          },
        );
      }
      sessions.push(adapted.data);
    }
    return { data: sessions, error: null };
  }

  async function remove(sessionId) {
    const id = text(sessionId);
    if (!id) {
      return repositoryError(
        ERROR_CODES.INVALID_INPUT,
        'remove() requiere sessionId.',
      );
    }
    return domainResult(await runClient('delete', id));
  }

  return Object.freeze({
    create,
    update,
    get,
    list,
    remove,
  });
}
