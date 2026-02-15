import { BrowserDetector } from '../interface/lib/browserDetector.js';
import { PermissionHandler } from '../interface/lib/permissionHandler.js';
import { LogHandler } from '../interface/lib/logHandler.js';

import { setupOptionFeatures } from './options/features.js';
import { setupMessaging } from './runtime/messaging.js';
import { setupCookiesChangedHandlers } from './runtime/cookiesChanged.js';

export function initCore() {
  const browserDetector = new BrowserDetector();
  const api = browserDetector.getApi();

  const permissionHandler = new PermissionHandler(browserDetector);
  const logHandler = new LogHandler(browserDetector);

  const storage = api.storage;
  const notificationsApi = api.notifications;

  let cachedOptions = null;
  let optionsLastFetched = 0;

  async function fetchOptionsSnapshot(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedOptions && now - optionsLastFetched < 5000) {
      return cachedOptions;
    }

    if (!storage?.local) {
      cachedOptions = {};
      optionsLastFetched = now;
      return cachedOptions;
    }

    if (browserDetector.supportsPromises()) {
      const result = await storage.local.get('all_options');
      cachedOptions = result?.all_options || {};
    } else {
      cachedOptions = await new Promise((resolve) => {
        storage.local.get('all_options', (res) => {
          resolve((res && res.all_options) || {});
        });
      });
    }

    optionsLastFetched = now;
    return cachedOptions;
  }

  function resetOptionsCache() {
    cachedOptions = null;
    optionsLastFetched = 0;
  }

  const ctx = {
    api,
    browserDetector,
    permissionHandler,
    logHandler,
    storage,
    notificationsApi,
    fetchOptionsSnapshot,
    resetOptionsCache,
  };

  const messaging = setupMessaging(ctx);
  setupCookiesChangedHandlers(ctx, messaging);
  setupOptionFeatures(ctx);

  setupPlatformSpecificUi(ctx);
}

function setupPlatformSpecificUi(ctx) {
  const { browserDetector, api } = ctx;

  isFirefoxAndroid(browserDetector, (response) => {
    if (!response) return;
    api.action.setPopup({ popup: '/interface/popup-mobile/cookie-list.html' });
  });

  isSafariIos(browserDetector, (response) => {
    if (!response) return;
    api.action.setPopup({ popup: '/interface/popup-mobile/cookie-list.html' });
  });

  if (browserDetector.supportsSidePanel()) {
    api.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  }
}

function isFirefoxAndroid(browserDetector, callback) {
  if (!browserDetector.isFirefox()) {
    callback(false);
    return;
  }

  browserDetector
    .getApi()
    .runtime.getPlatformInfo()
    .then((info) => {
      callback(info.os === 'android');
    });
}

function isSafariIos(browserDetector, callback) {
  if (!browserDetector.isSafari()) {
    callback(false);
    return;
  }

  browserDetector
    .getApi()
    .runtime.getPlatformInfo()
    .then((info) => {
      callback(info.os === 'ios');
    });
}
