import { supabase } from '../supabase/client';
import { normalizeEntityId } from '../identity/entityIdentity.js';
import {
  productionOrderRowToModel,
  productionOrderToInsertPayload,
  productionOrderToUpdatePayload,
} from './productionOrderAdapter.js';

const productionOrderColumns = `
  id,
  workspace_id,
  quote_id,
  folio,
  status,
  priority,
  responsible,
  client_name,
  product_name,
  commitment_date,
  started_at,
  finished_at,
  notes,
  timeline,
  form_snapshot,
  quote_version,
  created_by,
  version,
  created_at,
  updated_at,
  deleted_at
`;

function readableError(message, code) {
  const error = new Error(message);
  if (code) error.code = code;
  return error;
}

async function execute(query) {
  try {
    return await query();
  } catch (error) {
    return { data: null, error };
  }
}

function adaptSingle(result) {
  return {
    data: result.data ? productionOrderRowToModel(result.data) : null,
    error: result.error || null,
  };
}

export async function loadProductionOrders(workspaceId) {
  if (!workspaceId) {
    return { data: [], error: readableError('Falta el identificador del workspace.') };
  }
const result = await execute(() => supabase
  .from('production_orders')
  .select(productionOrderColumns)
  .eq('workspace_id', workspaceId)
  .is('deleted_at', null)
  .order('updated_at', { ascending: false }));

  return {
    data: Array.isArray(result.data) ? result.data.map(productionOrderRowToModel) : [],
    error: result.error || null,
  };
}

export async function getProductionOrder(workspaceId, id) {
  if (!workspaceId || !id) {
    return {
      data: null,
      error: readableError(
        'Faltan identificadores para consultar la orden de producción.'
      ),
    };
  }

  return adaptSingle(await execute(() => supabase
    .from('production_orders')
    .select(productionOrderColumns)
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()));
}

export async function getProductionOrderByQuoteId(workspaceId, quoteId) {
  if (!workspaceId || !quoteId) {
    return { data: null, error: readableError('Faltan identificadores para buscar la orden.') };
  }

  return adaptSingle(await execute(() => supabase
    .from('production_orders')
    .select(productionOrderColumns)
    .eq('workspace_id', workspaceId)
    .eq('quote_id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()));
}

async function insertProductionOrder(payload) {
  return execute(() => supabase
    .from('production_orders')
    .insert(payload)
    .select(productionOrderColumns)
    .single());
}

export async function createProductionOrderRemote(workspaceId, order) {
  if (!workspaceId) {
    return { data: null, error: readableError('Falta el identificador del workspace.'), existing: false };
  }

  try {
    const id = normalizeEntityId(order?.id);
    if (!id) {
      return {
        data: null,
        error: readableError('La orden requiere un UUID estable.', 'MISSING_STABLE_ENTITY_ID'),
        existing: false,
      };
    }

    const existingById = await getProductionOrder(workspaceId, id);
    if (existingById.error) return { ...existingById, existing: false };
    if (existingById.data) {
      const updated = await updateProductionOrderRemote(
        workspaceId, id, order, existingById.data.version,
      );
      return { ...updated, existing: true };
    }

    const existingByQuote = await getProductionOrderByQuoteId(workspaceId, order?.quoteId);
    if (existingByQuote.error) return { ...existingByQuote, existing: false };
    if (existingByQuote.data && existingByQuote.data.id !== id) {
      return {
        data: null,
        error: readableError(
          'La cotización ya está relacionada con otra orden de producción.',
          'PRODUCTION_REFERENCE_CONFLICT',
        ),
        existing: false,
      };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        data: null,
        error: userError || readableError('No existe un usuario autenticado.'),
        existing: false,
      };
    }

    const payload = {
      ...productionOrderToInsertPayload(order),
      id,
      workspace_id: workspaceId,
      created_by: user.id,
    };

    if (!payload.quote_id || !payload.folio) {
      return {
        data: null,
        error: readableError('La orden requiere quoteId y folio.'),
        existing: false,
      };
    }

    let result = await insertProductionOrder(payload);

    if (!result.error) {
      return {
        data: productionOrderRowToModel(result.data),
        error: null,
        existing: false,
      };
    }

    if (result.error?.code === '23505') {
      const raced = await getProductionOrder(workspaceId, id);
      if (raced.data && !raced.error) return { ...raced, existing: true };
    }

    return { data: null, error: result.error, existing: false };
  } catch (error) {
    return { data: null, error, existing: false };
  }
}

export async function updateProductionOrderRemote(
  workspaceId,
  id,
  order,
  expectedVersion
) {
  if (!workspaceId || !id) {
    return {
      data: null,
      error: readableError(
        'Faltan identificadores para actualizar la orden de producción.'
      ),
    };
  }

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return {
      data: null,
      error: readableError(
        'Falta una versión válida para actualizar la orden de producción.',
        'PRODUCTION_ORDER_VERSION_REQUIRED'
      ),
    };
  }

  const result = await execute(() => supabase
    .from('production_orders')
    .update(productionOrderToUpdatePayload(order))
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .eq('version', expectedVersion)
    .is('deleted_at', null)
    .select(productionOrderColumns)
    .maybeSingle());

  if (!result.error && !result.data) {
    return {
      data: null,
      error: readableError(
        'La orden de producción fue modificada en otra sesión.',
        'PRODUCTION_ORDER_VERSION_CONFLICT'
      ),
    };
  }

  return adaptSingle(result);
}
export function subscribeProductionOrders(workspaceId, callback, onStatus) {
  if (!workspaceId || typeof callback !== 'function') {
    return function unsubscribe() {};
  }

  let channel;

  try {
    channel = supabase
      .channel(`production-orders:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'production_orders',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        callback
      )
      .subscribe((status, error) => {
        onStatus?.(status, error || null);
      });
  } catch (error) {
    onStatus?.('CHANNEL_ERROR', error);
    return function unsubscribe() {};
  }

  let closed = false;
  return function unsubscribe() {
    if (closed) return;
    closed = true;
    try {
      void channel.unsubscribe();
    } catch {
      // Limpieza segura para el consumidor.
    }
  };
}

export const ProductionOrderRepository = {
  loadProductionOrders,
  getProductionOrder,
  getProductionOrderByQuoteId,
  createProductionOrderRemote,
  updateProductionOrderRemote,
  subscribeProductionOrders,
};
