export function loadCatalog(helpers = {}) {
  const { catalogDefaults = [], normalizeCatalogItem = (item) => item } = helpers;
  try {
    const stored = localStorage.getItem('anunciapro.catalog');
    const items = stored ? JSON.parse(stored) : catalogDefaults;
    return items.map(normalizeCatalogItem);
  } catch {
    return catalogDefaults.map(normalizeCatalogItem);
  }
}

export function saveCatalog(catalog) {
  localStorage.setItem('anunciapro.catalog', JSON.stringify(catalog));
}

export function loadHistory(helpers = {}) {
  const { normalizeHistory = (items) => items } = helpers;
  try {
    const stored = localStorage.getItem('anunciapro.history');
    return stored ? normalizeHistory(JSON.parse(stored)) : [];
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  localStorage.setItem('anunciapro.history', JSON.stringify(history));
}

export function loadTypeDetails(helpers = {}) {
  const { defaultTypeDetails = [] } = helpers;
  try {
    const stored = localStorage.getItem('anunciapro.typeDetails');
    const items = stored ? JSON.parse(stored) : defaultTypeDetails;
    return Array.isArray(items) ? items : defaultTypeDetails;
  } catch {
    return defaultTypeDetails;
  }
}

export function saveTypeDetails(typeDetails) {
  localStorage.setItem('anunciapro.typeDetails', JSON.stringify(typeDetails));
}

export function saveSettings(settings = {}) {
  if (settings.typeDetails) saveTypeDetails(settings.typeDetails);
}

export function loadAppLogo() {
  try {
    return localStorage.getItem('anunciapro.logo') || '';
  } catch {
    return '';
  }
}

export function saveLogo(appLogo) {
  try {
    if (appLogo) localStorage.setItem('anunciapro.logo', appLogo);
    else localStorage.removeItem('anunciapro.logo');
  } catch {
    // El logo personalizado es opcional.
  }
}
