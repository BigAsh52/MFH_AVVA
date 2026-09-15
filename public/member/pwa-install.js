// "Add to Home Screen" — Avva is a web app (PWA), not something from the App
// Store/Play Store, so this is how a member gets a real icon on their phone.
// Android/Chrome fires beforeinstallprompt when it thinks the page qualifies
// (manifest + icons + a registered service worker); iOS Safari never fires
// that event, so it gets static instructions instead.

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/app/sw.js').catch(() => {});
}

(function () {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (isStandalone) return; // already installed — nothing to prompt

  const dismissedAt = localStorage.getItem('avva_install_dismissed_at');
  if (dismissedAt && Date.now() - Number(dismissedAt) < 14 * 24 * 3600 * 1000) return; // snoozed 14 days

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let deferredPrompt = null;

  function showBanner({ label, onClick }) {
    const bar = document.createElement('div');
    bar.id = 'installBanner';
    bar.style.cssText =
      'position:fixed; left:0; right:0; bottom:66px; max-width:480px; margin:0 auto; ' +
      'background:var(--primary,#0092ca); color:#fff; padding:10px 14px; display:flex; ' +
      'align-items:center; gap:10px; font-family:var(--font-body,sans-serif); font-size:0.85rem; z-index:20;';
    bar.innerHTML = `<span style="flex:1;">${label}</span>
      <button id="installBannerAction" style="background:#fff; color:var(--primary,#0092ca); border:none; border-radius:8px; padding:6px 10px; font-weight:700; cursor:pointer;">${isIos ? 'Got it' : 'Install'}</button>
      <button id="installBannerDismiss" aria-label="Dismiss" style="background:transparent; color:#fff; border:none; font-size:1.1rem; cursor:pointer; line-height:1;">×</button>`;
    document.body.appendChild(bar);
    document.getElementById('installBannerAction').addEventListener('click', onClick);
    document.getElementById('installBannerDismiss').addEventListener('click', () => {
      localStorage.setItem('avva_install_dismissed_at', String(Date.now()));
      bar.remove();
    });
  }

  if (isIos) {
    showBanner({
      label: 'Add Avva to your Home Screen: tap Share, then "Add to Home Screen".',
      onClick: () => {
        localStorage.setItem('avva_install_dismissed_at', String(Date.now()));
        document.getElementById('installBanner')?.remove();
      },
    });
  } else {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      showBanner({
        label: 'Add Avva to your Home Screen for one-tap access.',
        onClick: async () => {
          document.getElementById('installBanner')?.remove();
          if (deferredPrompt) {
            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
          }
        },
      });
    });
  }
})();
