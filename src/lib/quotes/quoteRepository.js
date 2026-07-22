import { supabase } from '../supabase/client';
import { normalizeQuotePayload } from './quoteAdapter.js';
import { normalizeEntityId } from '../identity/entityIdentity.js';

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

async function getQuoteInWorkspace(workspaceId, id) {
  return execute(() => supabase
    .from('quotes')
    .select(quoteColumns)
    .eq('workspace_id', workspaceId)
    .eq('id', id)
    .maybeSingle());
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

    const canonicalForm = normalizeQuotePayload(form);
    const id = normalizeEntityId(canonicalForm.id);
    if (!id) {
      return {
        data: null,
        error: Object.assign(new Error('La cotización requiere un UUID estable.'), {
          code: 'MISSING_STABLE_ENTITY_ID',
        }),
      };
    }

    const existing = await getQuoteInWorkspace(workspaceId, id);
    if (existing.error) return existing;
    if (existing.data) {
      return updateQuote(id, canonicalForm, Number(existing.data.version), workspaceId);
    }

    const quote = {
      id,
      workspace_id: workspaceId,
      created_by: user.id,
      folio: canonicalForm.folio,
      status: canonicalForm.status,
      client_name: canonicalForm.client_name,
      client_phone: canonicalForm.client_phone,
      product_name: canonicalForm.product_name,
      total: canonicalForm.total,
      deposit: canonicalForm.deposit,
      balance: canonicalForm.balance,
      form_data: canonicalForm.form_data,
    };

    const inserted = await supabase
      .from('quotes')
      .insert(quote)
      .select()
      .single();

    if (inserted.error?.code !== '23505') return inserted;
    const raced = await getQuoteInWorkspace(workspaceId, id);
    if (raced.error || !raced.data) return inserted;
    return updateQuote(id, canonicalForm, Number(raced.data.version), workspaceId);
  });
}

export async function updateQuote(id, form, expectedVersion, workspaceId = '') {
  if (!id) {
    return { data: null, error: new Error('Falta el identificador de la cotización.') };
  }

  return execute(async () => {
    const canonicalForm = normalizeQuotePayload(form);
    const quote = {
      status: canonicalForm.status,
      client_name: canonicalForm.client_name,
      client_phone: canonicalForm.client_phone,
      product_name: canonicalForm.product_name,
      total: canonicalForm.total,
      deposit: canonicalForm.deposit,
      balance: canonicalForm.balance,
      form_data: canonicalForm.form_data,
    };

    let query = supabase
      .from('quotes')
      .update(quote)
      .eq('id', id);

    const normalizedWorkspaceId = String(workspaceId || canonicalForm.workspace_id || '').trim();
    if (normalizedWorkspaceId) query = query.eq('workspace_id', normalizedWorkspaceId);

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

export function subscribeQuotes(workspaceId, callback, onStatus) {
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
      // Limpieza segura.
    }
  };
}
export function subscribeQuotePresence({
  workspaceId,
  quoteId,
  user,
  onSync,
  onStatus,
}) {
  if (!workspaceId || !quoteId || !user?.id) {
    return {
      track: async () => {},
      untrack: async () => {},
      unsubscribe: async () => {},
    };
  }

  const channel = supabase.channel(
    `quote-presence:${workspaceId}:${quoteId}`,
    {
      config: {
        presence: {
          key: user.id,
        },
      },
    }
  );

  channel
    .on("presence", { event: "sync" }, () => {
      const collaborators = Object
        .values(channel.presenceState())
        .flat();

      onSync?.(collaborators);
    })
    .subscribe(async (status) => {
      onStatus?.(status);

      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: user.id,
          name: user.name || user.email || "Usuario",
          email: user.email || "",
          workspaceId,
          quoteId,
          editing: false,
          fieldPath: null,
          updatedAt: new Date().toISOString(),
        });
      }
    });

  let closed = false;

  return {
    track: (presence = {}) =>
      channel.track({
        userId: user.id,
        name: user.name || user.email || "Usuario",
        email: user.email || "",
        workspaceId,
        quoteId,
        editing: !!presence.editing,
        fieldPath: presence.fieldPath || null,
        updatedAt: new Date().toISOString(),
      }),

    untrack: () => channel.untrack(),

    unsubscribe: async () => {
      if (closed) return;
      closed = true;
      await channel.untrack();
      await channel.unsubscribe();
    },
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
  subscribeQuotePresence,
};
