import { supabase } from '../supabase/client';

const membershipSelection = `
  id,
  workspace_id,
  user_id,
  role,
  created_at,
  workspace:workspaces (
    id,
    name,
    created_by,
    created_at,
    updated_at,
    deleted_at
  )
`;

function normalizeResult(row) {
  if (!row) return { workspace: null, membership: null };

  const workspace = Array.isArray(row.workspace)
    ? row.workspace[0] ?? null
    : row.workspace ?? null;
  const { workspace: _relatedWorkspace, ...membership } = row;

  return { workspace, membership };
}

export async function getCurrentWorkspace(userId) {
  if (!userId) {
    return {
      workspace: null,
      membership: null,
      error: new Error('No se pudo identificar al usuario.'),
    };
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select(membershipSelection)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) return { workspace: null, membership: null, error };

  const activeRow = data?.find((row) => {
    const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    return workspace && !workspace.deleted_at;
  });

  return { ...normalizeResult(activeRow), error: null };
}

export async function createInitialWorkspace({ name }) {
  const workspaceName = name?.trim() || 'ALUXOR / BosqueReal';
  const { data, error } = await supabase
    .rpc('get_or_create_initial_workspace', { workspace_name: workspaceName })
    .single();

  if (error) return { workspace: null, membership: null, error };

  return {
    workspace: data?.workspace ?? null,
    membership: data?.membership ?? null,
    error: null,
  };
}

export const WorkspaceService = {
  getCurrentWorkspace,
  createInitialWorkspace,
};
