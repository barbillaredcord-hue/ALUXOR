import { QuoteAdapter } from './quoteAdapter.js';
import { QuoteRepository } from './quoteRepository.js';

function quoteId(localItem) {
  return typeof localItem?.id === 'string' ? localItem.id.trim() : '';
}

export async function loadRemoteVersion(id) {
  if (!id) {
    return {
      data: null,
      error: new Error('Falta el identificador de la cotización.'),
    };
  }

  try {
    return await QuoteRepository.getQuote(id);
  } catch (error) {
    return { data: null, error };
  }
}

export async function resolveKeepRemote(localItem) {
  const id = quoteId(localItem);
  const { data, error } = await loadRemoteVersion(id);

  if (error || !data) {
    return {
      data: null,
      error: error || new Error('No fue posible descargar la versión remota.'),
    };
  }

  try {
    return {
      data: QuoteAdapter.quoteRowToHistoryItem(data),
      error: null,
    };
  } catch (conversionError) {
    return { data: null, error: conversionError };
  }
}

export async function resolveKeepLocal(localItem) {
  const id = quoteId(localItem);
  const remoteResult = await loadRemoteVersion(id);

  if (remoteResult.error || !remoteResult.data) {
    return {
      data: null,
      error: remoteResult.error || new Error('No fue posible descargar la versión remota.'),
    };
  }

  if (remoteResult.data.deleted_at !== null) {
    const deletedError = new Error('La cotización fue eliminada en otro dispositivo.');
    deletedError.code = 'QUOTE_REMOTE_DELETED';
    return { data: null, error: deletedError };
  }

  try {
    const payload = QuoteAdapter.historyItemToQuotePayload(localItem);
    const expectedVersion = Number(remoteResult.data.version);

    if (!Number.isInteger(expectedVersion) || expectedVersion <= 0) {
      return {
        data: null,
        error: new Error('La versión remota no es válida.'),
      };
    }

    const updateResult = await QuoteRepository.updateQuote(
      id,
      payload,
      expectedVersion,
    );

    if (updateResult.error || !updateResult.data) {
      return {
        data: null,
        error: updateResult.error || new Error('No fue posible conservar la versión local.'),
      };
    }

    return {
      data: QuoteAdapter.quoteRowToHistoryItem(updateResult.data),
      error: null,
    };
  } catch (error) {
    return { data: null, error };
  }
}

export const ConflictResolver = {
  loadRemoteVersion,
  resolveKeepRemote,
  resolveKeepLocal,
};
