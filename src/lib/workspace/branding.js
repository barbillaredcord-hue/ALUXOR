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
  const iconUrl = logoUrl || '/icons/icon-192.png';
  const appleTouchIconUrl = logoUrl || '/apple-touch-icon.png';

  document.title = companyName;
  ensureLink('icon').href = iconUrl;
  ensureLink('apple-touch-icon').href = appleTouchIconUrl;

  const manifest = {
    name: companyName,
    short_name: companyName.slice(0, 30),
    start_url: '/',
    display: 'standalone',
    background_color: '#0b1f18',
    theme_color: '#0b1f18',
    icons: logoUrl
      ? [{ src: iconUrl, sizes: 'any', type: 'image/png', purpose: 'any maskable' }]
      : [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
  };
  const nextManifestUrl = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
  );
  ensureLink('manifest').href = nextManifestUrl;
  if (manifestObjectUrl) URL.revokeObjectURL(manifestObjectUrl);
  manifestObjectUrl = nextManifestUrl;

  return logoUrl;
}
