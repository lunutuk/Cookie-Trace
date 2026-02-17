import { EventEmitter } from './eventEmitter.js';
import { GUID } from './guid.js';
import { ExportFormats } from './options/exportFormats.js';
import { ExtraInfos } from './options/extraInfos.js';
import { Options } from './options/options.js';
import { Themes } from './options/themes.js';

const optionsKey = 'all_options';

export class OptionsHandler extends EventEmitter {
  constructor(browserDetector, genericStorageHandler) {
    super();

    this.browserDetector = browserDetector;
    this.storageHandler = genericStorageHandler;
    this.isReady = false;
    this.options = null;
    this.guid = GUID.get();

    this.backgroundPageConnection = this.browserDetector
      .getApi()
      .runtime.connect({ name: this.guid });
    this.backgroundPageConnection.onMessage.addListener(this.onMessage);
    this.backgroundPageConnection.postMessage({
      type: 'init_optionsHandler',
    });
  }

  getCookieAdvanced() {
    return this.options.advancedCookies;
  }

  setCookieAdvanced(isAdvanced) {
    this.options.advancedCookies = isAdvanced;
    this.saveOptions();
  }

  getDevtoolsEnabled() {
    return this.options.devtoolsEnabled;
  }

  setDevtoolsEnabled(devtoolsEnabled) {
    this.options.devtoolsEnabled = devtoolsEnabled;
    this.saveOptions();
  }

  getAnimationsEnabled() {
    return this.options.animationsEnabled !== false;
  }

  setAnimationsEnabled(animationsEnabled) {
    this.options.animationsEnabled = animationsEnabled;
    this.saveOptions();
  }

  getMlEnabled() {
    return this.options?.mlEnabled !== false;
  }

  setMlEnabled(mlEnabled) {
    if (!this.options) return;
    this.options.mlEnabled = !!mlEnabled;
    this.saveOptions();
  }

  getProfilingProtectionEnabled() {
    return this.options?.profilingProtectionEnabled === true;
  }

  setProfilingProtectionEnabled(enabled) {
    if (!this.options) return;
    this.options.profilingProtectionEnabled = !!enabled;
    this.saveOptions();
  }

  getProfilingProtectionThresholdPercent() {
    const value = Number(this.options?.profilingProtectionThresholdPercent);
    if (!Number.isFinite(value)) return 95;
    return Math.min(100, Math.max(0, value));
  }

  setProfilingProtectionThresholdPercent(value) {
    if (!this.options) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    this.options.profilingProtectionThresholdPercent = Math.min(100, Math.max(0, num));
    this.saveOptions();
  }

  getExportFormat() {
    let exportFormat = this.options?.exportFormat;
    if (!this.isExportFormatValid(exportFormat)) {
      exportFormat = ExportFormats.Ask;
    }
    return exportFormat;
  }

  setExportFormat(exportFormat) {
    if (!this.options) return;
    if (!this.isExportFormatValid(exportFormat)) {
      return;
    }
    this.options.exportFormat = exportFormat;
    this.saveOptions();
  }

  isExportFormatValid(exportFormat) {
    return Object.values(ExportFormats).includes(exportFormat);
  }

  getExtraInfo() {
    let extraInfo = this.options?.extraInfo;
    if (!this.isExtraInfoValid(extraInfo)) {
      extraInfo = ExtraInfos.Nothing;
    }
    return extraInfo;
  }

  setExtraInfo(extraInfo) {
    if (!this.options) return;
    if (!this.isExtraInfoValid(extraInfo)) {
      return;
    }
    this.options.extraInfo = extraInfo;
    this.saveOptions();
  }

  isExtraInfoValid(extraInfo) {
    return Object.values(ExtraInfos).includes(extraInfo);
  }

  getTheme() {
    let theme = this.options?.theme;
    if (!this.isThemeValid(theme)) {
      theme = Themes.Auto;
    }
    return theme;
  }

  setTheme(theme) {
    if (!this.options) return;
    if (!this.isThemeValid(theme)) {
      return;
    }
    this.options.theme = theme;
    this.saveOptions();
  }

  isThemeValid(theme) {
     return Object.values(Themes).includes(theme);
  }

  getButtonBarTop() {
    return !!this.options?.buttonBarTop;
  }

  setButtonBarTop(buttonBarTop) {
    if (!this.options) return;
    this.options.buttonBarTop = !!buttonBarTop;
    this.saveOptions();
  }

  getLongLivedCookieThreshold() {
    const validThresholds = ['off', '1m', '6m', '1y'];
    const value = this.options?.longLivedCookieThreshold;
    return validThresholds.includes(value) ? value : 'off';
  }

  setLongLivedCookieThreshold(threshold) {
    if (!this.options) return;
    const validThresholds = ['off', '1m', '6m', '1y'];
    if (validThresholds.includes(threshold)) {
      this.options.longLivedCookieThreshold = threshold;
      this.saveOptions();
    } else {
      console.warn('Invalid longLivedCookieThreshold:', threshold);
      this.options.longLivedCookieThreshold = 'off';
      this.saveOptions();
    }
  }

  getPiiScanMode() {
    const validModes = ['off', 'simple', 'decode_base64'];
    const value = this.options?.piiScanMode;
    return validModes.includes(value) ? value : 'off';
  }

  setPiiScanMode(mode) {
    if (!this.options) return;
    const validModes = ['off', 'simple', 'decode_base64'];
    if (validModes.includes(mode)) {
      this.options.piiScanMode = mode;
      this.saveOptions();
    } else {
      console.error("Invalid PII scan mode:", mode);
    }
  }

  getPiiBrowserNotificationsEnabled() {
    return this.options?.piiBrowserNotificationsEnabled !== false;
  }

  setPiiBrowserNotificationsEnabled(enabled) {
    if (!this.options) return;
    this.options.piiBrowserNotificationsEnabled = !!enabled;
    this.saveOptions();
  }


  async loadOptions() {
    let loadedOpts = await this.storageHandler.getLocal(optionsKey);
    if (loadedOpts == null) {
      this.options = new Options();
      await this.saveOptions();
    } else {
        const defaultOptions = new Options();
        let optionsChanged = false;
        for (const key in defaultOptions) {
            if (loadedOpts[key] === undefined) {
                loadedOpts[key] = defaultOptions[key];
                optionsChanged = true;
            }
        }
        this.options = loadedOpts;
        if(optionsChanged) {
            await this.saveOptions();
        }
    }
    this.isReady = true;
    this.emit('optionsLoaded', this.options);
  }

  async saveOptions() {
    if (!this.options) {
      console.warn('Attempted to save options before they are loaded or initialized.');
      return;
    }
    console.log('Saving options:', this.options);
    await this.storageHandler.setLocal(optionsKey, this.options);
    this.notifyBackgroundOfChanges();
  }

  notifyBackgroundOfChanges() {
    if (this.backgroundPageConnection) {
        try {
            this.sendMessage('optionsChanged', { from: this.guid });
        } catch(e) {
            console.warn("Failed to notify background page of changes:", e);
        }
    }
  }

  sendMessage(type, params, callback, errorCallback) {
    const runtimeApi = this.browserDetector.getApi()?.runtime;
    if (!runtimeApi) {
        console.error("Runtime API is not available.");
        if (errorCallback) errorCallback("Runtime API is not available.");
        return;
    }

    if (this.browserDetector.supportsPromises()) {
      runtimeApi.sendMessage({ type: type, params: params })
        .then(callback, errorCallback || ((error) => { console.error(`Error sending message ${type}:`, error); }));
    } else {
      runtimeApi.sendMessage({ type: type, params: params }, (response) => {
          const error = runtimeApi.lastError;
          if (error) {
              console.error(`Error sending message ${type}:`, error);
              if (errorCallback) errorCallback(error);
          } else if (callback) {
              callback(response);
          }
      });
    }
  }

  onMessage = async (request) => {
    if (!this.isReady) {
      await this.loadOptions();
    }

    switch (request.type) {
      case 'options_updated': {
        if (request.data && request.data.from === this.guid) {
          return;
        }
        const oldOptions = this.options ? { ...this.options } : null;
        await this.loadOptions();
        console.log("Options updated from another source. Old:", oldOptions, "New:", this.options);
        this.emit('optionsChanged', oldOptions);
        return;
      }
      case 'optionsChanged': {
        if (request.data && request.data.from === this.guid) {
          return;
        }
        const oldOptions = this.options ? { ...this.options } : null;
        await this.loadOptions();
        console.log("Options changed from another source. Old:", oldOptions, "New:", this.options);
        this.emit('optionsChanged', oldOptions);
        return;
      }
    }
  };
}
