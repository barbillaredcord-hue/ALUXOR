let manifestObjectUrl = '';

function versionedLogoUrl(settings) {
  if (!settings?.logo_url) return '';
  const separator = settings.logo_url.includes('?') ? '&' : '?';
  return `${settings.logo_url}${separator}v=${settings.logo_version || 0}`;
}

function ensureLink(rel) {
  let link = document.head.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  return link;
}

export function applyWorkspaceBranding(settings) {
  if (typeof document === 'undefined') return '';

  const companyName = settings?.company_name || 'ALUXOR / BosqueReal';
  const logoUrl = versionedLogoUrl(settings);
  const iconUrl = logoUrl || '/icons/icon.svg';

  document.title = companyName;
  ensureLink('icon').href = iconUrl;
  ensureLink('apple-touch-icon').href = iconUrl;

  const manifest = {
    name: companyName,
    short_name: companyName.slice(0, 30),
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1210',
    theme_color: '#0b1210',
    icons: [{ src: iconUrl, sizes: 'any', type: 'image/png', purpose: 'any maskable' }],
  };
  const nextManifestUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  );
  ensureLink('manifest').href = nextManifestUrl;
  if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
  manifestObjectUrl = nextManifestUrl;

  return logoUrl;
}
