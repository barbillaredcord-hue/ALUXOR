import { describe, expect, it } from 'vitest';
import {
  createBrowserConnectivityProvider,
} from './connectivityProvider.js';

describe('Optimization Sessions connectivity provider', () => {
  it('expone conectividad online inyectada', () => {
    const provider = createBrowserConnectivityProvider({
      navigatorObject: { onLine: true },
    });
    expect(provider.isOnline()).toBe(true);
  });

  it('expone conectividad offline inyectada', () => {
    const provider = createBrowserConnectivityProvider({
      navigatorObject: { onLine: false },
    });
    expect(provider.isOnline()).toBe(false);
  });

  it('usa offline como estrategia segura sin navigator', () => {
    const provider = createBrowserConnectivityProvider({
      navigatorObject: null,
    });
    expect(provider.isOnline()).toBe(false);
    expect(Object.isFrozen(provider)).toBe(true);
  });
});
