(() => {
  'use strict';

  const VERSION = '47';
  let deferredInstallPrompt = null;
  let registration = null;
  let reloadingForUpdate = false;

  const installButton = document.querySelector('[data-pwa-install]');
  const updateButton = document.querySelector('[data-pwa-update-check]');
  const statusNode = document.querySelector('[data-pwa-install-status]');
  const badgeNode = document.querySelector('[data-pwa-install-badge]');

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const isIOS = () => {
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  };

  function setInstallStatus(message, badge = '') {
    if (statusNode) statusNode.textContent = message;
    if (badgeNode && badge) badgeNode.textContent = badge;
  }

  function updateInstallInterface() {
    if (isStandalone()) {
      if (installButton) installButton.hidden = true;
      setInstallStatus(
        'Il tracker è già aperto in modalità app su questo dispositivo.',
        'Installata'
      );
      return;
    }

    if (deferredInstallPrompt) {
      if (installButton) installButton.hidden = false;
      setInstallStatus(
        'Il browser è pronto: usa il pulsante per aggiungere il tracker come app.',
        'Pronta'
      );
      return;
    }

    if (installButton) installButton.hidden = true;

    if (isIOS()) {
      setInstallStatus(
        'Su iPhone o iPad apri il tracker in Safari, usa Condividi e scegli “Aggiungi alla schermata Home”.',
        'Da Safari'
      );
    } else {
      setInstallStatus(
        'L’installazione può essere avviata dal menu del browser quando il sito soddisfa i requisiti del dispositivo.',
        'Disponibile dal browser'
      );
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallInterface();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallInterface();
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) {
      updateInstallInterface();
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallInterface();
  });

  function showUpdateToast(waitingWorker) {
    if (document.querySelector('[data-pwa-update-toast]')) return;

    const toast = document.createElement('aside');
    toast.className = 'pwa-update-toast';
    toast.dataset.pwaUpdateToast = '';
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <strong>È disponibile un aggiornamento</strong>
      <span>Ricarica il tracker per usare la versione più recente.</span>
      <button type="button">Aggiorna adesso</button>
    `;

    toast.querySelector('button')?.addEventListener('click', () => {
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
    });

    document.body.appendChild(toast);
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      setInstallStatus(
        'Questo browser non supporta l’installazione completa come app.',
        'Non supportata'
      );
      return;
    }

    try {
      registration = await navigator.serviceWorker.register(
        `./service-worker.js?v=${VERSION}`,
        { scope: './' }
      );

      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(registration.waiting);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (
            installingWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            showUpdateToast(installingWorker);
          }
        });
      });

      updateInstallInterface();
    } catch (error) {
      console.warn('Registrazione PWA non riuscita.', error);
      setInstallStatus(
        'La modalità app non è stata registrata. Controlla la connessione e riprova.',
        'Errore'
      );
    }
  }

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });

  updateButton?.addEventListener('click', async () => {
    if (!registration) {
      setInstallStatus(
        'Il controllo degli aggiornamenti sarà disponibile dopo il caricamento completo della pagina.',
        'In attesa'
      );
      return;
    }

    try {
      await registration.update();
      setInstallStatus(
        'Controllo completato. Se esiste una nuova versione comparirà un avviso.',
        isStandalone() ? 'Installata' : 'Aggiornata'
      );
    } catch (error) {
      console.warn('Controllo aggiornamenti non riuscito.', error);
      setInstallStatus(
        'Non è stato possibile controllare gli aggiornamenti. Riprova quando la connessione è stabile.',
        'Non riuscito'
      );
    }
  });

  function ensureNetworkBanner() {
    let banner = document.querySelector('[data-pwa-network-banner]');

    if (navigator.onLine) {
      banner?.remove();
      return;
    }

    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'pwa-network-banner';
      banner.dataset.pwaNetworkBanner = '';
      banner.setAttribute('role', 'status');
      banner.textContent = 'Sei offline: le modifiche restano salvate sul dispositivo.';
      document.body.appendChild(banner);
    }
  }

  window.addEventListener('offline', ensureNetworkBanner);

  window.addEventListener('online', () => {
    ensureNetworkBanner();

    if (window.TrackerStore?.bootstrapRemoteSync) {
      window.TrackerStore.bootstrapRemoteSync({ force: true }).catch((error) => {
        console.warn('Sincronizzazione al ritorno online non riuscita.', error);
      });
    }
  });

  window.addEventListener('load', () => {
    updateInstallInterface();
    ensureNetworkBanner();
    registerServiceWorker();
  });
})();
