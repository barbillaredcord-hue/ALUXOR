export const WORKSPACE_ROLES = [
  'owner',
  'admin',
  'editor',
  'sales',
  'production',
  'purchasing',
  'warehouse',
  'installer',
  'viewer',
];

export const ROLE_LABELS = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  sales: 'Ventas',
  production: 'Producción',
  purchasing: 'Compras',
  warehouse: 'Almacén',
  installer: 'Instalación',
  viewer: 'Solo lectura',
};

const ALL_OPERATIONAL_PERMISSIONS = {
  manageQuotes: true,
  manageProduction: true,
  managePurchasing: true,
  manageInventory: true,
  manageInstallation: true,
};

export const ROLE_PERMISSIONS = Object.freeze({
  owner: Object.freeze({
    manageUsers: true,
    changeRoles: true,
    manageWorkspaceSettings: true,
    viewAudit: true,
    ...ALL_OPERATIONAL_PERMISSIONS,
  }),
  admin: Object.freeze({
    manageUsers: true,
    changeRoles: true,
    manageWorkspaceSettings: true,
    viewAudit: true,
    ...ALL_OPERATIONAL_PERMISSIONS,
  }),
  editor: Object.freeze({
    manageUsers: false,
    changeRoles: false,
    manageWorkspaceSettings: false,
    viewAudit: false,
    ...ALL_OPERATIONAL_PERMISSIONS,
  }),
  sales: Object.freeze({ manageQuotes: true }),
  production: Object.freeze({ manageProduction: true }),
  purchasing: Object.freeze({ managePurchasing: true }),
  warehouse: Object.freeze({ manageInventory: true }),
  installer: Object.freeze({ manageInstallation: true }),
  viewer: Object.freeze({}),
});

const ROLE_SECTIONS = Object.freeze({
  owner: '*',
  admin: '*',
  editor: [
    'inicio', 'anuncio', 'cotizador-rellenado', 'cotizador', 'produccion',
    'compras', 'recepcion', 'inventario', 'fabricacion', 'corte', 'catalogo',
    'historial', 'textos', 'plano',
  ],
  sales: ['inicio', 'anuncio', 'cotizador-rellenado', 'cotizador', 'historial', 'textos', 'plano'],
  production: ['inicio', 'produccion', 'fabricacion', 'corte', 'catalogo', 'plano'],
  purchasing: ['inicio', 'compras', 'recepcion', 'catalogo'],
  warehouse: ['inicio', 'recepcion', 'inventario', 'catalogo'],
  installer: ['inicio', 'produccion', 'plano'],
  viewer: ['inicio', 'historial'],
});

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.[permission] === true;
}

export const canManageUsers = (role) => hasPermission(role, 'manageUsers');
export const canChangeRoles = (role) => hasPermission(role, 'changeRoles');
export const canManageWorkspaceSettings = (role) => hasPermission(role, 'manageWorkspaceSettings');
export const canManageQuotes = (role) => hasPermission(role, 'manageQuotes');
export const canManageProduction = (role) => hasPermission(role, 'manageProduction');
export const canManagePurchasing = (role) => hasPermission(role, 'managePurchasing');
export const canManageInventory = (role) => hasPermission(role, 'manageInventory');
export const canManageInstallation = (role) => hasPermission(role, 'manageInstallation');
export const canViewAudit = (role) => hasPermission(role, 'viewAudit');

export function canManageMember(actorRole, targetRole) {
  return canManageUsers(actorRole) && !(actorRole === 'admin' && targetRole === 'owner');
}

export function canAssignRole(actorRole, targetRole, nextRole) {
  return canChangeRoles(actorRole)
    && canManageMember(actorRole, targetRole)
    && (actorRole === 'owner' || nextRole !== 'owner');
}

export function canAccessSection(role, sectionId) {
  const sections = ROLE_SECTIONS[role];
  return sections === '*' || sections?.includes(sectionId) === true;
}
