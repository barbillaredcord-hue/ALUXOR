import {
  RECEPTION_ERROR_CODES,
  normalizeReception,
  normalizeReceptionItem,
  validateReceptionItemQuantities,
} from './receptionEngine.js';
import { ReceptionStorage } from './receptionStorage.js';

function error(message, code = RECEPTION_ERROR_CODES.INVALID_INPUT) {
  return { data: null, error: { code, message } };
}

export function createReceptionRepository({
  storage = ReceptionStorage,
} = {}) {
  function listByWorkspace(workspaceId) {
    if (!workspaceId) return error('Falta workspaceId.');
    return { data: storage.load(workspaceId), error: null };
  }

  function getReceptionById(workspaceId, receptionId) {
    if (!workspaceId || !receptionId) {
      return error('Faltan identificadores de Recepción.');
    }
    return {
      data: storage.load(workspaceId).find((item) => item.id === receptionId)
        || null,
      error: null,
    };
  }

  function listByPurchase(workspaceId, purchaseId) {
    const result = listByWorkspace(workspaceId);
    return result.error ? result : {
      data: result.data.filter((item) => item.purchaseId === purchaseId),
      error: null,
    };
  }

  function listByPurchaseItem(workspaceId, purchaseItemId) {
    const result = listByWorkspace(workspaceId);
    return result.error ? result : {
      data: result.data.filter((reception) => (
        reception.items.some((item) => (
          item.purchaseItemId === purchaseItemId
        ))
      )),
      error: null,
    };
  }

  function createReception(workspaceId, reception) {
    const value = normalizeReception(reception);
    if (!workspaceId || value.workspaceId !== workspaceId || !value.id) {
      return error('La recepción no pertenece al workspace.');
    }
    const current = getReceptionById(workspaceId, value.id);
    if (current.data) return { data: current.data, error: null, existing: true };
    return {
      data: storage.upsert(workspaceId, value),
      error: null,
      existing: false,
    };
  }

  function updateReception(workspaceId, reception, expectedVersion) {
    const value = normalizeReception(reception);
    const current = getReceptionById(workspaceId, value.id);
    if (current.error || !current.data) {
      return current.error ? current : error('La recepción no existe.');
    }
    if (
      current.data.version !== expectedVersion
      || value.version !== expectedVersion + 1
    ) {
      return error(
        'La recepción cambió en otra operación.',
        RECEPTION_ERROR_CODES.VERSION_CONFLICT,
      );
    }
    return { data: storage.upsert(workspaceId, value), error: null };
  }

  function deleteReception(workspaceId, receptionId, expectedVersion = null) {
    const current = getReceptionById(workspaceId, receptionId);
    if (current.error || !current.data) return current;
    if (
      expectedVersion !== null
      && current.data.version !== expectedVersion
    ) {
      return error(
        'La recepción cambió en otra operación.',
        RECEPTION_ERROR_CODES.VERSION_CONFLICT,
      );
    }
    storage.remove(workspaceId, receptionId);
    return { data: current.data, error: null };
  }

  function createReceptionItem(workspaceId, receptionId, item) {
    const current = getReceptionById(workspaceId, receptionId);
    if (current.error || !current.data) return current;
    const value = normalizeReceptionItem(item);
    if (
      value.workspaceId !== workspaceId
      || value.receptionId !== receptionId
      || value.purchaseId !== current.data.purchaseId
      || validateReceptionItemQuantities(item).length
    ) return error('La partida de recepción es inválida.');
    if (current.data.items.some((entry) => entry.id === value.id)) {
      return {
        data: current.data.items.find((entry) => entry.id === value.id),
        error: null,
        existing: true,
      };
    }
    const reception = {
      ...current.data,
      items: [...current.data.items, value],
    };
    storage.upsert(workspaceId, reception);
    return { data: value, error: null, existing: false };
  }

  function updateReceptionItem(
    workspaceId,
    receptionId,
    item,
    expectedVersion,
  ) {
    const current = getReceptionById(workspaceId, receptionId);
    if (current.error || !current.data) return current;
    const previous = current.data.items.find((entry) => entry.id === item?.id);
    const value = normalizeReceptionItem(item);
    if (
      !previous
      || previous.version !== expectedVersion
      || value.version !== expectedVersion + 1
      || validateReceptionItemQuantities(item).length
    ) {
      return error(
        'La partida cambió o es inválida.',
        previous
          ? RECEPTION_ERROR_CODES.VERSION_CONFLICT
          : RECEPTION_ERROR_CODES.INVALID_INPUT,
      );
    }
    storage.upsert(workspaceId, {
      ...current.data,
      items: current.data.items.map((entry) => (
        entry.id === value.id ? value : entry
      )),
    });
    return { data: value, error: null };
  }

  function listReceptionItems(workspaceId, receptionId = null) {
    const result = listByWorkspace(workspaceId);
    if (result.error) return result;
    return {
      data: result.data
        .filter((reception) => !receptionId || reception.id === receptionId)
        .flatMap((reception) => reception.items),
      error: null,
    };
  }

  function replaceWorkspace(workspaceId, receptions) {
    return {
      data: storage.replaceWorkspace(workspaceId, receptions),
      error: null,
    };
  }

  function cacheReception(workspaceId, reception) {
    return { data: storage.upsert(workspaceId, reception), error: null };
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
    replaceWorkspace,
    cacheReception,
  });
}

export const ReceptionLocalRepository = createReceptionRepository();
