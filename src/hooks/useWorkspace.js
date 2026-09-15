import { useEffect, useRef, useState } from 'react';
import { WorkspaceService } from '../lib/workspace/workspaceService.js';
import { applyWorkspaceBranding } from '../lib/workspace/branding.js';
import {
  canManageQuotes,
  canManageUsers,
  canManageWorkspaceSettings,
} from '../lib/workspace/permissions.js';
import { storageHelpers } from '../app/config/helpers.js';
import { isProjectReadOnly } from '../lib/production/productionEngine.js';

const SELECTED_WORKSPACE_KEY = 'aluxor.selectedWorkspaceId';

function readSelectedWorkspaceId() {
  try { return globalThis.localStorage?.getItem(SELECTED_WORKSPACE_KEY) || ''; } catch { return ''; }
}

function saveSelectedWorkspaceId(id) {
  try { if (id) globalThis.localStorage?.setItem(SELECTED_WORKSPACE_KEY, id); } catch { /* best effort */ }
}

export function shouldBootstrapWorkspace(result, listed) {
  return Boolean(
    !result?.error
      && !result?.workspace
      && !listed?.error
      && (listed?.data || []).length === 0,
  );
}

export default function useWorkspace({
  authSession,
  catalogDefaults,
  defaultTypeDetails,
  setCatalog,
  setTypeDetails,
  StorageEngine,
  getActiveProductionOrder,
}) {
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [activeMembership, setActiveMembership] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceAccessStatus, setWorkspaceAccessStatus] = useState(null);
  const [workspaceResolutionVersion, setWorkspaceResolutionVersion] = useState(0);
  const [workspaceSettings, setWorkspaceSettings] = useState(null);
  const [workspaceSettingsSaving, setWorkspaceSettingsSaving] = useState(false);
  const [workspaceSettingsError, setWorkspaceSettingsError] = useState('');
  const [hydratedWorkspaceId, setHydratedWorkspaceId] = useState(null);
  const [appLogo, setAppLogo] = useState('');
  const [availableWorkspaces, setAvailableWorkspaces] = useState([]);
  const [workspaceCreationLoading, setWorkspaceCreationLoading] = useState(false);
  const [workspaceCreationError, setWorkspaceCreationError] = useState('');
  const [workspaceCreationSuccess, setWorkspaceCreationSuccess] = useState('');
  const workspaceCreationInFlightRef = useRef(false);

  function refreshWorkspace(options = {}) {
    if (options.reset) {
      setActiveWorkspace(null);
      setActiveMembership(null);
      setWorkspaceAccessStatus(null);
      setWorkspaceLoading(false);
      setWorkspaceError('');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'error')) {
      setWorkspaceError(options.error);
      return;
    }
    setWorkspaceResolutionVersion((version) => version + 1);
  }

  useEffect(() => {
    let active = true;
    const userId = authSession?.user?.id;

    if (!userId) {
      setActiveWorkspace(null);
      setActiveMembership(null);
      setWorkspaceSettings(null);
      setAppLogo('');
      setWorkspaceLoading(false);
      setWorkspaceError('');
      setWorkspaceAccessStatus(null);
      setAvailableWorkspaces([]);
      return () => { active = false; };
    }

    setWorkspaceLoading(true);
    setWorkspaceError('');

    async function resolveWorkspace() {
      const listed = await WorkspaceService.listWorkspaces(userId);
      if (!listed.error) setAvailableWorkspaces(listed.data || []);
      const preferredId = readSelectedWorkspaceId();
      let result = await WorkspaceService.getCurrentWorkspace(userId, preferredId);

      if (shouldBootstrapWorkspace(result, listed)) {
        result = await WorkspaceService.createInitialWorkspace({
          name: 'ALUXOR / BosqueReal',
        });
      }

      if (!active) return;

      if (result.error) {
        setActiveWorkspace(null);
        setActiveMembership(null);
        setWorkspaceAccessStatus(null);
        setWorkspaceError('No fue posible resolver tu workspace. Intenta nuevamente.');
        return;
      }

      setActiveWorkspace(result.workspace);
      setActiveMembership(result.membership);
      if (result.workspace?.id) saveSelectedWorkspaceId(result.workspace.id);
      setWorkspaceAccessStatus(
        result.workspace
          ? 'approved'
          : result.accessRequest?.status || 'pending'
      );
    }

    resolveWorkspace()
      .catch(() => {
        if (active) {
          setActiveWorkspace(null);
          setActiveMembership(null);
          setWorkspaceAccessStatus(null);
          setWorkspaceError('No fue posible resolver tu workspace. Intenta nuevamente.');
        }
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });

    return () => { active = false; };
  }, [authSession?.user?.id, workspaceResolutionVersion]);

  async function createWorkspace(name) {
    if (workspaceCreationInFlightRef.current || workspaceCreationLoading) {
      return { workspace: null, membership: null, error: new Error('CREATION_IN_PROGRESS') };
    }
    workspaceCreationInFlightRef.current = true;
    setWorkspaceCreationLoading(true);
    setWorkspaceCreationError('');
    setWorkspaceCreationSuccess('');
    let result;
    try {
      result = await WorkspaceService.createWorkspace(name);
    } catch (error) {
      result = { workspace: null, membership: null, error };
    }
    if (result.error) {
      setWorkspaceCreationError(result.error.message || 'No fue posible crear el negocio.');
      setWorkspaceCreationLoading(false);
      workspaceCreationInFlightRef.current = false;
      return result;
    }
    saveSelectedWorkspaceId(result.workspace?.id);
    setWorkspaceCreationSuccess(`Negocio creado: ${result.workspace?.name || String(name).trim()}`);
    setWorkspaceCreationLoading(false);
    workspaceCreationInFlightRef.current = false;
    setActiveWorkspace(null);
    setActiveMembership(null);
    setWorkspaceResolutionVersion((version) => version + 1);
    return result;
  }

  function selectWorkspace(workspaceId) {
    const selected = availableWorkspaces.find((entry) => entry.workspace?.id === workspaceId);
    if (!selected) return false;
    saveSelectedWorkspaceId(workspaceId);
    setActiveWorkspace(null);
    setActiveMembership(null);
    setWorkspaceResolutionVersion((version) => version + 1);
    return true;
  }

  useEffect(() => {
    const userId = authSession?.user?.id;
    if (!userId) return undefined;

    const handleWorkspaceChange = () => refreshWorkspace();
    const stopMembership = WorkspaceService.subscribeMembership(userId, handleWorkspaceChange);
    const stopAccessRequest = WorkspaceService.subscribeAccessRequest(userId, handleWorkspaceChange);

    return () => {
      stopMembership();
      stopAccessRequest();
    };
  }, [authSession?.user?.id]);

  useEffect(() => {
    const userId = authSession?.user?.id;
    const workspaceId = activeWorkspace?.id;
    if (!userId || !workspaceId) return undefined;

    let active = true;
    const blockAccess = (status) => {
      if (!active) return;
      setActiveWorkspace(null);
      setActiveMembership(null);
      setWorkspaceSettings(null);
      setAppLogo('');
      setWorkspaceAccessStatus(status === 'suspended' ? 'suspended' : 'revoked');
      setCatalog(catalogDefaults);
      setTypeDetails(defaultTypeDetails);
      setHydratedWorkspaceId(null);
    };

    const validateMembership = async () => {
      const result = await WorkspaceService.getWorkspaceMembership(workspaceId, userId);
      if (!active || result.error) return;
      if (!result.data || result.data.membership_status !== 'active') {
        blockAccess(result.data?.membership_status || 'revoked');
        return;
      }
      setActiveMembership(result.data);
    };

    void validateMembership();
    const interval = window.setInterval(validateMembership, 30_000);
    const onFocus = () => { void validateMembership(); };
    window.addEventListener('focus', onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [authSession?.user?.id, activeWorkspace?.id]);

  useEffect(() => {
    const workspaceId = activeWorkspace?.id;
    if (!workspaceId) return undefined;
    let active = true;

    const loadSettings = async () => {
      const result = await WorkspaceService.loadWorkspaceSettings(workspaceId);
      if (!active) return;
      if (result.error) {
        setWorkspaceSettingsError('No fue posible cargar la configuración del workspace.');
        return;
      }
      setWorkspaceSettings(result.data);
      setAppLogo(applyWorkspaceBranding(result.data));
      setWorkspaceSettingsError('');
    };

    void loadSettings();
    const stopSettings = WorkspaceService.subscribeWorkspaceSettings(workspaceId, loadSettings);
    return () => {
      active = false;
      stopSettings();
    };
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace?.id) {
      setHydratedWorkspaceId(null);
      return;
    }
    setCatalog(StorageEngine.loadCatalog(storageHelpers));
    setTypeDetails(StorageEngine.loadTypeDetails(storageHelpers));
    setHydratedWorkspaceId(activeWorkspace.id);
  }, [activeWorkspace?.id]);

  const currentWorkspaceRole = activeMembership?.role;
  const canManageWorkspaceAccess = canManageUsers(currentWorkspaceRole);
  const canEditWorkspaceQuotes = canManageQuotes(currentWorkspaceRole);
  const canEditWorkspaceSettings = canManageWorkspaceSettings(currentWorkspaceRole);

  async function handleLogoUpload(file, companyName) {
    if (!file || !activeWorkspace?.id || !canEditWorkspaceSettings
      || isProjectReadOnly(getActiveProductionOrder?.())) return;
    setWorkspaceSettingsSaving(true);
    setWorkspaceSettingsError('');
    const result = await WorkspaceService.uploadWorkspaceLogo({
      workspaceId: activeWorkspace.id,
      companyName,
      file,
    });
    if (result.error) setWorkspaceSettingsError(result.error.message || 'No fue posible guardar el logo.');
    else {
      setWorkspaceSettings(result.data);
      setAppLogo(applyWorkspaceBranding(result.data));
    }
    setWorkspaceSettingsSaving(false);
  }

  async function saveWorkspaceSettings(companyName) {
    if (!activeWorkspace?.id || !canEditWorkspaceSettings
      || isProjectReadOnly(getActiveProductionOrder?.())) return;
    setWorkspaceSettingsSaving(true);
    setWorkspaceSettingsError('');
    const result = await WorkspaceService.updateWorkspaceSettings({
      workspaceId: activeWorkspace.id,
      companyName,
      logoUrl: workspaceSettings?.logo_url || null,
    });
    if (result.error) setWorkspaceSettingsError(result.error.message || 'No fue posible guardar el nombre.');
    else {
      setWorkspaceSettings(result.data);
      setAppLogo(applyWorkspaceBranding(result.data));
    }
    setWorkspaceSettingsSaving(false);
  }

  async function removeAppLogo(companyName) {
    if (!activeWorkspace?.id || !canEditWorkspaceSettings
      || isProjectReadOnly(getActiveProductionOrder?.())) return;
    setWorkspaceSettingsSaving(true);
    setWorkspaceSettingsError('');
    const result = await WorkspaceService.updateWorkspaceSettings({
      workspaceId: activeWorkspace.id,
      companyName,
      logoUrl: null,
    });
    if (result.error) setWorkspaceSettingsError(result.error.message || 'No fue posible quitar el logo.');
    else {
      setWorkspaceSettings(result.data);
      setAppLogo(applyWorkspaceBranding(result.data));
    }
    setWorkspaceSettingsSaving(false);
  }

  return {
    activeWorkspace,
    activeMembership,
    workspaceLoading,
    workspaceError,
    workspaceAccessStatus,
    availableWorkspaces,
    workspaceCreationLoading,
    workspaceCreationError,
    workspaceCreationSuccess,
    workspaceSettings,
    workspaceSettingsSaving,
    workspaceSettingsError,
    hydratedWorkspaceId,
    appLogo,
    currentWorkspaceRole,
    canManageWorkspaceAccess,
    canEditWorkspaceQuotes,
    canEditWorkspaceSettings,
    refreshWorkspace,
    createWorkspace,
    selectWorkspace,
    saveWorkspaceSettings,
    handleLogoUpload,
    removeAppLogo,
  };
}
