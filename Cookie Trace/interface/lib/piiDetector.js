
const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yandex.ru',
  'yandex.com',
  'mail.ru',
  'inbox.ru',
  'list.ru',
  'bk.ru',
  'internet.ru',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.ru',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
  'zoho.com',
  'gmx.com',
  'gmx.net',
  'rambler.ru',
  'rambler.com',
  'lenta.ru',
  'autorambler.ru',
  'myrambler.ru',
  'ro.ru',
  'microsoft.com',
  'google.com',
  'apple.com',
  'amazon.com',
  'meta.com',
  'facebook.com',
  'linkedin.com',
  'twitter.com',
  'github.com',
  'gitlab.com',
  'bitbucket.org'
];

const ALLOWED_TLDS = [
  'com',
  'ru',
  'net',
  'org',
  'edu',
  'gov',
  'io',
  'co',
  'me',
  'info',
  'biz',
  'pro',
  'name',
  'mobi',
  'app',
  'dev',
  'tech',
  'online',
  'site',
  'xyz',
  'top',
  'club',
  'work',
  'store',
  'shop'
];

function isValidLuhn(cardNumber) {
  let sum = 0;
  let isEven = false;
  
  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNumber[i]);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

function validateCard(match) {
  const cardNumber = match[0].replace(/\D/g, '');

  console.log(`[validateCard] Check for ${this.label}. Cleaned number: ${cardNumber}, Original match: ${match[0]}`);

  const isLuhnValid = isValidLuhn(cardNumber);
  console.log(`[validateCard] Luhn valid for ${this.label} (${cardNumber})?: ${isLuhnValid}`);

  if (!isLuhnValid) {
    console.log(`[validateCard] Luhn failed for ${this.label} (${cardNumber})`);
    return false;
  }

  const context = match.input;
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;

  if (startIndex > 0 && /\d/.test(context[startIndex - 1])) {
    console.log(`[validateCard] Context check failed (digit before) for ${this.label} (${cardNumber})`);
    return false;
  }
  if (endIndex < context.length && /\d/.test(context[endIndex])) {
    console.log(`[validateCard] Context check failed (digit after) for ${this.label} (${cardNumber})`);
    return false;
  }

  console.log(`[validateCard] Successfully validated ${this.label} (${cardNumber})`);
  return true;
}

function validateVisaSimple(match) {
  const cardNumber = match[0].replace(/\D/g, '');
  
  if (cardNumber[0] !== '4') return false;
  
  const length = cardNumber.length;
  if (![13, 16, 19].includes(length)) return false;
  
  console.log(`[validateVisaSimple] Validated Visa (${length}) number: ${cardNumber}`);
  
  return true;
}

export const piiPatterns = {
  EMAIL: {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    label: 'Email',
    severity: 'high',
    validate: (match) => {
      const email = match[0].toLowerCase();
      
      const [localPart, domain] = email.split('@');
      
      if (localPart.length < 1 || localPart.length > 64) return false;
      
      if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(localPart)) return false;
      
      if (localPart.startsWith('.') || localPart.endsWith('.')) return false;
      
      if (localPart.includes('..')) return false;
      
      const domainParts = domain.split('.');
      if (domainParts.length < 2) return false;
      
      const tld = domainParts[domainParts.length - 1].toLowerCase();
      
      if (!ALLOWED_TLDS.includes(tld)) return false;
      
      const fullDomain = domainParts.slice(-2).join('.');
      
      if (!ALLOWED_EMAIL_DOMAINS.includes(fullDomain)) return false;
      
      if (domain.length > 255) return false;
      
      for (const part of domainParts) {
        if (part.length > 63) return false;
      }
      
      return true;
    }
  },
  PHONE_RU: {
    regex: /(?:\+7|8)[-\s(]*\d{3}[-\s)]*\d{3}[-\s]*\d{2}[-\s]*\d{2}/g,
    label: 'Телефон (РФ)',
    severity: 'high',
    validate: (match) => {
      const cleanNumber = match[0].replace(/\D/g, '');
      
      if (cleanNumber.length !== 11) return false;
      
      const context = match.input;
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      
      if (startIndex > 0 && /\d/.test(context[startIndex - 1])) return false;
      if (endIndex < context.length && /\d/.test(context[endIndex])) return false;
      
      return true;
    }
  },
  IPV4: {
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    label: 'IPv4 Адрес',
    severity: 'medium'
  },
  CREDIT_CARD: {
    regex: /\b(?:\d[ -]*?){12,19}\b/g,
    label: 'Номер карты',
    severity: 'critical',
    validate: function(match) {
      const cardNumber = match[0].replace(/\D/g, '');
      
      if (cardNumber.length < 12 || cardNumber.length > 19) {
        return false;
      }
      
      
      if (cardNumber[0] === '4' && [13, 16, 19].includes(cardNumber.length)) {
        return true;
      }
      
      if (/^5[1-5]/.test(cardNumber) && cardNumber.length === 16) {
        return true;
      }
      
      if (/^3[47]/.test(cardNumber) && cardNumber.length === 15) {
        return true;
      }
      
      if ((/^(6011|65|64[4-9])/.test(cardNumber)) && [16, 19].includes(cardNumber.length)) {
        return true;
      }
      
      if (/^220[0-4]/.test(cardNumber) && cardNumber.length >= 12 && cardNumber.length <= 19) {
        return true;
      }
      
      if (/^35/.test(cardNumber) && [16, 17, 18, 19].includes(cardNumber.length)) {
        return true;
      }
      
      if (/^62/.test(cardNumber) && [16, 17, 18, 19].includes(cardNumber.length)) {
        return true;
      }
      
      if (/^(5018|5020|5038|5893|6304|6759|6761|6762|6763)/.test(cardNumber) && cardNumber.length >= 12 && cardNumber.length <= 19) {
        return true;
      }
      
      return false;
    }
  },
  SENSITIVE_KEYWORDS: {
    regex: /\b(password|passwd|secret|token|apikey|sessionid|auth|user_id|client_id|ssn|bearer|csrf|jwt|credential|private_key|login|username|access_token|refresh_token|api_secret|oauth|2fa|mfa|authorization|fullname|address|birthdate|dob|passport|license|social_security|tax_id|email_address|phone_number|account_number|routing_number|cvv|cvc|expiry|expiration_date|pin|bank_account|iban|swift|encryption_key|hash_salt|secure_note|backup_code|recovery_key|medical_id|health_id)\b/gi,
    label: 'Ключевое слово',
    severity: 'high'
  },
  VISA_CARD_13: {
    regex: /\b4[0-9]{12}\b/g,
    label: 'Visa (13 цифр)',
    severity: 'critical',
    validate: validateVisaSimple
  },
  
  VISA_CARD_16: {
    regex: /\b4[0-9]{15}\b/g,
    label: 'Visa (16 цифр)',
    severity: 'critical',
    validate: validateVisaSimple
  },
  
  VISA_CARD_19: {
    regex: /\b4[0-9]{18}\b/g,
    label: 'Visa (19 цифр)',
    severity: 'critical',
    validate: validateVisaSimple
  },
  
  MASTERCARD: {
    regex: /\b5[1-5][0-9]{14}\b/g,
    label: 'Mastercard',
    severity: 'critical',
    validate: validateCard
  },
  AMEX_CARD: {
    regex: /\b3[47][0-9]{13}\b/g,
    label: 'American Express',
    severity: 'critical',
    validate: validateCard
  },
  DISCOVER_CARD: {
    regex: /\b(6011|64[4-9]|65)[0-9]{12,15}\b/g,
    label: 'Discover',
    severity: 'critical',
    validate: validateCard
  },
  MIR_CARD: {
    regex: /\b220[0-4][0-9]{8,15}\b/g,
    label: 'MIR',
    severity: 'critical',
    validate: function(match) {
      const cardNumber = match[0].replace(/\D/g, '');
      
      if (!cardNumber.startsWith('220')) return false;
      const fifthDigit = parseInt(cardNumber[3]);
      if (fifthDigit > 4) return false;
      
      if (cardNumber.length < 12 || cardNumber.length > 19) return false;
      
      console.log(`[validateMIR] Validated MIR number: ${cardNumber}`);
      return true;
    }
  },
  JCB_CARD: {
    regex: /\b35[0-9]{14,17}\b/g,
    label: 'JCB',
    severity: 'critical',
    validate: validateCard
  },
  UNION_PAY_CARD: {
    regex: /\b62[0-9]{14,17}\b/g,
    label: 'Union Pay',
    severity: 'critical',
    validate: validateCard
  },
  MAESTRO_CARD: {
    regex: /\b(5018|5020|5038|5893|6304|6759|6761|6762|6763)[0-9]{8,15}\b/g,
    label: 'Maestro',
    severity: 'critical',
    validate: function(match) {
      const cardNumber = match[0].replace(/\D/g, '');
      
      const validPrefixes = ['5018', '5020', '5038', '5893', '6304', '6759', '6761', '6762', '6763'];
      let isValidPrefix = false;
      
      for (const prefix of validPrefixes) {
        if (cardNumber.startsWith(prefix)) {
          isValidPrefix = true;
          break;
        }
      }
      
      if (!isValidPrefix) return false;
      
      if (cardNumber.length < 12 || cardNumber.length > 19) return false;
      
      console.log(`[validateMaestro] Validated Maestro number: ${cardNumber}`);
      return true;
    }
  }
};

function tryDecodeBase64(str) {
  try {
    if (typeof str === 'string' && str.length > 0 && str.length % 4 === 0 && /^[A-Za-z0-9+/]*=?=?$/.test(str)) {
        const decoded = atob(str);
         const isLikelyText = /^[\x20-\x7E\r\n\t{}[\]<>"',.:;]*$/.test(decoded);
         if(isLikelyText) {
             return decoded;
         }
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function scanCookieValueForPII(text, scanMode) {
  const result = {
    foundPII: [],
    wasDecoded: false,
    originalText: text,
    decodedText: null
  };

  if (!text || typeof text !== 'string') {
    return result;
  }

  let textToScanDirectly = text;
  let decodedTextForScanning = null;

  if (scanMode === 'decode_base64') {
    const decoded = tryDecodeBase64(text);
    if (decoded !== null) {
      result.wasDecoded = true;
      result.decodedText = decoded;
      decodedTextForScanning = decoded;
      textToScanDirectly = null;
    }
  }

  const scanText = (inputText, source) => {
    if (!inputText) return;
    for (const key in piiPatterns) {
        const pattern = piiPatterns[key];
        let match;
        pattern.regex.lastIndex = 0;

        while ((match = pattern.regex.exec(inputText)) !== null) {
            if (pattern.validate && !pattern.validate(match)) {
                continue;
            }

            const alreadyFound = result.foundPII.some(item => 
              item.label === pattern.label && item.value === match[0]
            );
            
            if (!alreadyFound) {
                result.foundPII.push({
                    label: pattern.label,
                    value: match[0],
                    severity: pattern.severity,
                    source: source
                });
            }
        }
    }
  };

  if (decodedTextForScanning) {
    scanText(decodedTextForScanning, 'decoded');
  } else if (textToScanDirectly) {
    scanText(textToScanDirectly, 'original');
  }

  return result;
}