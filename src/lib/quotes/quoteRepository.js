import { supabase } from '../supabase/client';

const quoteColumns = `
  id,
  workspace_id,
  created_by,
  legacy_id,
  folio,
  status,
  client_name,
  client_phone,
  product_name,
  total,
  deposit,
  balance,
  form_data,
  version,
  created_at,
  updated_at,
  deleted_at
`;

async function execute(query) {
  try {
    const { data, error } = await query();
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function loadQuotes(workspaceId) {
  if (!workspaceId) {
    return { data: [], error: new Error('Falta el identificador del workspace.') };
  }

  return execute(() => supabase
    .from('quotes')
    .select(quoteColumns)
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false }));
}

export async function getQuote(id) {
  if (!id) {
    return { data: null, error: new Error('Falta el identificador de la cotización.') };
  }

  return execute(() => supabase
    .from('quotes')
    .select(quoteColumns)
    .eq('id', id)
    .single());
}

export async function createQuote(workspaceId, form) {
  if (!workspaceId) {
    return { data: null, error: new Error('Falta el identificador del workspace.') };
  }

  return execute(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        data: null,
        error: userError || new Error('No existe un usuario autenticado.'),
      };
    }

    const quote = {
      workspace_id: workspaceId,
      created_by: user.id,
      folio: form.folio,
      status: form.status,
      client_name: form.client_name,
      client_phone: form.client_phone,
      product_name: form.product_name,
      total: form.total,
      deposit: form.deposit,
      balance: form.balance,
      form_data: form.form_data,
    };

    return supabase
      .from('quotes')
      .insert(quote)
      .select()
      .single();
  });
}

export async function updateQuote(id, form, expectedVersion) {
  if (!id) {
    return { data: null, error: new Error('Falta el identificador de la cotización.') };
  }

  return execute(async () => {
    const quote = {
      status: form.status,
      client_name: form.client_name,
      client_phone: form.client_phone,
      product_name: form.product_name,
      total: form.total,
      deposit: form.deposit,
      balance: form.balance,
      form_data: form.form_data,
    };

    if (Object.prototype.hasOwnProperty.call(form, 'folio')) {
      quote.folio = form.folio;
    }

    let query = supabase
      .from('quotes')
      .update(quote)
      .eq('id', id);

    if (Number.isInteger(expectedVersion) && expectedVersion > 0) {
      query = query.eq('version', expectedVersion);
    }

    const { data, error } = await query
      .select()
      .maybeSingle();

    if (!error && !data && Number.isInteger(expectedVersion) && expectedVersion > 0) {
      const conflictError = new Error(
        'La cotización fue modificada en otra sesión. Recarga antes de guardar.'
      );
      conflictError.code = 'QUOTE_VERSION_CONFLICT';
      return { data: null, error: conflictError };
    }

    return { data, error };
  });
}

export async function softDeleteQuote(id) {
  if (!id) {
    return { data: null, error: new Error('Falta el identificador de la cotización.') };
  }

  return execute(() => supabase
    .from('quotes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single());
}

export async function restoreQuote(id) {
  if (!id) {
    return { data: null, error: new Error('Falta el identificador de la cotización.') };
  }

  return execute(() => supabase
    .from('quotes')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single());
}

export function subscribeQuotes(workspaceId, callback) {
  if (!workspaceId || typeof callback !== 'function') {
    return function unsubscribe() {};
  }

  let channel;

  try {
    channel = supabase
      .channel(`quotes:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        callback,
      )
      .subscribe();
  } catch {
    return function unsubscribe() {};
  }

  return function unsubscribe() {
    try {
      void channel.unsubscribe();
    } catch {
      // La desuscripción debe ser segura para el consumidor.
    }
  };
}

export const QuoteRepository = {
  loadQuotes,
  getQuote,
  createQuote,
  updateQuote,
  softDeleteQuote,
  restoreQuote,
  subscribeQuotes,
};
