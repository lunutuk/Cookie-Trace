import { predict, predictProba, predictPercent } from '../../ml/mlClassifier.js';

const TRAINING_BASE_TIMESTAMP = 1707145200;

function shannonEntropyBase2(text) {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  const len = text.length;
  if (len === 0) {
    return 0;
  }

  const freq = new Map();
  for (let i = 0; i < len; i++) {
    const ch = text[i];
    freq.set(ch, (freq.get(ch) || 0) + 1);
  }

  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function digitRatio(text) {
  if (typeof text !== 'string') {
    text = String(text ?? '');
  }

  const len = text.length;
  if (len === 0) {
    return 0;
  }

  let digits = 0;
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code >= 48 && code <= 57) {
      digits++;
    }
  }

  return digits / len;
}

function ttlHours(cookie) {
  if (!cookie || !cookie.expirationDate) {
    return 0;
  }

  const expiration = Number(cookie.expirationDate);
  if (!Number.isFinite(expiration)) {
    return 0;
  }

  return (expiration - TRAINING_BASE_TIMESTAMP) / 3600;
}

export const CookieAnalyzer = {
  getFeatures(cookie) {
    const name = cookie?.name ?? '';
    const value = cookie?.value ?? '';

    const features = [
      name.length,
      value.length,
      shannonEntropyBase2(value),
      digitRatio(value),
      cookie?.secure ? 1 : 0,
      cookie?.httpOnly ? 1 : 0,
      ttlHours(cookie),
    ];

    return features;
  },

  analyze(cookie) {
    const features = this.getFeatures(cookie);
    const raw = predict(features);
    const proba = predictProba(features);
    const percent = predictPercent(features);

    const p0 = Array.isArray(proba) ? Number(proba[0]) : NaN;
    const p1 = Array.isArray(proba) ? Number(proba[1]) : NaN;
    const label = Number.isFinite(p0) && Number.isFinite(p1) ? (p1 > p0 ? 1 : 0) : 0;
    const adProbability = Number.isFinite(p1) ? p1 : 0;
    const adProbabilityPercent = Number.isFinite(percent) ? percent : 0;

    return {
      label,
      raw,
      proba,
      features,
      adProbability,
      adProbabilityPercent,
    };
  },
};
