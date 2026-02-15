import { Animate } from './animate.js';
import { GUID } from './guid.js';
import { ExtraInfos } from './options/extraInfos.js';
import { scanCookieValueForPII } from './piiDetector.js';
import { CookieAnalyzer } from './cookieAnalyzer.js';

export class Cookie {
  constructor(id, cookie, optionHandler, cookieHandler) {
    this.id = id;
    this.cookie = cookie;
    this.guid = GUID.get();
    this.baseHtml = false;
    this.optionHandler = optionHandler;
    this.cookieHandler = cookieHandler;
    this.piiScanResults = null;
    this.mlAnalysisResult = null;

    this.optionHandler.on('optionsChanged', () => {
      this.updateLongLivedStatus();
      this.updateMlStatus();
    });
  }

  _isLongLived() {
    if (!this.cookie.expirationDate || !this.optionHandler || !this.optionHandler.options) {
         return false;
    }

    const thresholdSetting = this.optionHandler.getLongLivedCookieThreshold();
    if (thresholdSetting === 'off') {
        return false;
    }

    const now = new Date();
    const expiration = new Date(this.cookie.expirationDate * 1000);

    let thresholdDurationMs = 0;
    const oneDayMs = 24 * 60 * 60 * 1000;

    switch (thresholdSetting) {
      case '1m':
        thresholdDurationMs = 30 * oneDayMs;
        break;
      case '6m':
        thresholdDurationMs = 180 * oneDayMs;
        break;
      case '1y':
        thresholdDurationMs = 365 * oneDayMs;
        break;
      default:
        return false;
    }

    const lifetimeMs = expiration.getTime() - now.getTime();

    return lifetimeMs > thresholdDurationMs;
  }


  get isGenerated() {
    return this.baseHtml !== false;
  }

  get html() {
    if (!this.isGenerated) {
      this.generateHtml();
    }
    return this.baseHtml;
  }

  updateHtml(cookie) {
    if (!this.isGenerated || !this.baseHtml) {
      return;
    }
    const oldValue = this.cookie.value;
    this.cookie = cookie;

    this.updateName();
    this.updateExtraInfo();
    this.updateValue();
    this.updateDomain();
    this.updatePath();
    this.updateExpiration();
    this.updateSameSite();
    this.updateHostOnly();
    this.updateSession();
    this.updateSecure();
    this.updateHttpOnly();

    if (this._isLongLived()) {
        this.baseHtml.classList.add('long-lived-cookie');
    } else {
        this.baseHtml.classList.remove('long-lived-cookie');
    }

    const piiScanMode = this.optionHandler.getPiiScanMode();
    if (piiScanMode !== 'off') {
      if (this.cookie.value !== oldValue || !this.piiScanResults) {
        this.performPiiScan();
      }
    } else {
      this.piiScanResults = null;
    }
    this.updatePiiDisplay();

    this.performMlAnalysis();
    this.updateMlStatus();
  }


  generateHtml() {
    const self = this;
    const template = document.importNode(
      document.getElementById('tmp-cookie').content,
      true,
    );
    this.baseHtml = template.querySelector('li');
    this.baseHtml.setAttribute('data-name', this.cookie.name);
    const elementId = this.id || `new-${this.guid}`;
    this.baseHtml.id = elementId;

    if (this._isLongLived()) {
        this.baseHtml.classList.add('long-lived-cookie');
    }

    const form = this.baseHtml.querySelector('form');
    form.setAttribute('data-id', elementId);
    form.id = this.guid;

    const expandoId = 'exp_' + this.guid;
    const expando = this.baseHtml.querySelector('.expando');
    expando.id = expandoId;

    const header = this.baseHtml.querySelector('.header');
    header.setAttribute('aria-controls', expandoId);

    const headerName = this.baseHtml.querySelector('.header-name');
    headerName.textContent = this.cookie.name;

    const headerExtraInfo = this.baseHtml.querySelector('.header-extra-info');
    headerExtraInfo.textContent = this.getExtraInfoValue();
    headerExtraInfo.title = this.getExtraInfoTitle();

    this.populateFormField(form, 'name', this.cookie.name);
    this.populateFormField(form, 'value', this.cookie.value, 'textarea');
    this.populateFormField(form, 'domain', this.cookie.domain);
    this.populateFormField(form, 'path', this.cookie.path);
    this.populateFormField(form, 'expiration', this.formatExpirationForDisplay());
    this.populateFormField(form, 'sameSite', this.cookie.sameSite || 'lax', 'select');
    this.populateFormField(form, 'hostOnly', !!this.cookie.hostOnly, 'checkbox');
    this.populateFormField(form, 'session', !this.cookie.expirationDate, 'checkbox');
    this.populateFormField(form, 'secure', !!this.cookie.secure, 'checkbox');
    this.populateFormField(form, 'httpOnly', !!this.cookie.httpOnly, 'checkbox');

    form.querySelector('.input-domain').disabled = !!this.cookie.hostOnly;
    form.querySelector('.input-expiration').disabled = !this.cookie.expirationDate;

    form.querySelector('.input-hostOnly').addEventListener('change', (e) => this.afterHostOnlyChanged(e.target.checked));
    form.querySelector('.input-session').addEventListener('change', (e) => this.afterSessionChanged(e.target.checked));

    const advancedToggleButton = form.querySelector('.advanced-toggle');
    const advancedForm = form.querySelector('.advanced-form');
    advancedToggleButton.addEventListener('click', () => {
        advancedForm.classList.toggle('show');
        advancedToggleButton.textContent = advancedForm.classList.contains('show')
            ? 'Скрыть доп. информацию'
            : 'Показать доп. информацию';
        Animate.resizeSlide(expando);
    });

    this.performPiiScan();
    this.updatePiiDisplay();

    this.performMlAnalysis();
    this.updateMlStatus();

    if (this.optionHandler.getCookieAdvanced() || (this.piiScanResults && this.piiScanResults.foundPII.length > 0)) {
        advancedForm.classList.add('show');
        advancedToggleButton.textContent = 'Скрыть доп. информацию';
    } else {
         advancedToggleButton.textContent = 'Показать доп. информацию';
    }
  }

  populateFormField(form, name, value) {
      const input = form.querySelector(`[name="${name}"]`);

      if (!input) {
          console.warn(`Form field not found for name: ${name}`);
          return;
      }

      const elementType = input.tagName.toLowerCase();
      const inputTypeAttr = input.type ? input.type.toLowerCase() : null;

      const inputId = `${name}-${this.guid}`;
      input.id = inputId;
      const label = form.querySelector(`.label-${name}`);
      if(label) {
           label.setAttribute('for', inputId);
      } else {
           const checkboxLabel = form.querySelector(`.label-${name}`);
           if (checkboxLabel && checkboxLabel.contains(input)) {
           }
      }


      if (elementType === 'input' && inputTypeAttr === 'checkbox') {
          input.checked = !!value;
      } else if (elementType === 'select') {
           input.value = value !== null && value !== undefined ? value : '';
           if (input.selectedIndex === -1 && input.options.length > 0) {
               console.warn(`Value "${value}" not found for select[name="${name}"]. Setting to default.`);
               input.selectedIndex = 0;
           }
      } else if (elementType === 'textarea' || elementType === 'input') {
          input.value = value !== null && value !== undefined ? value : '';
      } else {
          console.warn(`Unhandled form element type: ${elementType} for name: ${name}`);
      }
  }

  updateName() {
    if (!this.isGenerated) return;
    const nameInput = this.baseHtml.querySelector(`#name-${this.guid}`);
    const headerName = this.baseHtml.querySelector('.header-name');
    const header = this.baseHtml.querySelector('.header');
    this.baseHtml.setAttribute('data-name', this.cookie.name);
    nameInput.value = this.cookie.name;
    headerName.textContent = this.cookie.name;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(nameInput);
  }

  updateExtraInfo() {
    if (!this.isGenerated) return;
    const header = this.baseHtml.querySelector('.header');
    const headerExtraInfo = this.baseHtml.querySelector('.header-extra-info');
    headerExtraInfo.textContent = this.getExtraInfoValue();
    headerExtraInfo.title = this.getExtraInfoTitle();
    this.animateChangeOnNode(header);
  }

  updateValue() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#value-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    
    this.cookie.value = valueInput.value;
    
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
    
    this.performPiiScan();
    this.updatePiiDisplay();

    this.performMlAnalysis();
    this.updateMlStatus();
  }

  performMlAnalysis() {
    if (!this.optionHandler) return;

    if (!this.optionHandler.getMlEnabled()) {
      this.mlAnalysisResult = null;
      return;
    }

    try {
      this.mlAnalysisResult = CookieAnalyzer.analyze(this.cookie);
    } catch (_error) {
      this.mlAnalysisResult = null;
    }
  }

  updateMlStatus() {
    if (!this.isGenerated || !this.baseHtml || !this.optionHandler) return;

    if (!this.optionHandler.getMlEnabled()) {
      this.baseHtml.classList.remove('ml-ad-cookie');
      this.updateExtraInfo();
      const existing = this.baseHtml.querySelector('.ml-probability-percent');
      if (existing) existing.remove();
      return;
    }

    if (this.mlAnalysisResult?.label === 1) {
      this.baseHtml.classList.add('ml-ad-cookie');
      this.updateExtraInfo();

      const header = this.baseHtml.querySelector('.header');
      const headerName = this.baseHtml.querySelector('.header-name');
      const percent = this.mlAnalysisResult?.adProbabilityPercent;
      if (header && headerName && typeof percent === 'number') {
        const rounded = Math.round(percent);
        let percentEl = this.baseHtml.querySelector('.ml-probability-percent');
        if (!percentEl) {
          percentEl = document.createElement('span');
          percentEl.classList.add('ml-probability-percent', 'tooltip-icon');
          percentEl.setAttribute('data-tooltip-key', 'ml-probability');
          percentEl.setAttribute('tabindex', '0');
          percentEl.setAttribute('role', 'button');
          percentEl.setAttribute('aria-label', 'Что означает этот процент');
          header.insertBefore(percentEl, headerName.nextSibling);
        }
        percentEl.textContent = `${rounded}%`;
      }
    } else {
      this.baseHtml.classList.remove('ml-ad-cookie');
      this.updateExtraInfo();
      const existing = this.baseHtml.querySelector('.ml-probability-percent');
      if (existing) existing.remove();
    }
  }

  updateDomain() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#domain-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.value = this.cookie.domain;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updatePath() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#path-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.value = this.cookie.path;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updateExpiration() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#expiration-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.value = this.formatExpirationForDisplay();
    valueInput.disabled = !this.cookie.expirationDate;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
    this.updateLongLivedStatus();
  }
  updateSameSite() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#sameSite-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.value = this.cookie.sameSite || 'lax';
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updateHostOnly() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#hostOnly-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.checked = !!this.cookie.hostOnly;
    this.afterHostOnlyChanged(!!this.cookie.hostOnly);
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updateSession() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#session-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.checked = !this.cookie.expirationDate;
    this.afterSessionChanged(!this.cookie.expirationDate);
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updateSecure() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#secure-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.checked = !!this.cookie.secure;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }
  updateHttpOnly() {
    if (!this.isGenerated) return;
    const valueInput = this.baseHtml.querySelector(`#httpOnly-${this.guid}`);
    const header = this.baseHtml.querySelector('.header');
    valueInput.checked = !!this.cookie.httpOnly;
    this.animateChangeOnNode(header);
    this.animateChangeOnNode(valueInput);
  }


  afterHostOnlyChanged(isChecked) {
    if (!this.isGenerated) return;
    const domainInput = this.baseHtml.querySelector(`#domain-${this.guid}`);
    domainInput.disabled = isChecked;
  }

  afterSessionChanged(isChecked) {
    if (!this.isGenerated) return;
    const expirationInput = this.baseHtml.querySelector(`#expiration-${this.guid}`);
    expirationInput.disabled = isChecked;
    if (isChecked) {
      expirationInput.value = 'Session Cookie';
    } else {
      if (!this.cookie.expirationDate) {
        this.cookie.expirationDate = (Date.now() / 1000) + 3600;
      }
      expirationInput.value = this.formatExpirationForDisplay();
    }
    this.updateLongLivedStatus();
  }

  performPiiScan() {
    if (!this.optionHandler) return;
    const scanMode = this.optionHandler.getPiiScanMode();
    this.piiScanResults = null;
    if (scanMode === 'off' || !this.cookie.value) {
      this.piiScanResults = { foundPII: [], wasDecoded: false, originalText: this.cookie.value, decodedText: null };
      return;
    }
    this.piiScanResults = scanCookieValueForPII(this.cookie.value, scanMode);
  }

  updatePiiDisplay() {
    if (!this.isGenerated || !this.baseHtml) return;

    const formElement = this.baseHtml.querySelector('form');
    const headerElement = this.baseHtml.querySelector('.header');
    const valueTextarea = formElement.querySelector('textarea[name="value"]');
    const advancedForm = formElement.querySelector('.advanced-form');
    const advancedToggleButton = formElement.querySelector('.advanced-toggle');
    const expando = this.baseHtml.querySelector('.expando');

    let piiIcon = headerElement.querySelector('.pii-indicator-icon');
    if (piiIcon) piiIcon.remove();
    const existingPiiDetails = formElement.querySelector('.pii-details-container');
    if (existingPiiDetails) existingPiiDetails.remove();
    valueTextarea.classList.remove('pii-detected-highlight');

    const scanMode = this.optionHandler.getPiiScanMode();
     if (scanMode === 'off' || !this.piiScanResults || this.piiScanResults.foundPII.length === 0) {
        return;
    }

    const { foundPII, wasDecoded, decodedText } = this.piiScanResults;

    piiIcon = document.createElement('span');
    piiIcon.classList.add('pii-indicator-icon');
    piiIcon.innerHTML = `<svg class="icon" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>`;
    piiIcon.title = 'Обнаружены потенциальные PII!';
    piiIcon.setAttribute('aria-label', 'Обнаружены потенциальные PII');

    const headerName = headerElement.querySelector('.header-name');
    if (headerName) {
      headerName.parentNode.insertBefore(piiIcon, headerName.nextSibling);
    }

    valueTextarea.classList.add('pii-detected-highlight');

    if (advancedForm) {
      const piiDetailsDiv = document.createElement('div');
      piiDetailsDiv.classList.add('pii-details-container');

      const titleRow = document.createElement('div');
      titleRow.classList.add('pii-details-title');

      const titleLeft = document.createElement('div');
      titleLeft.classList.add('pii-details-title-left');

      const title = document.createElement('strong');
      title.textContent = 'Обнаружены потенциальные PII';
      titleLeft.appendChild(title);

      titleRow.appendChild(titleLeft);

      const titleRight = document.createElement('div');
      titleRight.classList.add('pii-details-title-right');

      const infoIcon = document.createElement('span');
      infoIcon.classList.add('tooltip-icon', 'pii-tooltip-icon');
      infoIcon.setAttribute('data-tooltip-key', 'pii');
      infoIcon.setAttribute('tabindex', '0');
      infoIcon.setAttribute('aria-label', 'Что такое PII');
      infoIcon.innerHTML = `<svg class="icon"><use href="../sprites/solid.svg#circle-info"></use></svg>`;
      titleRight.appendChild(infoIcon);

      titleRow.appendChild(titleRight);

      piiDetailsDiv.appendChild(titleRow);

      if (wasDecoded) {
        const decodedBlock = document.createElement('div');
        decodedBlock.classList.add('pii-decoded-block');

        const decodedHeader = document.createElement('div');
        decodedHeader.classList.add('pii-decoded-header');

        const decodedLabel = document.createElement('div');
        decodedLabel.classList.add('pii-decoded-label');
        decodedLabel.textContent = 'Найдено после декодирования Base64';
        decodedHeader.appendChild(decodedLabel);

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.classList.add('pii-copy-button');
        copyBtn.textContent = 'Копировать';
        copyBtn.addEventListener('click', async (event) => {
          event.preventDefault();
          event.stopPropagation();
          try {
            if (navigator?.clipboard?.writeText) {
              await navigator.clipboard.writeText(decodedText || '');
            } else {
              const tmp = document.createElement('textarea');
              tmp.value = decodedText || '';
              tmp.style.position = 'fixed';
              tmp.style.left = '-9999px';
              document.body.appendChild(tmp);
              tmp.select();
              document.execCommand('copy');
              tmp.remove();
            }
            copyBtn.classList.add('is-copied');
            setTimeout(() => copyBtn.classList.remove('is-copied'), 900);
          } catch (_error) {
            copyBtn.classList.add('is-copy-failed');
            setTimeout(() => copyBtn.classList.remove('is-copy-failed'), 900);
          }
        });
        decodedHeader.appendChild(copyBtn);

        decodedBlock.appendChild(decodedHeader);

        const decodedPre = document.createElement('pre');
        decodedPre.classList.add('pii-decoded-pre');
        decodedPre.textContent = decodedText;
        decodedBlock.appendChild(decodedPre);

        piiDetailsDiv.appendChild(decodedBlock);
      }

      const ul = document.createElement('ul');
      foundPII.forEach(item => {
        const li = document.createElement('li');
        li.classList.add('pii-item');
        li.innerHTML = `
          <div class="pii-item-header">
            <span class="pii-item-label">${escapeHtml(item.label)}</span>
          </div>
          <code class="pii-item-value">${escapeHtml(item.value)}</code>
        `;
        ul.appendChild(li);
      });
      piiDetailsDiv.appendChild(ul);

      advancedForm.insertBefore(piiDetailsDiv, advancedForm.firstChild);

      if (this.optionHandler.getCookieAdvanced()) {
        advancedForm.classList.add('show');
        advancedToggleButton.textContent = 'Скрыть доп. информацию';
      }
    }
  }


  removeHtml(callback = null) {
      if (this.isRemoving || !this.baseHtml) {
        return;
      }
      this.isRemoving = true;
      Animate.toggleSlide(this.baseHtml, () => {
          if (this.baseHtml) {
              this.baseHtml.remove();
              this.baseHtml = null;
          }
          this.isRemoving = false;
          if (callback) {
              callback();
          }
      });
  }

  animateChangeOnNode(node) {
    if (!node) return;
    node.classList.remove('anim-value-changed');
    void node.offsetWidth;
    node.classList.add('anim-value-changed');
  }

  showSuccessAnimation() {
    if (this.baseHtml) {
      this.animateSuccessOnNode(this.baseHtml.querySelector('.header'));
    }
  }

  animateSuccessOnNode(node) {
     if (!node) return;
    node.classList.remove('anim-success');
    void node.offsetWidth;
    node.classList.add('anim-success');
  }

  formatExpirationForDisplay() {
    if (!this.cookie.expirationDate) {
      return 'Session Cookie';
    }

    const absoluteDate = new Date(this.cookie.expirationDate * 1000).toLocaleString();
    const relativeDate = this.getRelativeTime(this.cookie.expirationDate);

    return `${absoluteDate} ${relativeDate}`;
  }

  getRelativeTime(timestamp) {
    const now = new Date();
    const expiration = new Date(timestamp * 1000);
    const diff = expiration.getTime() - now.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    function getPlural(number, one, two, five) {
      let n = Math.abs(number);
      n %= 100;
      if (n >= 5 && n <= 20) {
        return five;
      }
      n %= 10;
      if (n === 1) {
        return one;
      }
      if (n >= 2 && n <= 4) {
        return two;
      }
      return five;
    }

    if (years > 0) {
      return `(через ~${years} ${getPlural(years, 'год', 'года', 'лет')})`;
    } else if (months > 0) {
      return `(через ${months} ${getPlural(months, 'месяц', 'месяца', 'месяцев')})`;
    } else if (weeks > 0) {
      return `(через ${weeks} ${getPlural(weeks, 'неделю', 'недели', 'недель')})`;
    } else if (days > 0) {
      return `(через ${days} ${getPlural(days, 'день', 'дня', 'дней')})`;
    } else if (hours > 0) {
      return `(через ${hours} ${getPlural(hours, 'час', 'часа', 'часов')})`;
    } else if (minutes > 0) {
      return `(через ${minutes} ${getPlural(minutes, 'минуту', 'минуты', 'минут')})`;
    } else {
      return `(через ${seconds} ${getPlural(seconds, 'секунду', 'секунды', 'секунд')})`;
    }
  }

  formatExpirationForDisplayShort() {
    if (!this.cookie.expirationDate) return 'Session';
     const date = new Date(this.cookie.expirationDate * 1000);
     return date.getFullYear() + '-' +
            ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
            ('0' + date.getDate()).slice(-2) + ' ' +
            ('0' + date.getHours()).slice(-2) + ':' +
            ('0' + date.getMinutes()).slice(-2);
  }

  formatBoolForDisplayShort(name, boolValue) {
    const emoji = boolValue ? '✓' : '✗';
    return `${emoji} ${name}`;
  }

  getExtraInfoValue() {
    if (!this.optionHandler || !this.optionHandler.options) return '';
    const extraInfoType = this.optionHandler.getExtraInfo();
    switch (extraInfoType) {
      case ExtraInfos.Value:
        return this.cookie.value;
      case ExtraInfos.Domain:
        return this.cookie.domain;
      case ExtraInfos.Path:
        return this.cookie.path;
      case ExtraInfos.Expiration:
        return this.formatExpirationForDisplayShort();
      case ExtraInfos.Samesite:
        return this.cookie.sameSite ? this.cookie.sameSite.charAt(0).toUpperCase() + this.cookie.sameSite.slice(1) : 'None';
      case ExtraInfos.Hostonly:
        return this.formatBoolForDisplayShort('HostOnly', !!this.cookie.hostOnly);
      case ExtraInfos.Session:
        return this.formatBoolForDisplayShort('Session', !this.cookie.expirationDate);
      case ExtraInfos.Secure:
        return this.formatBoolForDisplayShort('Secure', !!this.cookie.secure);
      case ExtraInfos.Httponly:
        return this.formatBoolForDisplayShort('HttpOnly', !!this.cookie.httpOnly);
      case ExtraInfos.Nothing:
      default:
        return '';
    }
  }

  getExtraInfoTitle() {
     if (!this.optionHandler || !this.optionHandler.options) return '';
    const extraInfoType = this.optionHandler.getExtraInfo();
    switch (extraInfoType) {
      case ExtraInfos.Value:
        return 'Значение: ' + this.cookie.value;
      case ExtraInfos.Domain:
        return 'Домен: ' + this.cookie.domain;
      case ExtraInfos.Path:
        return 'Путь: ' + this.cookie.path;
      case ExtraInfos.Expiration:
        return 'Истекает: ' + this.formatExpirationForDisplay();
      case ExtraInfos.Samesite:
        return 'SameSite: ' + (this.cookie.sameSite ? this.cookie.sameSite.charAt(0).toUpperCase() + this.cookie.sameSite.slice(1) : 'None');
      case ExtraInfos.Hostonly:
        return 'HostOnly: ' + !!this.cookie.hostOnly;
      case ExtraInfos.Session:
        return 'Session: ' + !this.cookie.expirationDate;
      case ExtraInfos.Secure:
        return 'Secure: ' + !!this.cookie.secure;
      case ExtraInfos.Httponly:
        return 'HttpOnly: ' + !!this.cookie.httpOnly;
      case ExtraInfos.Nothing:
      default:
        return '';
    }
  }


  static hashCode(cookie) {
    const cookieString = `${cookie.name || ''}|${cookie.domain || ''}|${cookie.path || ''}`;
    let hash = 0;
    if (cookieString.length === 0) return hash;
    for (let i = 0; i < cookieString.length; i++) {
      const chr = cookieString.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
    }
    hash = (hash << 5) - hash + (cookie.storeId || '0').charCodeAt(0);
    return hash | 0;
  }

  updateLongLivedStatus() {
    if (!this.isGenerated || !this.baseHtml) return;
    
    if (this._isLongLived()) {
      this.baseHtml.classList.add('long-lived-cookie');
    } else {
      this.baseHtml.classList.remove('long-lived-cookie');
    }
  }
}

function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    if (typeof unsafe === 'number' || typeof unsafe === 'boolean') {
        return unsafe.toString();
    }
    if (typeof unsafe === 'string') {
        return unsafe
             .replace(/&/g, "&")
             .replace(/</g, "<")
             .replace(/>/g, ">")
             .replace(/"/g, "&quot")
             .replace(/'/g, "'");
    }
    console.warn("Attempting to escape non-primitive value:", unsafe);
    return '[Object]';
}