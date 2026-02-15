import { CookieAnalyzer } from '../../interface/lib/cookieAnalyzer.js';

const CHAMELEON_STATE_KEY = 'chameleon_state_v1';
const CHAMELEON_ALARM_NAME = 'chameleon_tick_v1';
const CHAMELEON_TICK_MINUTES = 5;
const CHAMELEON_MIN_DELAY_MINUTES = 5;
const CHAMELEON_MAX_DELAY_MINUTES = 10;

export function setupChameleon(ctx) {
  const alarmsApi = ctx.api?.alarms;
  if (!alarmsApi || typeof alarmsApi.create !== 'function') {
    return;
  }

  ctx.api.runtime.onStartup.addListener(() => setupChameleonAlarm(ctx));
  ctx.api.runtime.onInstalled.addListener(() => setupChameleonAlarm(ctx));
  alarmsApi.onAlarm.addListener((alarm) => onAlarm(ctx, alarm));
  setupChameleonAlarm(ctx);
}

async function setupChameleonAlarm(ctx) {
  const alarmsApi = ctx.api?.alarms;
  if (!alarmsApi || typeof alarmsApi.create !== 'function') return;

  try {
    alarmsApi.create(CHAMELEON_ALARM_NAME, { periodInMinutes: CHAMELEON_TICK_MINUTES });
  } catch (_error) {
  }
}

async function onAlarm(ctx, alarm) {
  if (!alarm || alarm.name !== CHAMELEON_ALARM_NAME) return;
  await runChameleonTick(ctx);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getCookieKey(cookie) {
  return `${cookie.name};${cookie.domain};${cookie.path}`;
}

function buildCookieUrl(cookie) {
  const domain = (cookie.domain || '').replace(/^\./, '');
  const path = cookie.path || '/';
  const scheme = cookie.secure ? 'https://' : 'http://';
  return `${scheme}${domain}${path}`;
}

function obfuscateValuePreserveStructure(value) {
  if (typeof value !== 'string') {
    value = String(value ?? '');
  }
  if (!value) return value;

  let out = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);

    if (code >= 48 && code <= 57) {
      out += String.fromCharCode(48 + randomInt(0, 9));
      continue;
    }
    if (code >= 65 && code <= 90) {
      out += String.fromCharCode(65 + randomInt(0, 25));
      continue;
    }
    if (code >= 97 && code <= 122) {
      out += String.fromCharCode(97 + randomInt(0, 25));
      continue;
    }
    out += ch;
  }
  return out;
}

async function loadChameleonState(ctx) {
  if (!ctx.storage?.local) return {};
  const result = await ctx.storage.local.get(CHAMELEON_STATE_KEY);
  return result?.[CHAMELEON_STATE_KEY] || {};
}

async function saveChameleonState(ctx, state) {
  if (!ctx.storage?.local) return;
  await ctx.storage.local.set({ [CHAMELEON_STATE_KEY]: state });
}

async function runChameleonTick(ctx) {
  const optionsSnapshot = await ctx.fetchOptionsSnapshot();
  if (optionsSnapshot?.profilingProtectionEnabled !== true) return;
  if (optionsSnapshot?.mlEnabled === false) return;

  const thresholdPercent = Number(optionsSnapshot?.profilingProtectionThresholdPercent);
  const threshold = Number.isFinite(thresholdPercent)
    ? Math.min(100, Math.max(0, thresholdPercent)) / 100
    : 0.95;

  const api = ctx.api;
  if (!api?.cookies?.getAll || !api?.cookies?.set) return;

  const now = Date.now();
  const state = await loadChameleonState(ctx);
  const cookies = await api.cookies.getAll({});

  let dirty = false;

  for (const cookie of cookies) {
    if (!cookie) continue;

    if (!cookie.expirationDate) {
      continue;
    }

    const cookieKey = getCookieKey(cookie);
    const entry = state[cookieKey];
    const nextAt = entry?.nextAt;
    if (typeof nextAt === 'number' && nextAt > now) {
      continue;
    }

    let analysis;
    try {
      analysis = CookieAnalyzer.analyze(cookie);
    } catch (_error) {
      continue;
    }

    const confidence = Number(analysis?.adProbability);
    const label = Number(analysis?.label);
    if (label !== 1) {
      continue;
    }
    if (!(confidence >= threshold)) {
      continue;
    }

    const newValue = obfuscateValuePreserveStructure(cookie.value);
    if (newValue === cookie.value) {
      continue;
    }

    try {
      const url = buildCookieUrl(cookie);
      await api.cookies.set({
        url,
        name: cookie.name,
        value: newValue,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate,
        storeId: cookie.storeId,
      });

      const delayMinutes = randomInt(CHAMELEON_MIN_DELAY_MINUTES, CHAMELEON_MAX_DELAY_MINUTES);
      state[cookieKey] = { nextAt: now + delayMinutes * 60 * 1000 };
      dirty = true;
    } catch (_error) {
    }
  }

  if (dirty) {
    await saveChameleonState(ctx, state);
  }
}
