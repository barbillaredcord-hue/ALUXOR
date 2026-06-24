export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        registration.update();
      })
      .catch(() => {
        // La app funciona aunque el navegador no permita instalarla como PWA.
      });
  });
}
