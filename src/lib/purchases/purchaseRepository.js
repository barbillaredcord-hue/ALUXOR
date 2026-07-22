import { supabase } from '../supabase/client.js';
import {
  purchaseItemRowToModel,
  purchaseItemToInsertPayload,
  purchaseItemToUpdatePayload,
  purchaseRowToModel,
  purchaseToInsertPayload,
  purchaseToUpdatePayload,
} from './purchaseAdapter.js';
import { normalizeEntityId } from '../identity/entityIdentity.js';

const purchaseColumns = `
  id, workspace_id, production_order_id, production_order_folio, quote_id,
  client_name, project_name, folio, supplier, status,
  ordered_at, expected_at, received_at, notes, is_active, created_by, version,
  created_at, updated_at, deleted_at
`;
const itemColumns = `
  id, workspace_id, purchase_id, source_type, source_id, item_group, name,
  unit, quantity, unit_cost, total_cost, status, supplier, item_date, notes, created_by, version,
  created_at, updated_at, deleted_at
`;

function error(message, code) {
  const value = new Error(message);
  if (code) value.code = code;
  return value;
}

async function execute(query) {
  try {
    return await query();
  } catch (caught) {
    return { data: null, error: caught };
  }
}

async function loadItems(workspaceId, purchaseIds) {
  if (!purchaseIds.length) return { data: [], error: null };
  const result = await execute(() => supabase
    .from('purchase_items')
    .select(itemColumns)
    .eq('workspace_id', workspaceId)
    .in('purchase_id', purchaseIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true }));
  return {
    data: Array.isArray(result.data) ? result.data : [],
    error: result.error || null,
  };
}

function combine(rows, itemRows) {
  return rows.map((row) => purchaseRowToModel(
    row,
    itemRows.filter((item) => item.purchase_id === row.id),
  ));
}

export async function loadPurchases(workspaceId) {
  if (!workspaceId) return { data: [], error: error('Falta el workspace de Compras.') };
  const result = await execute(() => supabase
    .from('purchases')
    .select(purchaseColumns)
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false }));
  if (result.error) return { data: [], error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  const items = await loadItems(workspaceId, rows.map((row) => row.id));
  if (items.error) return { data: [], error: items.error };
  return { data: combine(rows, items.data), error: null };
}

export async function getPurchase(workspaceId, purchaseId) {
  if (!workspaceId || !purchaseId) {
    return { data: null, error: error('Faltan identificadores de la compra.') };
  }
  const result = await execute(() => supabase
    .from('purchases')
    .select(purchaseColumns)
    .eq('workspace_id', workspaceId)
    .eq('id', purchaseId)
    .is('deleted_at', null)
    .maybeSingle());
  if (result.error || !result.data) return { data: null, error: result.error || null };
  const items = await loadItems(workspaceId, [result.data.id]);
  if (items.error) return { data: null, error: items.error };
  return { data: purchaseRowToModel(result.data, items.data), error: null };
}

export async function getPurchaseByProductionOrder(workspaceId, productionOrderId) {
  const result = await getPurchasesByProductionOrder(workspaceId, productionOrderId);
  return {
    data: result.data?.[0] || null,
    error: result.error || null,
  };
}

export async function getPurchasesByProductionOrder(workspaceId, productionOrderId) {
  if (!workspaceId || !productionOrderId) {
    return { data: [], error: error('Falta la Orden de Producción.') };
  }
  const result = await execute(() => supabase
    .from('purchases')
    .select(purchaseColumns)
    .eq('workspace_id', workspaceId)
    .eq('production_order_id', productionOrderId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false }));
  if (result.error) return { data: [], error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  const items = await loadItems(workspaceId, rows.map((row) => row.id));
  return items.error
    ? { data: [], error: items.error }
    : { data: combine(rows, items.data), error: null };
}

export async function getPurchasesByQuote(workspaceId, quoteId) {
  if (!workspaceId || !quoteId) return { data: [], error: error('Falta la cotización.') };
  const result = await execute(() => supabase
    .from('purchases')
    .select(purchaseColumns)
    .eq('workspace_id', workspaceId)
    .eq('quote_id', quoteId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false }));
  if (result.error) return { data: [], error: result.error };
  const rows = Array.isArray(result.data) ? result.data : [];
  const items = await loadItems(workspaceId, rows.map((row) => row.id));
  return items.error
    ? { data: [], error: items.error }
    : { data: combine(rows, items.data), error: null };
}

async function authenticatedUser() {
  const result = await supabase.auth.getUser();
  return result?.data?.user || null;
}

async function insertItems(workspaceId, purchaseId, items, userId) {
  const payload = items.map((item) => (
    purchaseItemToInsertPayload(item, workspaceId, purchaseId, userId)
  ));
  if (!payload.length) return { data: [], error: null };
  return execute(() => supabase
    .from('purchase_items')
    .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
    .select(itemColumns));
}

export async function createPurchaseRemote(workspaceId, purchase) {
  if (!workspaceId) return { data: null, error: error('Falta el workspace.'), existing: false };
  const id = normalizeEntityId(purchase?.id);
  if (!id) {
    return {
      data: null,
      error: error('La compra requiere un UUID estable.', 'MISSING_STABLE_ENTITY_ID'),
      existing: false,
    };
  }
  if ((purchase.items || []).some((item) => !normalizeEntityId(item?.id))) {
    return {
      data: null,
      error: error('Cada partida requiere un UUID estable.', 'MISSING_STABLE_ENTITY_ID'),
      existing: false,
    };
  }
  const existingById = await getPurchase(workspaceId, id);
  if (existingById.error) return { data: null, error: existingById.error, existing: false };
  if (existingById.data) {
    const user = await authenticatedUser();
    if (!user) return { data: null, error: error('No existe una sesión activa.'), existing: false };
    const itemResult = await insertItems(workspaceId, id, purchase.items || [], user.id);
    if (itemResult.error) return { data: null, error: itemResult.error, existing: false };
    const refreshed = await getPurchase(workspaceId, id);
    return { ...refreshed, existing: true };
  }
  const existing = await getPurchaseByProductionOrder(workspaceId, purchase?.productionOrderId);
  if (existing.error) return { data: null, error: existing.error, existing: false };
  if (existing.data && existing.data.id !== id) {
    return {
      data: null,
      error: error('La OT ya está relacionada con otra compra.', 'PURCHASE_REFERENCE_CONFLICT'),
      existing: false,
    };
  }
  const user = await authenticatedUser();
  if (!user) return { data: null, error: error('No existe una sesión activa.'), existing: false };
  let inserted = await execute(() => supabase
    .from('purchases')
    .insert({ ...purchaseToInsertPayload(purchase, workspaceId, user.id), id })
    .select(purchaseColumns)
    .single());
  if (inserted.error?.code === '23505') {
    const raced = await getPurchase(workspaceId, id);
    if (raced.data && !raced.error) {
      const itemResult = await insertItems(workspaceId, id, purchase.items || [], user.id);
      if (itemResult.error) return { data: null, error: itemResult.error, existing: false };
      const refreshed = await getPurchase(workspaceId, id);
      return { ...refreshed, existing: true };
    }
  }
  if (inserted.error) {
    return { data: null, error: inserted.error, existing: false };
  }
  const itemResult = await insertItems(workspaceId, inserted.data.id, purchase.items || [], user.id);
  if (itemResult.error) return { data: null, error: itemResult.error, existing: false };
  return {
    data: purchaseRowToModel(inserted.data, itemResult.data || []),
    error: null,
    existing: false,
  };
}

export async function updatePurchaseRemote(workspaceId, purchase, expectedVersion) {
  if (!workspaceId || !purchase?.id) return { data: null, error: error('Falta la compra.') };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { data: null, error: error('Falta una versión válida.', 'PURCHASE_VERSION_REQUIRED') };
  }
  const user = await authenticatedUser();
  if (!user) return { data: null, error: error('No existe una sesión activa.') };
  const updated = await execute(() => supabase
    .from('purchases')
    .update(purchaseToUpdatePayload(purchase))
    .eq('workspace_id', workspaceId)
    .eq('id', purchase.id)
    .eq('version', expectedVersion)
    .is('deleted_at', null)
    .select(purchaseColumns)
    .maybeSingle());
  if (updated.error) return { data: null, error: updated.error };
  if (!updated.data) {
    return { data: null, error: error('La compra cambió en otra sesión.', 'PURCHASE_VERSION_CONFLICT') };
  }
  return getPurchase(workspaceId, updated.data.id);
}

export async function getPurchaseItem(workspaceId, itemId) {
  if (!workspaceId || !itemId) {
    return { data: null, error: error('Faltan identificadores de la partida.') };
  }
  const result = await execute(() => supabase
    .from('purchase_items')
    .select(itemColumns)
    .eq('workspace_id', workspaceId)
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle());
  return {
    data: result.data ? purchaseItemRowToModel(result.data) : null,
    error: result.error || null,
  };
}

export async function updatePurchaseItemRemote(workspaceId, item, expectedVersion) {
  if (!workspaceId || !item?.id) return { data: null, error: error('Falta la partida.') };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { data: null, error: error('Falta una versión válida.', 'PURCHASE_VERSION_REQUIRED') };
  }
  const result = await execute(() => supabase
    .from('purchase_items')
    .update(purchaseItemToUpdatePayload(item))
    .eq('workspace_id', workspaceId)
    .eq('id', item.id)
    .eq('version', expectedVersion)
    .is('deleted_at', null)
    .select(itemColumns)
    .maybeSingle());
  if (result.error) return { data: null, error: result.error };
  if (!result.data) {
    return { data: null, error: error('La partida cambió en otra sesión.', 'PURCHASE_VERSION_CONFLICT') };
  }
  return { data: purchaseItemRowToModel(result.data), error: null };
}

export function subscribePurchases(workspaceId, callback, onStatus) {
  if (!workspaceId || typeof callback !== 'function') return () => {};
  let channel;
  try {
    channel = supabase
      .channel(`purchases:${workspaceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'purchases', filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => callback({
        table: 'purchases', eventType: payload.eventType,
        record: payload.new ? purchaseRowToModel(payload.new, []) : null,
        oldRecord: payload.old || null,
      }))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'purchases', filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => callback({
        table: 'purchases', eventType: payload.eventType,
        record: payload.new ? purchaseRowToModel(payload.new, []) : null,
        oldRecord: payload.old || null,
      }))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'purchases',
      }, (payload) => callback({
        table: 'purchases', eventType: payload.eventType,
        record: null,
        oldRecord: payload.old || null,
      }))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'purchase_items', filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => callback({
        table: 'purchase_items', eventType: payload.eventType,
        record: payload.new ? purchaseItemRowToModel(payload.new) : null,
        oldRecord: payload.old || null,
      }))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'purchase_items', filter: `workspace_id=eq.${workspaceId}`,
      }, (payload) => callback({
        table: 'purchase_items', eventType: payload.eventType,
        record: payload.new ? purchaseItemRowToModel(payload.new) : null,
        oldRecord: payload.old || null,
      }))
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'purchase_items',
      }, (payload) => callback({
        table: 'purchase_items', eventType: payload.eventType,
        record: null,
        oldRecord: payload.old || null,
      }))
      .subscribe((status, caught) => onStatus?.(status, caught || null));
  } catch (caught) {
    onStatus?.('CHANNEL_ERROR', caught);
    return () => {};
  }
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    try { void channel.unsubscribe(); } catch { /* limpieza idempotente */ }
  };
}

export const PurchaseRepository = {
  loadPurchases,
  getPurchase,
  getPurchaseByProductionOrder,
  getPurchasesByProductionOrder,
  getPurchasesByQuote,
  createPurchaseRemote,
  updatePurchaseRemote,
  getPurchaseItem,
  updatePurchaseItemRemote,
  subscribePurchases,
};
