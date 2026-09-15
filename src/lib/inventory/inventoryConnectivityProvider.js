export function createInventoryConnectivityProvider({ navigatorObject } = {}) {
  const source = navigatorObject ?? (typeof navigator === 'undefined' ? null : navigator);
  return Object.freeze({ isOnline: () => source?.onLine !== false });
}
