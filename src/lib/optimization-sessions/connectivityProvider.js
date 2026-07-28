export function createBrowserConnectivityProvider({
  navigatorObject = typeof navigator === 'undefined' ? null : navigator,
} = {}) {
  return Object.freeze({
    isOnline() {
      return navigatorObject && typeof navigatorObject.onLine === 'boolean'
        ? navigatorObject.onLine
        : false;
    },
  });
}
