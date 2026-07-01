/**
 * BR Design System
 * Z-Index Tokens v1.0
 *
 * Jerarquía oficial de capas.
 * Evitar números "mágicos" distribuidos por la aplicación.
 */

export const zIndex = {
  base: 0,

  content: 10,

  sticky: 100,

  header: 200,

  sidebar: 250,

  companion: 300,

  dropdown: 500,

  popover: 600,

  tooltip: 700,

  overlay: 800,

  drawer: 900,

  modal: 1000,

  notification: 1100,

  loading: 1200,

  debug: 9999
};

export const layers = {
  app: zIndex.base,
  workspace: zIndex.content,
  workspaceHeader: zIndex.header,
  sidebar: zIndex.sidebar,
  projectCompanion: zIndex.companion,
  menu: zIndex.dropdown,
  tooltip: zIndex.tooltip,
  modal: zIndex.modal,
  loadingScreen: zIndex.loading,
  notifications: zIndex.notification
};

export default zIndex;