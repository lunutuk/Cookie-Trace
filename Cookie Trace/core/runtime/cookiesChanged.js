import { scanCookieValueForPII } from '../../interface/lib/piiDetector.js';

const COOKIE_CACHE_KEY = 'cookie_cache';

const PII_NOTIFICATION_CACHE = new Map();
const PII_SEVERITY_WEIGHT = { critical: 3, high: 2, medium: 1, low: 0 };

export function setupCookiesChangedHandlers(ctx, messaging) {
  ctx.api.tabs.onUpdated.addListener((tabId, changeInfo, _tab) => {
    messaging.sendMessageToTab(tabId, 'tabsChanged', changeInfo);
  });

  ctx.api.runtime.onStartup.addListener(() => populateCookieCache(ctx));
  ctx.api.runtime.onInstalled.addListener(() => populateCookieCache(ctx));

  if (!ctx.browserDetector.isSafari()) {
    ctx.api.cookies.onChanged.addListener((changeInfo) => onCookiesChanged(ctx, messaging, changeInfo));
  }
}

function getCookieKey(cookie) {
  return `${cookie.name};${cookie.domain};${cookie.path}`;
}

async function populateCookieCache(ctx) {
  const allCookies = await ctx.api.cookies.getAll({});
  const cache = {};
  for (const cookie of allCookies) {
    cache[getCookieKey(cookie)] = cookie;
  }
  await ctx.storage.session.set({ [COOKIE_CACHE_KEY]: cache });
}

function buildPiiSignature(cookieKey, findings) {
  const important = findings.slice(0, 5).map((item) => `${item.label}:${item.value}`);
  return `${cookieKey}:${important.join('|')}`;
}

function truncateValue(value, limit = 40) {
  if (typeof value !== 'string') {
    value = String(value ?? '');
  }
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function formatPiiNotificationMessage(cookie, findings, wasDecoded) {
  const firstFindings = findings.slice(0, 3).map((item) => `• ${item.label}: ${truncateValue(item.value)}`);
  let message = `Cookie ${cookie.name || 'без имени'} (${cookie.domain || 'домен неизвестен'}) содержит ${findings.length} потенциальные PII:`;
  if (wasDecoded) {
    message += ' Значение было декодировано из Base64.';
  }
  if (firstFindings.length) {
    message += `\n${firstFindings.join('\n')}`;
  }
  if (message.length > 250) {
    message = `${message.slice(0, 247)}…`;
  }
  return message;
}

async function maybeNotifyPii(ctx, newCookie) {
  if (!newCookie || !newCookie.value || !ctx.notificationsApi || typeof ctx.notificationsApi.create !== 'function') {
    return;
  }

  const optionsSnapshot = await ctx.fetchOptionsSnapshot();
  const scanMode = optionsSnapshot?.piiScanMode || 'off';
  if (scanMode === 'off') {
    return;
  }

  if (optionsSnapshot?.piiBrowserNotificationsEnabled === false) {
    return;
  }

  const cookieKey = getCookieKey(newCookie);
  const scanResult = scanCookieValueForPII(newCookie.value, scanMode);
  if (!scanResult?.foundPII?.length) {
    PII_NOTIFICATION_CACHE.delete(cookieKey);
    return;
  }

  const sortedFindings = [...scanResult.foundPII].sort((a, b) => {
    const left = PII_SEVERITY_WEIGHT[b.severity || 'medium'] || 0;
    const right = PII_SEVERITY_WEIGHT[a.severity || 'medium'] || 0;
    return left - right;
  });

  const signature = buildPiiSignature(cookieKey, sortedFindings);
  if (PII_NOTIFICATION_CACHE.get(cookieKey) === signature) {
    return;
  }

  PII_NOTIFICATION_CACHE.set(cookieKey, signature);
  if (PII_NOTIFICATION_CACHE.size > 500) {
    const oldestKey = PII_NOTIFICATION_CACHE.keys().next().value;
    if (oldestKey) {
      PII_NOTIFICATION_CACHE.delete(oldestKey);
    }
  }

  const notificationId = `pii-${Date.now()}-${Math.random()}`;
  const notificationOptions = {
    type: 'basic',
    iconUrl: ctx.api.runtime.getURL('icons/128.png'),
    title: '🚨 Cookie Trace: обнаружены PII',
    message: formatPiiNotificationMessage(newCookie, sortedFindings, scanResult.wasDecoded),
    priority: 2,
  };

  try {
    ctx.notificationsApi.create(notificationId, notificationOptions);
  } catch (_error) {
  }
}

async function onCookiesChanged(ctx, messaging, changeInfo) {
  const cacheResult = await ctx.storage.session.get(COOKIE_CACHE_KEY);
  const cache = cacheResult[COOKIE_CACHE_KEY] || {};

  const cookieKey = getCookieKey(changeInfo.cookie);
  let oldCookie = cache[cookieKey] || null;
  const newCookie = changeInfo.removed ? null : changeInfo.cookie;

  if (changeInfo.removed && !oldCookie) {
    oldCookie = changeInfo.cookie;
  }

  const nextActionSource = messaging.getNextActionSource();

  await ctx.logHandler.addLog(oldCookie, newCookie, nextActionSource);

  if (newCookie) {
    await maybeNotifyPii(ctx, newCookie);
  } else {
    PII_NOTIFICATION_CACHE.delete(cookieKey);
  }

  messaging.resetNextActionSource();

  if (newCookie) {
    cache[cookieKey] = newCookie;
  } else {
    delete cache[cookieKey];
  }

  await ctx.storage.session.set({ [COOKIE_CACHE_KEY]: cache });
  messaging.sendMessageToAllTabs('cookiesChanged', changeInfo);
}
