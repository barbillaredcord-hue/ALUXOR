import { supabase } from '../supabase/client';

const BRANDING_BUCKET = 'workspace-branding';
const membershipSelection = `
  id,
  workspace_id,
  user_id,
  role,
  membership_status,
  created_by,
  created_at,
  updated_by,
  updated_at,
  workspace:workspaces (
    id,
    name,
    created_by,
    created_at,
    updated_at,
    deleted_at,
    is_shared
  )
`;

function normalizeResult(row) {
  if (!row) return { workspace: null, membership: null };
  const workspace = Array.isArray(row.workspace) ? row.workspace[0] ?? null : row.workspace ?? null;
  const { workspace: _relatedWorkspace, ...membership } = row;
  return { workspace, membership };
}

export async function getCurrentWorkspace(userId) {
  if (!userId) {
    return { workspace: null, membership: null, error: new Error('No se pudo identificar al usuario.') };
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select(membershipSelection)
    .eq('user_id', userId)
    .eq('membership_status', 'active')
    .order('created_at', { ascending: true });

  if (error) return { workspace: null, membership: null, error };
  const activeRows = data?.filter((row) => {
    const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    return workspace && !workspace.deleted_at;
  }) ?? [];
  const activeRow = activeRows.find((row) => {
    const workspace = Array.isArray(row.workspace) ? row.workspace[0] : row.workspace;
    return workspace?.is_shared;
  }) ?? activeRows[0];

  return { ...normalizeResult(activeRow), error: null };
}

export async function createInitialWorkspace({ name }) {
  const workspaceName = name?.trim() || 'ALUXOR / BosqueReal';
  const { data, error } = await supabase
    .rpc('get_or_create_initial_workspace', { workspace_name: workspaceName })
    .single();

  if (error) return { workspace: null, membership: null, accessRequest: null, error };
  return {
    workspace: data?.workspace ?? null,
    membership: data?.membership ?? null,
    accessRequest: data?.access_request ?? null,
    error: null,
  };
}

export async function getWorkspaceMembership(workspaceId, userId) {
  if (!workspaceId || !userId) return { data: null, error: new Error('Membresía inválida.') };
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, membership_status, created_by, created_at, updated_by, updated_at')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();
  return { data, error };
}

export async function loadAccessRequests(workspaceId) {
  if (!workspaceId) return { data: [], error: new Error('No se pudo identificar el workspace.') };
  const { data, error } = await supabase
    .from('workspace_access_requests')
    .select(`
      id, workspace_id, user_id, status, created_at, reviewed_at, reviewed_by,
      requester:profiles!workspace_access_requests_user_id_fkey (id, display_name)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

export async function loadWorkspaceMembers(workspaceId) {
  if (!workspaceId) return { data: [], error: new Error('No se pudo identificar el workspace.') };
  const membersResult = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, membership_status, created_by, created_at, updated_by, updated_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true });
  if (membersResult.error || !membersResult.data?.length) {
    return { data: membersResult.data ?? [], error: membersResult.error };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', membersResult.data.map((member) => member.user_id));
  if (profilesError) return { data: [], error: profilesError };
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return {
    data: membersResult.data.map((member) => ({ ...member, profile: profilesById.get(member.user_id) ?? null })),
    error: null,
  };
}

export async function reviewAccessRequest({ requestId, decision }) {
  if (!requestId || !['approved', 'rejected'].includes(decision)) {
    return { data: null, error: new Error('Solicitud o decisión inválida.') };
  }
  const { data, error } = await supabase.rpc('review_workspace_access_request', {
    request_id: requestId,
    decision,
  });
  return { data, error };
}

export async function manageWorkspaceMember({ workspaceId, userId, action, role = null }) {
  const { data, error } = await supabase.rpc('manage_workspace_member', {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    member_action: action,
    new_role: role,
  });
  return { data, error };
}

export async function loadWorkspaceSettings(workspaceId) {
  if (!workspaceId) return { data: null, error: new Error('Workspace inválido.') };
  const { data, error } = await supabase
    .from('workspace_settings')
    .select('workspace_id, company_name, logo_url, logo_version, updated_at, updated_by')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return { data, error };
}

export async function updateWorkspaceSettings({ workspaceId, companyName, logoUrl }) {
  const { data, error } = await supabase.rpc('update_workspace_settings', {
    target_workspace_id: workspaceId,
    next_company_name: companyName,
    next_logo_url: logoUrl,
  });
  return { data, error };
}

export async function uploadWorkspaceLogo({ workspaceId, companyName, file }) {
  if (!workspaceId || !file) return { data: null, error: new Error('Logo inválido.') };
  const extension = file.name?.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${workspaceId}/logo-${Date.now()}.${extension}`;
  const upload = await supabase.storage.from(BRANDING_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (upload.error) return { data: null, error: upload.error };
  const { data: publicUrl } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path);
  return updateWorkspaceSettings({ workspaceId, companyName, logoUrl: publicUrl.publicUrl });
}

export async function loadAuditLog(workspaceId) {
  const { data, error } = await supabase
    .from('workspace_audit_log')
    .select('id, actor_id, target_user_id, action, old_values, new_values, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);
  return { data: data ?? [], error };
}

function subscribeToTable({ table, filter, onChange }) {
  const channel = supabase
    .channel(`${table}:${filter}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange)
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}

export const subscribeMembership = (userId, onChange) => subscribeToTable({
  table: 'workspace_members', filter: `user_id=eq.${userId}`, onChange,
});
export const subscribeWorkspaceMembers = (workspaceId, onChange) => subscribeToTable({
  table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}`, onChange,
});
export const subscribeAccessRequest = (userId, onChange) => subscribeToTable({
  table: 'workspace_access_requests', filter: `user_id=eq.${userId}`, onChange,
});
export const subscribeWorkspaceAccessRequests = (workspaceId, onChange) => subscribeToTable({
  table: 'workspace_access_requests', filter: `workspace_id=eq.${workspaceId}`, onChange,
});
export const subscribeWorkspaceSettings = (workspaceId, onChange) => subscribeToTable({
  table: 'workspace_settings', filter: `workspace_id=eq.${workspaceId}`, onChange,
});

export const WorkspaceService = {
  getCurrentWorkspace,
  createInitialWorkspace,
  getWorkspaceMembership,
  loadAccessRequests,
  loadWorkspaceMembers,
  reviewAccessRequest,
  manageWorkspaceMember,
  loadWorkspaceSettings,
  updateWorkspaceSettings,
  uploadWorkspaceLogo,
  loadAuditLog,
  subscribeMembership,
  subscribeWorkspaceMembers,
  subscribeAccessRequest,
  subscribeWorkspaceAccessRequests,
  subscribeWorkspaceSettings,
};
