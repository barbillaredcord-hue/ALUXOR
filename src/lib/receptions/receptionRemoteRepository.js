import {
  receptionFromRemoteRow,
  receptionItemFromRemoteRow,
  receptionItemToRemoteRow,
  receptionToRemoteRow,
} from './receptionAdapter.js';

function clone(value) {
  if (Array.isArray(value)) return value.map(clone);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clone(entry)]),
  );
}

function failure(message, code = 'RECEPTION_REMOTE_ERROR') {
  return { data: null, error: { code, message } };
}

export function createRemoteReceptionRepository(client) {
  async function call(method, ...args) {
    if (typeof client?.[method] !== 'function') {
      return failure(`El cliente remoto no implementa ${method}().`);
    }
    try {
      const result = await client[method](...args);
      return result && Object.prototype.hasOwnProperty.call(result, 'error')
        ? result
        : failure(`Respuesta inválida de ${method}().`);
    } catch (error) {
      return { data: null, error };
    }
  }

  function aggregate(payload) {
    if (!payload) return null;
    const row = payload.reception || payload;
    const items = payload.items || [];
    return receptionFromRemoteRow(row, items);
  }

  async function createReception(reception) {
    const result = await call(
      'insertReception',
      clone(receptionToRemoteRow(reception)),
      reception.items.map((item) => clone(receptionItemToRemoteRow(item))),
    );
    return result.error
      ? result
      : { data: aggregate(result.data), error: null };
  }

  async function updateReception(reception, expectedVersion) {
    const result = await call(
      'updateReception',
      clone(receptionToRemoteRow(reception)),
      expectedVersion,
    );
    return result.error
      ? result
      : { data: aggregate(result.data), error: null };
  }

  async function deleteReception(receptionId, expectedVersion = null) {
    return call('deleteReception', receptionId, expectedVersion);
  }

  async function getReceptionById(receptionId) {
    const result = await call('selectReception', receptionId);
    return result.error || !result.data
      ? result
      : { data: aggregate(result.data), error: null };
  }

  async function list(filters = {}) {
    const result = await call('selectReceptions', clone(filters));
    if (result.error) return result;
    if (!Array.isArray(result.data)) return failure('La lista remota es inválida.');
    return {
      data: result.data.map(aggregate),
      error: null,
    };
  }

  const listByWorkspace = (workspaceId) => list({ workspaceId });
  const listByPurchase = (workspaceId, purchaseId) => (
    list({ workspaceId, purchaseId })
  );
  const listByPurchaseItem = async (workspaceId, purchaseItemId) => {
    const result = await list({ workspaceId, purchaseItemId });
    return result;
  };

  async function createReceptionItem(item) {
    const result = await call(
      'insertReceptionItem',
      clone(receptionItemToRemoteRow(item)),
    );
    return result.error ? result : {
      data: receptionItemFromRemoteRow(result.data),
      error: null,
    };
  }

  async function updateReceptionItem(item, expectedVersion) {
    const result = await call(
      'updateReceptionItem',
      clone(receptionItemToRemoteRow(item)),
      expectedVersion,
    );
    return result.error ? result : {
      data: receptionItemFromRemoteRow(result.data),
      error: null,
    };
  }

  async function listReceptionItems(workspaceId, receptionId = null) {
    const result = await call('selectReceptionItems', {
      workspaceId,
      receptionId,
    });
    return result.error ? result : {
      data: result.data.map(receptionItemFromRemoteRow),
      error: null,
    };
  }

  return Object.freeze({
    createReception,
    updateReception,
    deleteReception,
    getReceptionById,
    listByWorkspace,
    listByPurchase,
    listByPurchaseItem,
    createReceptionItem,
    updateReceptionItem,
    listReceptionItems,
  });
}
