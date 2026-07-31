const RECEPTION_COLUMNS = `
  id, workspace_id, purchase_id, production_order_id, quote_id,
  received_at, received_by, observations, evidence, version,
  created_at, updated_at, created_by, last_modified_by
`;
const RECEPTION_ITEM_COLUMNS = `
  id, workspace_id, reception_id, purchase_id, purchase_item_id,
  received_quantity, accepted_quantity, damaged_quantity,
  rejected_quantity, missing_quantity, observations, evidence, version,
  created_at, updated_at, created_by, last_modified_by
`;

function failure(message, code = 'RECEPTION_SUPABASE_ERROR') {
  return { data: null, error: { code, message } };
}

export function createReceptionSupabaseClient({ supabase, workspaceId } = {}) {
  async function execute(callback) {
    try {
      const result = await callback();
      return { data: result.data ?? null, error: result.error ?? null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async function loadItems(receptionIds) {
    if (!receptionIds.length) return { data: [], error: null };
    return execute(() => supabase
      .from('reception_items')
      .select(RECEPTION_ITEM_COLUMNS)
      .eq('workspace_id', workspaceId)
      .in('reception_id', receptionIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }));
  }

  async function aggregateRows(rows) {
    const values = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const items = await loadItems(values.map((row) => row.id));
    if (items.error) return items;
    const aggregates = values.map((reception) => ({
      reception,
      items: (items.data || []).filter((item) => (
        item.reception_id === reception.id
      )),
    }));
    return { data: Array.isArray(rows) ? aggregates : aggregates[0] || null, error: null };
  }

  async function insertReception(row, itemRows) {
    if (row.workspace_id !== workspaceId) {
      return failure('La recepción pertenece a otro workspace.');
    }
    const inserted = await execute(() => supabase
      .from('receptions')
      .insert(row)
      .select(RECEPTION_COLUMNS)
      .single());
    if (inserted.error) return inserted;
    if (itemRows.length) {
      const items = await execute(() => supabase
        .from('reception_items')
        .insert(itemRows)
        .select(RECEPTION_ITEM_COLUMNS));
      if (items.error) {
        await execute(() => supabase
          .from('receptions')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('id', inserted.data.id));
        return items;
      }
      return {
        data: { reception: inserted.data, items: items.data || [] },
        error: null,
      };
    }
    return { data: { reception: inserted.data, items: [] }, error: null };
  }

  async function updateReception(row, expectedVersion) {
    const result = await execute(() => supabase
      .from('receptions')
      .update({
        received_at: row.received_at,
        received_by: row.received_by,
        observations: row.observations,
        evidence: row.evidence,
        last_modified_by: row.last_modified_by,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', row.id)
      .eq('version', expectedVersion)
      .select(RECEPTION_COLUMNS)
      .maybeSingle());
    if (result.error) return result;
    if (!result.data) {
      return failure(
        'La recepción cambió en otra operación.',
        'RECEPTION_VERSION_CONFLICT',
      );
    }
    return aggregateRows(result.data);
  }

  async function deleteReception(receptionId, expectedVersion = null) {
    let query = supabase
      .from('receptions')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('id', receptionId);
    if (Number.isInteger(expectedVersion)) query = query.eq('version', expectedVersion);
    const result = await execute(() => query.select(RECEPTION_COLUMNS).maybeSingle());
    if (result.error) return result;
    if (!result.data) {
      return failure(
        'La recepción cambió o ya no existe.',
        'RECEPTION_VERSION_CONFLICT',
      );
    }
    return { data: result.data, error: null };
  }

  async function selectReception(receptionId) {
    const result = await execute(() => supabase
      .from('receptions')
      .select(RECEPTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .eq('id', receptionId)
      .maybeSingle());
    return result.error || !result.data ? result : aggregateRows(result.data);
  }

  async function selectReceptions(filters = {}) {
    let query = supabase
      .from('receptions')
      .select(RECEPTION_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('received_at', { ascending: false })
      .order('id', { ascending: true });
    if (filters.purchaseId) query = query.eq('purchase_id', filters.purchaseId);
    const result = await execute(() => query);
    if (result.error) return result;
    const aggregates = await aggregateRows(result.data || []);
    if (aggregates.error || !filters.purchaseItemId) return aggregates;
    return {
      data: aggregates.data.filter((aggregate) => (
        aggregate.items.some((item) => (
          item.purchase_item_id === filters.purchaseItemId
        ))
      )),
      error: null,
    };
  }

  const insertReceptionItem = (row) => execute(() => supabase
    .from('reception_items')
    .insert(row)
    .select(RECEPTION_ITEM_COLUMNS)
    .single());

  async function updateReceptionItem(row, expectedVersion) {
    const result = await execute(() => supabase
      .from('reception_items')
      .update({
        received_quantity: row.received_quantity,
        accepted_quantity: row.accepted_quantity,
        damaged_quantity: row.damaged_quantity,
        rejected_quantity: row.rejected_quantity,
        missing_quantity: row.missing_quantity,
        observations: row.observations,
        evidence: row.evidence,
        last_modified_by: row.last_modified_by,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', row.id)
      .eq('version', expectedVersion)
      .select(RECEPTION_ITEM_COLUMNS)
      .maybeSingle());
    return result.data ? result : result.error ? result : failure(
      'La partida cambió en otra operación.',
      'RECEPTION_VERSION_CONFLICT',
    );
  }

  async function selectReceptionItems(filters = {}) {
    let query = supabase
      .from('reception_items')
      .select(RECEPTION_ITEM_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    if (filters.receptionId) query = query.eq('reception_id', filters.receptionId);
    return execute(() => query);
  }

  return Object.freeze({
    insertReception,
    updateReception,
    deleteReception,
    selectReception,
    selectReceptions,
    insertReceptionItem,
    updateReceptionItem,
    selectReceptionItems,
  });
}
